const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

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
        COALESCE(
          json_agg(
            json_build_object(
              'id', cv.id,
              'title', cv.title,
              'videoUrl', cv.video_url,
              'createdAt', cv.created_at
            )
            ORDER BY cv.id
          ) FILTER (WHERE cv.id IS NOT NULL),
          '[]'::json
        ) AS videos
      FROM courses c
      LEFT JOIN course_videos cv ON cv.course_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC, c.id DESC
    `),
    pool.query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'title', c.title
            )
            ORDER BY c.title
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) AS courses
      FROM users u
      LEFT JOIN user_courses uc ON uc.user_id = u.id
      LEFT JOIN courses c ON c.id = uc.course_id
      WHERE u.role = 'user'
      GROUP BY u.id
      ORDER BY u.created_at DESC, u.id DESC
    `),
  ]);

  return {
    courses: coursesResult.rows.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      imageUrl: course.image_url || '',
      createdAt: course.created_at,
      videos: Array.isArray(course.videos) ? course.videos : [],
    })),
    users: usersResult.rows.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at,
      courses: Array.isArray(user.courses) ? user.courses : [],
    })),
  };
}

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

    if (!title) {
      return res.status(400).json({ message: 'Course title is required.' });
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

    if (!title) {
      return res.status(400).json({ message: 'Course title is required.' });
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
        INSERT INTO course_videos (course_id, title, video_url)
        VALUES ($1, $2, $3)
        RETURNING id, course_id, title, video_url, created_at
      `,
      [courseId, title, videoUrl]
    );

    return res.status(201).json({
      message: 'Video added to course successfully.',
      video: {
        id: result.rows[0].id,
        courseId: result.rows[0].course_id,
        title: result.rows[0].title,
        videoUrl: result.rows[0].video_url,
        createdAt: result.rows[0].created_at,
      },
    });
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
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    const assignedCourseIds = normalizeCourseIds(req.body.assignedCourseIds);

    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ message: 'Full name, username, email, and password are required.' });
    }

    await client.query('BEGIN');
    await ensureCoursesExist(assignedCourseIds, client);

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `
        INSERT INTO users (username, password_hash, full_name, role, email)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, full_name, role, created_at
      `,
      [username, passwordHash, fullName, role, email]
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
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'A valid user ID is required.' });
    }
    if (!username || !fullName || !email) {
      return res.status(400).json({ message: 'Full name, username, and email are required.' });
    }

    const result = await pool.query(
      `
        UPDATE users
        SET username = $1, full_name = $2, email = $3, role = $4
        WHERE id = $5
        RETURNING id, username, full_name, email, role, created_at
      `,
      [username, fullName, email, role, userId]
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
        ORDER BY c.created_at DESC, c.id DESC
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
          u.role = 'user'
          AND (
            $1 = ''
            OR LOWER(u.username) LIKE '%' || $1 || '%'
            OR LOWER(u.full_name) LIKE '%' || $1 || '%'
            OR LOWER(COALESCE(u.email, '')) LIKE '%' || $1 || '%'
          )
        ORDER BY u.created_at DESC, u.id DESC
      `,
      [search]
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

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ message: 'A valid course ID is required.' });
    }
    if (!learnerIds.length) {
      return res.status(400).json({ message: 'At least one learner is required.' });
    }

    await client.query('BEGIN');
    for (const learnerId of learnerIds) {
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
