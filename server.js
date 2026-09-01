const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./server/routes/auth');
const userRoutes = require('./server/routes/users');
const challanRoutes = require('./server/routes/challans');
const inventoryRoutes = require('./server/routes/inventory');
const historyRoutes = require('./server/routes/history');

const app = express();
const PORT = process.env.PORT || 5000;

const { connectDB } = require('./server/db');

// Middleware
app.use(cors());
app.use(express.json());

// Database connection middleware for all API routes
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[API Error] Database connection failed:', err.message);
    res.status(503).json({ 
      error: `MongoDB Atlas connection error: ${err.message}` 
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/history', historyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend static files (React Vite build dist & fallbacks)
const rootDistPath = path.join(__dirname, 'dist');
const clientDistPath = path.join(__dirname, 'client/dist');

if (fs.existsSync(rootDistPath)) {
  app.use(express.static(rootDistPath));
} else if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Fallback index.html for SPA routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  if (fs.existsSync(path.join(rootDistPath, 'index.html'))) {
    return res.sendFile(path.join(rootDistPath, 'index.html'));
  }
  if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Shubh Sajawat Fullstack Server running on http://localhost:${PORT}`);
    console.log(`API Endpoints mounted at http://localhost:${PORT}/api/`);
    console.log(`====================================================`);
  });

  process.on('SIGTERM', () => server.close());
  process.on('SIGINT', () => server.close());
}

module.exports = app;
