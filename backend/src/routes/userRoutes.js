const express = require('express');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('user'));

router.get('/courses', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          c.id AS course_id,
          c.title AS course_title,
          c.description,
          c.image_url,
          cm.id AS module_id,
          cm.title AS module_title,
          cv.id AS video_id,
          cv.title AS video_title,
          cv.video_url,
          cv.created_at AS video_created_at
        FROM user_courses uc
        JOIN courses c ON c.id = uc.course_id
        LEFT JOIN course_videos cv ON cv.course_id = c.id
        LEFT JOIN course_modules cm ON cm.id = cv.module_id
        WHERE uc.user_id = $1
        ORDER BY c.title ASC, cm.created_at DESC NULLS LAST, cv.created_at DESC, cv.id DESC
      `,
      [req.user.id]
    );

    const courses = [];
    const courseMap = new Map();

    for (const row of result.rows) {
      if (!courseMap.has(row.course_id)) {
        const course = {
          id: row.course_id,
          title: row.course_title,
          description: row.description,
          imageUrl: row.image_url || '',
          modules: [],
          videos: [],
        };

        courseMap.set(row.course_id, course);
        courses.push(course);
      }

      if (row.video_id) {
        const videoItem = {
          id: row.video_id,
          title: row.video_title,
          videoUrl: row.video_url,
          moduleId: row.module_id,
          createdAt: row.video_created_at,
        };
        const course = courseMap.get(row.course_id);
        if (row.module_id) {
          let moduleEntry = course.modules.find((item) => item.id === row.module_id);
          if (!moduleEntry) {
            moduleEntry = { id: row.module_id, title: row.module_title, videos: [] };
            course.modules.push(moduleEntry);
          }
          moduleEntry.videos.push(videoItem);
        } else {
          course.videos.push(videoItem);
        }
      }
    }

    const courseIds = courses.map((course) => course.id);
    if (courseIds.length) {
      const docsResult = await pool.query(
        `
          SELECT id, course_id, name, file_url, created_at
          FROM course_documents
          WHERE course_id = ANY($1::int[])
          ORDER BY LOWER(name) ASC, id ASC
        `,
        [courseIds]
      );
      const docsByCourse = new Map();
      for (const row of docsResult.rows) {
        if (!docsByCourse.has(row.course_id)) docsByCourse.set(row.course_id, []);
        docsByCourse.get(row.course_id).push({
          id: row.id,
          name: row.name,
          fileUrl: row.file_url,
          createdAt: row.created_at,
        });
      }
      for (const course of courses) {
        course.documents = docsByCourse.get(course.id) || [];
      }
    }

    return res.json({ courses });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
