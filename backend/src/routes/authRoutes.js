const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const identifier = req.body.identifier?.trim() || req.body.username?.trim();
    const password = req.body.password?.trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Username/email and password are required.' });
    }

    const result = await pool.query(
      `
        SELECT id, username, email, profile_image, password_hash, full_name, role
        FROM users
        WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(email, '')) = LOWER($1)
      `,
      [identifier]
    );

    if (!result.rowCount) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profile_image || '',
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, username, email, profile_image, full_name, role, created_at
        FROM users
        WHERE id = $1
      `,
      [req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profile_image || '',
        fullName: user.full_name,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const username = req.body.username?.trim().toLowerCase();
    const fullName = req.body.fullName?.trim();
    const profileImage = req.body.profileImage?.trim() || '';

    if (!username || !fullName) {
      return res.status(400).json({ message: 'Username and full name are required.' });
    }

    const userResult = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (userResult.rows[0].role === 'user' && !profileImage) {
      return res.status(400).json({ message: 'Learner profile image is required.' });
    }

    const result = await pool.query(
      `
        UPDATE users
        SET username = $1, full_name = $2, profile_image = $3
        WHERE id = $4
        RETURNING id, username, email, profile_image, full_name, role
      `,
      [username, fullName, profileImage || null, req.user.id]
    );

    return res.json({
      message: 'Profile updated successfully.',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        profileImage: result.rows[0].profile_image || '',
        fullName: result.rows[0].full_name,
        role: result.rows[0].role,
      },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username is already in use.' });
    }
    return next(error);
  }
});

router.put('/me/password', authenticate, async (req, res, next) => {
  try {
    const currentPassword = req.body.currentPassword?.trim();
    const newPassword = req.body.newPassword?.trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ message: 'New password must be at least 4 characters.' });
    }

    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!userResult.rowCount) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [nextHash, req.user.id]);
    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
