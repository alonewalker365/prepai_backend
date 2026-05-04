import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import authRoutes           from './routes/authRoutes.js';
import taskRoutes           from './routes/taskRoutes.js';
import courseRoutes         from './routes/courseRoutes.js';
import submissionRoutes     from './routes/submissionRoutes.js';
import userRoutes           from './routes/userRoutes.js';
import progressRoutes       from './routes/progressRoutes.js';
import interviewRoutes      from './routes/interviewRoutes.js';
import announcementRoutes   from './routes/announcementRoutes.js';
import analyticsRoutes      from './routes/analyticsRoutes.js';
import codingRoutes         from './routes/codingRoutes.js';
import quizRoutes           from './routes/quizRoutes.js';
import notificationRoutes   from './routes/notificationRoutes.js';
import aptitudeRoutes       from './routes/aptitudeRoutes.js';
import codingProblemRoutes  from './routes/codingProblemRoutes.js';
import hrRoutes             from './routes/hrRoutes.js';

dotenv.config();
connectDB();

const app = express();
const httpServer = createServer(app);

// ─── Socket.io setup ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Authenticate socket connections with JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins their personal room for targeted notifications
  socket.join(`user_${socket.userId}`);
  console.log(`✅ Socket connected: user_${socket.userId}`);

  // Live interview session support
  socket.on('join-interview', (sessionId) => {
    socket.join(sessionId);
    io.to(sessionId).emit('user-joined', { socketId: socket.id });
  });

  socket.on('interview-message', ({ sessionId, message }) => {
    io.to(sessionId).emit('interview-message', message);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: user_${socket.userId}`);
  });
});

// Expose io to all route handlers via req.app.get('io')
app.set('io', io);

// ─── Rate limiters ───────────────────────────────────────────────────────────
const limiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });

// ─── Core middleware ─────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', limiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',           authLimiter, authRoutes);
app.use('/api/tasks',          taskRoutes);
app.use('/api/courses',        courseRoutes);
app.use('/api/submissions',    submissionRoutes);
app.use('/api/users',          userRoutes);
app.use('/api/progress',       progressRoutes);
app.use('/api/interview',      interviewRoutes);
app.use('/api/announcements',  announcementRoutes);
app.use('/api/analytics',      analyticsRoutes);
app.use('/api/coding',         codingRoutes);
app.use('/api/quiz',           quizRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/aptitude',       aptitudeRoutes);
app.use('/api/problems',       codingProblemRoutes);
app.use('/api/hr',             hrRoutes);

app.get('/api/health', (_, res) => res.json({
  status: 'OK',
  timestamp: new Date().toISOString(),
  uptime: Math.round(process.uptime()),
}));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 PrepWise AI — http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]\n`);
});

export default app;
