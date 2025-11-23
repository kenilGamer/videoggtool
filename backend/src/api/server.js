/**
 * Express REST API server
 */

import express from 'express';
import * as dotenv from 'dotenv';
import routes from './routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Routes - mount at /api to match frontend proxy
app.use('/api', routes);
// Also support direct routes for backward compatibility
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
// Always start when this file is executed directly (not imported as a module)
app.listen(PORT, () => {
  console.log(`🚀 Video generation API server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎬 Generate endpoint: POST http://localhost:${PORT}/api/generate`);
});

export default app;

