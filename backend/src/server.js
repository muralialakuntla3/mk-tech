const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initDatabase } = require('./db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(cors());
app.use(express.json());

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function initDatabaseWithRetry(maxRetries = 15, retryDelayMs = 3000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await initDatabase();
      console.log('Database connection established.');
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `Database connection attempt ${attempt}/${maxRetries} failed: ${error?.message || error}`
      );

      if (attempt < maxRetries) {
        await wait(retryDelayMs);
      }
    }
  }

  throw lastError;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'mk-tech-backend' });
});

app.get('/api/status', (req, res) => {
  res.json({ success: true, message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).json({
    message: error.message || 'Internal server error.',
  });
});

async function startServer() {
  try {
    await initDatabaseWithRetry();

    app.listen(config.port, () => {
      console.log(`Backend API is running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error?.message || error);
    console.error('Make sure PostgreSQL is running and the DATABASE_URL/PG* settings are correct.');
    process.exit(1);
  }
}

startServer();
