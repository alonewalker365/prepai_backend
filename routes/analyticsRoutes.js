import express from 'express';
import { getDashboardStats, getMyAnalytics, getLeaderboard } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/dashboard', authorize('admin'), getDashboardStats);
router.get('/me', getMyAnalytics);
router.get('/leaderboard', getLeaderboard);

export default router;
