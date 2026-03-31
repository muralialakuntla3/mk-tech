require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'mk-tech-dev-secret',
  masterAdmin: {
    username: process.env.MASTER_ADMIN_USERNAME || '',
    password: process.env.MASTER_ADMIN_PASSWORD || '',
  },
  database: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'mk_tech',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  },
};

module.exports = config;
