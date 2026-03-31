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
    await initDatabase();

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
