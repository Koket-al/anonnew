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

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
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
  origin: clientOrigin,
  credentials: true
}));

app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);

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
      console.log(`[Server] Allowed CORS Origin: ${clientOrigin}`);
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
