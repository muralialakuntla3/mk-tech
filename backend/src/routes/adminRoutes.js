const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const config = require('../config');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin', 'manager'));

async function isMasterAdminUser(userId, client = pool) {
  const result = await client.query('SELECT username, email, role FROM users WHERE id = $1', [userId]);
  if (!result.rowCount || result.rows[0].role !== 'admin') {
    return false;
  }
  const masterUsername = config.masterAdmin.username?.trim().toLowerCase();
  const masterEmail = config.masterAdmin.email?.trim().toLowerCase();
  return (masterUsername && result.rows[0].username?.toLowerCase() === masterUsername)
    || (masterEmail && result.rows[0].email?.toLowerCase() === masterEmail);
}

function normalizeCourseIds(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map(Number)
      .filter((item) => Number.isInteger(item) && item > 0)
  )];
}

async function ensureCoursesExist(courseIds, client = pool) {
  if (!courseIds.length) {
    return;
  }

  const result = await client.query(
    'SELECT id FROM courses WHERE id = ANY($1::int[])',
    [courseIds]
  );

  if (result.rows.length !== courseIds.length) {
    const existingIds = new Set(result.rows.map((row) => row.id));
    const missing = courseIds.filter((id) => !existingIds.has(id));
    const error = new Error(`Invalid course IDs: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

async function getDashboardData() {
  const [coursesResult, usersResult] = await Promise.all([
    pool.query(`
      SELECT
        c.id,
        c.title,
        c.description,
        c.image_url,
        c.created_at,
        COUNT(cv.id)::int AS video_count
      FROM courses c
      LEFT JOIN course_videos cv ON cv.course_id = c.id
      GROUP BY c.id
      ORDER BY LOWER(c.title) ASC, c.id ASC
    `),
    pool.query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.profile_image,
        u.full_name,
        u.role,
        u.created_at
      FROM users u
      GROUP BY u.id
      ORDER BY LOWER(COALESCE(u.full_name, u.username)) ASC, u.id ASC
    `),
  ]);

  return {
    courses: coursesResult.rows.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      imageUrl: course.image_url || '',
      createdAt: course.created_at,
      videoCount: course.video_count,
    })),
    users: usersResult.rows.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      profileImage: user.profile_image || '',
      fullName: user.full_name,
      role: user.role,
      isMasterAdmin:
        user.role === 'admin' && (
          (config.masterAdmin.username?.trim().toLowerCase() && user.username?.toLowerCase() === config.masterAdmin.username.trim().toLowerCase())
          || (config.masterAdmin.email?.trim().toLowerCase() && user.email?.toLowerCase() === config.masterAdmin.email.trim().toLowerCase())
        ),
      createdAt: user.created_at,
    })),
  };
}

router.get('/courses/:courseId/videos', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    const result = await pool.query(
      `
        SELECT id, module_id, title, video_url, created_at
        FROM course_videos
        WHERE course_id = $1
        ORDER BY created_at DESC, id DESC
      `,
      [courseId]
    );
    return res.json({
      videos: result.rows.map((row) => ({
        id: row.id,
        moduleId: row.module_id,
        title: row.title,
        videoUrl: row.video_url,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await getDashboardData();
    return res.json(dashboard);
  } catch (error) {
    return next(error);
  }
});

router.post('/courses', async (req, res, next) => {
  try {
    const title = req.body.title?.trim();
    const description = req.body.description?.trim() || '';
    const imageUrl = req.body.imageUrl?.trim() || '';

    if (!title || !imageUrl) {
      return res.status(400).json({ message: 'Course title and image are required.' });
    }

    const result = await pool.query(
      `
        INSERT INTO courses (title, description, image_url)
        VALUES ($1, $2, $3)
        RETURNING id, title, description, image_url, created_at
      `,
      [title, description, imageUrl]
    );

    return res.status(201).json({
      message: 'Course created successfully.',
      course: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        description: result.rows[0].description,
        imageUrl: result.rows[0].image_url || '',
        createdAt: result.rows[0].created_at,
        videos: [],
      },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A course with this title already exists.' });
    }

    return next(error);
  }
});

router.put('/courses/:courseId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = req.body.title?.trim();
    const description = req.body.description?.trim() || '';
    const imageUrl = req.body.imageUrl?.trim() || '';

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }

    if (!title || !imageUrl) {
      return res.status(400).json({ message: 'Course title and image are required.' });
    }

    const result = await pool.query(
      `
        UPDATE courses
        SET title = $1, description = $2, image_url = $3
        WHERE id = $4
        RETURNING id, title, description, image_url, created_at
      `,
      [title, description, imageUrl, courseId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    return res.json({
      message: 'Course updated successfully.',
      course: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        description: result.rows[0].description,
        imageUrl: result.rows[0].image_url || '',
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A course with this title already exists.' });
    }
    return next(error);
  }
});

router.delete('/courses/:courseId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }

    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [courseId]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    return res.json({ message: 'Course deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/courses/:courseId/videos', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = req.body.title?.trim();
    const videoUrl = req.body.videoUrl?.trim();
    const parsedModuleId = Number(req.body.moduleId);
    const moduleId = Number.isInteger(parsedModuleId) && parsedModuleId > 0 ? parsedModuleId : null;

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }

    if (!title || !videoUrl) {
      return res.status(400).json({ message: 'Video title and video link are required.' });
    }

    const courseCheck = await pool.query(
      'SELECT id FROM courses WHERE id = $1',
      [courseId]
    );

    if (!courseCheck.rowCount) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const result = await pool.query(
      `
        INSERT INTO course_videos (course_id, module_id, title, video_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, course_id, module_id, title, video_url, created_at
      `,
      [courseId, moduleId, title, videoUrl]
    );

    return res.status(201).json({
      message: 'Video added to course successfully.',
      video: {
        id: result.rows[0].id,
        courseId: result.rows[0].course_id,
        moduleId: result.rows[0].module_id,
        title: result.rows[0].title,
        videoUrl: result.rows[0].video_url,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/courses/:courseId/videos/:videoId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const title = req.body.title?.trim();
    const videoUrl = req.body.videoUrl?.trim();
    const parsedModuleId = Number(req.body.moduleId);
    const moduleId = Number.isInteger(parsedModuleId) && parsedModuleId > 0 ? parsedModuleId : null;

    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({ message: 'Valid course and video IDs are required.' });
    }
    if (!title || !videoUrl) {
      return res.status(400).json({ message: 'Video title and video link are required.' });
    }

    const result = await pool.query(
      `
        UPDATE course_videos
        SET title = $1, video_url = $2, module_id = $3
        WHERE id = $4 AND course_id = $5
        RETURNING id, course_id, module_id, title, video_url, created_at
      `,
      [title, videoUrl, moduleId, videoId, courseId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    return res.json({
      message: 'Video updated successfully.',
      video: {
        id: result.rows[0].id,
        courseId: result.rows[0].course_id,
        moduleId: result.rows[0].module_id,
        title: result.rows[0].title,
        videoUrl: result.rows[0].video_url,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    const result = await pool.query(
      `
        SELECT
          cm.id AS module_id,
          cm.title AS module_title,
          cm.created_at AS module_created_at,
          cv.id AS video_id,
          cv.title AS video_title,
          cv.video_url,
          cv.created_at AS video_created_at
        FROM course_modules cm
        LEFT JOIN course_videos cv ON cv.module_id = cm.id
        WHERE cm.course_id = $1
        ORDER BY LOWER(cm.title) ASC, cv.created_at DESC, cv.id DESC
      `,
      [courseId]
    );
    const modules = [];
    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.module_id)) {
        const moduleItem = {
          id: row.module_id,
          title: row.module_title,
          createdAt: row.module_created_at,
          videos: [],
        };
        map.set(row.module_id, moduleItem);
        modules.push(moduleItem);
      }
      if (row.video_id) {
        map.get(row.module_id).videos.push({
          id: row.video_id,
          title: row.video_title,
          videoUrl: row.video_url,
          createdAt: row.video_created_at,
        });
      }
    }
    return res.json({
      modules,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = req.body.title?.trim();
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    if (!title) {
      return res.status(400).json({ message: 'Module title is required.' });
    }
    const result = await pool.query(
      `
        INSERT INTO course_modules (course_id, title)
        VALUES ($1, $2)
        RETURNING id, course_id, title, created_at
      `,
      [courseId, title]
    );
    return res.status(201).json({
      message: 'Module created successfully.',
      module: {
        id: result.rows[0].id,
        courseId: result.rows[0].course_id,
        title: result.rows[0].title,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/courses/:courseId/modules/:moduleId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const moduleId = Number(req.params.moduleId);
    const title = req.body.title?.trim();
    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(moduleId) || moduleId <= 0) {
      return res.status(400).json({ message: 'Valid course and module IDs are required.' });
    }
    if (!title) {
      return res.status(400).json({ message: 'Module title is required.' });
    }
    const result = await pool.query(
      `
        UPDATE course_modules
        SET title = $1
        WHERE id = $2 AND course_id = $3
        RETURNING id, course_id, title, created_at
      `,
      [title, moduleId, courseId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Module not found.' });
    }
    return res.json({ module: result.rows[0], message: 'Module updated successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/courses/:courseId/modules/:moduleId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const moduleId = Number(req.params.moduleId);
    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(moduleId) || moduleId <= 0) {
      return res.status(400).json({ message: 'Valid course and module IDs are required.' });
    }
    const result = await pool.query(
      'DELETE FROM course_modules WHERE id = $1 AND course_id = $2 RETURNING id',
      [moduleId, courseId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Module not found.' });
    }
    return res.json({ message: 'Module deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/courses/:courseId/documents', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    const result = await pool.query(
      'SELECT id, name, file_url, created_at FROM course_documents WHERE course_id = $1 ORDER BY LOWER(name) ASC, id ASC',
      [courseId]
    );
    return res.json({
      documents: result.rows.map((row) => ({ id: row.id, name: row.name, fileUrl: row.file_url, createdAt: row.created_at })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/courses/:courseId/documents', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const name = req.body.name?.trim();
    const fileUrl = req.body.fileUrl?.trim();
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    if (!name || !fileUrl) {
      return res.status(400).json({ message: 'Document name and file are required.' });
    }
    const result = await pool.query(
      `INSERT INTO course_documents (course_id, name, file_url)
       VALUES ($1, $2, $3)
       RETURNING id, name, file_url, created_at`,
      [courseId, name, fileUrl]
    );
    return res.status(201).json({
      document: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        fileUrl: result.rows[0].file_url,
        createdAt: result.rows[0].created_at,
      },
      message: 'Document uploaded successfully.',
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/courses/:courseId/documents/:documentId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const documentId = Number(req.params.documentId);
    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ message: 'Valid course and document IDs are required.' });
    }
    const result = await pool.query(
      'DELETE FROM course_documents WHERE id = $1 AND course_id = $2 RETURNING id',
      [documentId, courseId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Document not found.' });
    }
    return res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/courses/:courseId/videos/:videoId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);

    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({ message: 'Valid course and video IDs are required.' });
    }

    const result = await pool.query(
      'DELETE FROM course_videos WHERE id = $1 AND course_id = $2 RETURNING id',
      [videoId, courseId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    return res.json({ message: 'Video deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/users', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const username = req.body.username?.trim().toLowerCase();
    const password = req.body.password?.trim();
    const fullName = req.body.fullName?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const requestedRole = String(req.body.role || 'user').toLowerCase();
    const role = ['admin', 'manager', 'user'].includes(requestedRole) ? requestedRole : 'user';
    if (req.user.role === 'manager' && role !== 'user') {
      return res.status(403).json({ message: 'Managers can create learners only.' });
    }
    const profileImage = req.body.profileImage?.trim() || '';
    const assignedCourseIds = normalizeCourseIds(req.body.assignedCourseIds);

    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ message: 'Full name, username, email, and password are required.' });
    }

    if (role === 'user' && !profileImage) {
      return res.status(400).json({ message: 'Learner profile image is required.' });
    }

    await client.query('BEGIN');
    await ensureCoursesExist(assignedCourseIds, client);

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `
        INSERT INTO users (username, password_hash, full_name, role, email, profile_image)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, profile_image, full_name, role, created_at
      `,
      [username, passwordHash, fullName, role, email, profileImage || null]
    );

    const user = userResult.rows[0];

    for (const courseId of assignedCourseIds) {
      await client.query(
        `
          INSERT INTO user_courses (user_id, course_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, course_id) DO NOTHING
        `,
        [user.id, courseId]
      );
    }

    await client.query('COMMIT');

    const assignedCourses = assignedCourseIds.length
      ? await pool.query(
          'SELECT id, title FROM courses WHERE id = ANY($1::int[]) ORDER BY title',
          [assignedCourseIds]
        )
      : { rows: [] };

    return res.status(201).json({
      message: 'User created successfully.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profile_image || '',
        fullName: user.full_name,
        role: user.role,
        createdAt: user.created_at,
        courses: assignedCourses.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({ message: 'A user with this username or email already exists.' });
    }

    return next(error);
  } finally {
    client.release();
  }
});

router.put('/users/:userId', async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const username = req.body.username?.trim().toLowerCase();
    const fullName = req.body.fullName?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const requestedRole = String(req.body.role || 'user').toLowerCase();
    const role = ['admin', 'manager', 'user'].includes(requestedRole) ? requestedRole : 'user';
    const profileImage = req.body.profileImage?.trim() || '';
    const password = req.body.password?.trim() || '';

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'A valid user ID is required.' });
    }
    if (await isMasterAdminUser(userId)) {
      return res.status(403).json({ message: 'Master admin role/profile cannot be modified.' });
    }
    if (req.user.role === 'manager' && role !== 'user') {
      return res.status(403).json({ message: 'Managers can update learners only.' });
    }
    if (!username || !fullName || !email) {
      return res.status(400).json({ message: 'Full name, username, and email are required.' });
    }
    if (role === 'user' && !profileImage) {
      return res.status(400).json({ message: 'Learner profile image is required.' });
    }

    const passwordClause = password ? ', password_hash = $6' : '';
    const queryParams = password
      ? [username, fullName, email, role, userId, await bcrypt.hash(password, 10), profileImage || null]
      : [username, fullName, email, role, userId, profileImage || null];

    const result = await pool.query(
      `
        UPDATE users
        SET username = $1, full_name = $2, email = $3, role = $4${passwordClause}, profile_image = $${password ? 7 : 6}
        WHERE id = $5
        RETURNING id, username, full_name, email, profile_image, role, created_at
      `,
      queryParams
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({
      message: 'User updated successfully.',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        fullName: result.rows[0].full_name,
        email: result.rows[0].email,
        profileImage: result.rows[0].profile_image || '',
        role: result.rows[0].role,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A user with this username or email already exists.' });
    }
    return next(error);
  }
});

router.delete('/users/:userId', async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'A valid user ID is required.' });
    }
    if (await isMasterAdminUser(userId)) {
      return res.status(403).json({ message: 'Master admin cannot be deleted.' });
    }
    if (req.user.role === 'manager') {
      const targetUser = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (!targetUser.rowCount) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (targetUser.rows[0].role !== 'user') {
        return res.status(403).json({ message: 'Managers can delete learners only.' });
      }
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.put('/users/:userId/courses', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.params.userId);
    const courseIds = normalizeCourseIds(req.body.assignedCourseIds);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'A valid user ID is required.' });
    }

    const userCheck = await client.query(
      `
        SELECT id, username, full_name, role
        FROM users
        WHERE id = $1 AND role = 'user'
      `,
      [userId]
    );

    if (!userCheck.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await client.query('BEGIN');
    await ensureCoursesExist(courseIds, client);
    await client.query('DELETE FROM user_courses WHERE user_id = $1', [userId]);

    for (const courseId of courseIds) {
      await client.query(
        'INSERT INTO user_courses (user_id, course_id) VALUES ($1, $2)',
        [userId, courseId]
      );
    }

    await client.query('COMMIT');

    const assignedCourses = courseIds.length
      ? await pool.query(
          'SELECT id, title FROM courses WHERE id = ANY($1::int[]) ORDER BY title',
          [courseIds]
        )
      : { rows: [] };

    return res.json({
      message: 'User course registration updated successfully.',
      user: {
        id: userCheck.rows[0].id,
        username: userCheck.rows[0].username,
        fullName: userCheck.rows[0].full_name,
        role: userCheck.rows[0].role,
        courses: assignedCourses.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/courses', async (req, res, next) => {
  try {
    const search = req.query.search?.trim().toLowerCase() || '';
    const result = await pool.query(
      `
        SELECT
          c.id,
          c.title,
          c.description,
          c.image_url,
          c.created_at,
          COUNT(cv.id)::int AS video_count
        FROM courses c
        LEFT JOIN course_videos cv ON cv.course_id = c.id
        WHERE
          $1 = ''
          OR LOWER(c.title) LIKE '%' || $1 || '%'
          OR LOWER(c.description) LIKE '%' || $1 || '%'
        GROUP BY c.id
        ORDER BY LOWER(c.title) ASC, c.id ASC
      `,
      [search]
    );

    return res.json({
      courses: result.rows.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        imageUrl: course.image_url || '',
        createdAt: course.created_at,
        videoCount: course.video_count,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/learners', async (req, res, next) => {
  try {
    const search = req.query.search?.trim().toLowerCase() || '';
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSizeRaw = Number(req.query.pageSize) || 10;
    const pageSize = [10, 20, 50].includes(pageSizeRaw) ? pageSizeRaw : 10;
    const role = req.query.role === 'admin' || req.query.role === 'manager' ? req.query.role : 'user';
    const offset = (page - 1) * pageSize;
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.role,
          u.created_at
        FROM users u
        WHERE
          u.role = $2
          AND (
            $1 = ''
            OR LOWER(u.username) LIKE '%' || $1 || '%'
            OR LOWER(u.full_name) LIKE '%' || $1 || '%'
            OR LOWER(COALESCE(u.email, '')) LIKE '%' || $1 || '%'
          )
        ORDER BY LOWER(COALESCE(u.full_name, u.username)) ASC, u.id ASC
        LIMIT $3 OFFSET $4
      `,
      [search, role, pageSize, offset]
    );
    const totalResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM users u
        WHERE
          u.role = $2
          AND (
            $1 = ''
            OR LOWER(u.username) LIKE '%' || $1 || '%'
            OR LOWER(u.full_name) LIKE '%' || $1 || '%'
            OR LOWER(COALESCE(u.email, '')) LIKE '%' || $1 || '%'
          )
      `,
      [search, role]
    );

    return res.json({
      learners: result.rows.map((learner) => ({
        id: learner.id,
        username: learner.username,
        email: learner.email,
        fullName: learner.full_name,
        role: learner.role,
        createdAt: learner.created_at,
      })),
      pagination: {
        page,
        pageSize,
        total: totalResult.rows[0]?.total || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/courses/:courseId/learners', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }

    const result = await pool.query(
      `
        SELECT u.id, u.username, u.full_name, u.email
        FROM user_courses uc
        JOIN users u ON u.id = uc.user_id
        WHERE uc.course_id = $1
        ORDER BY u.full_name ASC
      `,
      [courseId]
    );

    return res.json({
      learners: result.rows.map((learner) => ({
        id: learner.id,
        username: learner.username,
        fullName: learner.full_name,
        email: learner.email,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/courses/:courseId/learners', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const courseId = Number(req.params.courseId);
    const learnerIds = [...new Set((Array.isArray(req.body.learnerIds) ? req.body.learnerIds : []).map(Number))]
      .filter((id) => Number.isInteger(id) && id > 0);
    const learnerEmails = [...new Set((Array.isArray(req.body.learnerEmails) ? req.body.learnerEmails : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean))];

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    if (!learnerIds.length && !learnerEmails.length) {
      return res.status(400).json({ message: 'At least one learner is required.' });
    }

    await client.query('BEGIN');
    let resolvedIds = learnerIds;
    if (learnerEmails.length) {
      const emailResult = await client.query(
        `
          SELECT id, LOWER(COALESCE(email, '')) AS email
          FROM users
          WHERE role = 'user' AND LOWER(COALESCE(email, '')) = ANY($1::text[])
        `,
        [learnerEmails]
      );
      const emailIds = emailResult.rows.map((row) => row.id);
      resolvedIds = [...new Set([...resolvedIds, ...emailIds])];
      if (emailIds.length !== learnerEmails.length) {
        const foundEmails = new Set(emailResult.rows.map((row) => row.email));
        const missingEmails = learnerEmails.filter((email) => !foundEmails.has(email));
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Learner email not found: ${missingEmails.join(', ')}` });
      }
    }
    for (const learnerId of resolvedIds) {
      await client.query(
        `
          INSERT INTO user_courses (user_id, course_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, course_id) DO NOTHING
        `,
        [learnerId, courseId]
      );
    }
    await client.query('COMMIT');
    return res.json({ message: 'Learners added to course successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.delete('/courses/:courseId/learners/:learnerId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const learnerId = Number(req.params.learnerId);
    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(learnerId) || learnerId <= 0) {
      return res.status(400).json({ message: 'Valid course and learner IDs are required.' });
    }

    await pool.query('DELETE FROM user_courses WHERE course_id = $1 AND user_id = $2', [courseId, learnerId]);
    return res.json({ message: 'Learner removed from course successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/learners/:learnerId/courses', async (req, res, next) => {
  try {
    const learnerId = Number(req.params.learnerId);
    if (!Number.isInteger(learnerId) || learnerId <= 0) {
      return res.status(400).json({ message: 'A valid learner ID is required.' });
    }

    const result = await pool.query(
      `
        SELECT c.id, c.title, c.description
        FROM user_courses uc
        JOIN courses c ON c.id = uc.course_id
        WHERE uc.user_id = $1
        ORDER BY c.title ASC
      `,
      [learnerId]
    );

    return res.json({ courses: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.delete('/learners/:learnerId/courses/:courseId', async (req, res, next) => {
  try {
    const learnerId = Number(req.params.learnerId);
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(learnerId) || learnerId <= 0 || !Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'Valid learner and course IDs are required.' });
    }

    await pool.query('DELETE FROM user_courses WHERE user_id = $1 AND course_id = $2', [learnerId, courseId]);
    return res.json({ message: 'Course removed from learner successfully.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
