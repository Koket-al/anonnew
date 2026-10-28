import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';

import { connectDB } from './config/db.js';
import { setupSocketIO } from './socket/socketHandler.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import postRoutes from './routes/postRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import listeningRoomRoutes from './routes/listeningRoomRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import professionalRoutes from './routes/professionalRoutes.js';
import moderationRoutes from './routes/moderationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// ── Production secret validation ─────────────────────────────────────────────
// Fail fast if required secrets are missing or clearly unsafe in production.
if (process.env.NODE_ENV === 'production') {
  const requiredSecrets = ['JWT_SECRET', 'SESSION_SECRET'];
  const insecureDefaults = [
    'dev_jwt_secret_replace_in_production_32bytes_min',
    'dev_session_secret_replace_in_production_32bytes_min'
  ];

  for (const key of requiredSecrets) {
    const value = process.env[key];
    if (!value || value.length < 32) {
      console.error(`[FATAL] ${key} is missing or too short (< 32 chars). Server refuses to start in production without a secure secret.`);
      process.exit(1);
    }
    if (insecureDefaults.includes(value)) {
      console.error(`[FATAL] ${key} is set to a known public development default. Replace it with a cryptographically strong production secret.`);
      process.exit(1);
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

const rawClientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawClientOrigin
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true
  }
});
app.set('io', io);
setupSocketIO(io);

// Security & Parsing Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: (origin, callback) => {
    // Explicitly reject null origin (sandboxed iframes, file://, data URIs)
    if (origin === 'null') {
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      return callback(err);
    }
    // Allow non-browser requests (e.g. mobile, tests, curl without Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const err = new Error('Not allowed by CORS');
    err.status = 403;
    return callback(err);
  },
  credentials: true
}));

app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);

// CSRF Origin & Cross-Site validation for state-changing browser requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      if (origin === 'null' || !allowedOrigins.includes(origin)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Cross-site request rejected.'
        });
      }
    } else {
      // Missing origin: check if request is browser cross-site
      const secFetchSite = req.headers['sec-fetch-site'];
      if (secFetchSite === 'cross-site') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Cross-site request rejected.'
        });
      }

      if (req.headers.referer) {
        try {
          const refererOrigin = new URL(req.headers.referer).origin;
          if (!allowedOrigins.includes(refererOrigin)) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden: Cross-site referer rejected.'
            });
          }
        } catch {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Invalid referer header.'
          });
        }
      }
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ANON Backend API'
  });
});

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/listening-rooms', listeningRoomRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`[Server] ANON API running on http://localhost:${PORT}`);
      console.log(`[Server] Allowed CORS Origin: ${allowedOrigins.join(', ')}`);
      resolve(server);
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Gracefully shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, startServer };
