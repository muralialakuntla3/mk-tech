const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const config = require('./config');

const pool = config.database.connectionString
  ? new Pool({
      connectionString: config.database.connectionString,
      ssl: config.database.ssl,
    })
  : new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl,
    });

async function initDatabase() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(80) UNIQUE NOT NULL,
        email VARCHAR(160) UNIQUE,
        profile_image TEXT,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(120) UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        image_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email VARCHAR(160) UNIQUE
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_image TEXT
    `);

    await client.query(`
      ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS course_videos (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        video_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS course_modules (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE course_videos
      ADD COLUMN IF NOT EXISTS module_id INTEGER REFERENCES course_modules(id) ON DELETE SET NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_courses (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, course_id)
      )
    `);

    const masterUsername = config.masterAdmin.username?.trim().toLowerCase();
    const masterPassword = config.masterAdmin.password?.trim();
    const masterEmail = config.masterAdmin.email?.trim().toLowerCase() || null;

    if (masterUsername && masterPassword) {
      const adminCheck = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [masterUsername]
      );

      if (!adminCheck.rowCount) {
        const passwordHash = await bcrypt.hash(masterPassword, 10);

        await client.query(
          `
            INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [masterUsername, masterEmail, passwordHash, 'Master Admin', 'admin']
        );

        console.log(`Master admin created with username "${masterUsername}".`);
      }
    } else {
      console.log('MASTER_ADMIN_USERNAME or MASTER_ADMIN_PASSWORD not set. Skipping default admin creation.');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase,
};
