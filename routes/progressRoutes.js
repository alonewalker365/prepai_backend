import express from 'express';
import asyncHandler from 'express-async-handler';
import { Progress } from '../models/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// GET /api/progress/me
router.get('/me', asyncHandler(async (req, res) => {
  let progress = await Progress.findOne({ student: req.user._id })
    .populate('coursesEnrolled.course', 'title thumbnail totalLessons category')
    .populate('tasksCompleted', 'title category difficulty');

  // Create if missing
  if (!progress) {
    progress = await Progress.create({ student: req.user._id });
  }

  return apiResponse(res, 200, 'Progress fetched', progress);
}));

// GET /api/progress/:userId  (admin)
router.get('/:userId', asyncHandler(async (req, res) => {
  const progress = await Progress.findOne({ student: req.params.userId })
    .populate('coursesEnrolled.course', 'title thumbnail totalLessons');

  return apiResponse(res, 200, 'Progress fetched', progress);
}));

export default router;
