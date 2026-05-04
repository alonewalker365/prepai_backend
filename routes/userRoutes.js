import express from 'express';
import asyncHandler from 'express-async-handler';
import { User, Submission, Progress } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect, authorize('admin'));

// GET /api/users
router.get('/', asyncHandler(async (req, res) => {
  const { search, role, isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined && isActive !== '') filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Users fetched', {
    users,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
}));

// GET /api/users/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) { res.status(404); throw new Error('User not found'); }

  const [submissions, progress] = await Promise.all([
    Submission.find({ student: req.params.id }).populate('task', 'title category difficulty').sort({ submittedAt: -1 }).limit(10),
    Progress.findOne({ student: req.params.id }),
  ]);

  return apiResponse(res, 200, 'User fetched', { user, submissions, progress });
}));

// PUT /api/users/:id/status
router.put('/:id/status', asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  ).select('-password');

  if (!user) { res.status(404); throw new Error('User not found'); }
  return apiResponse(res, 200, `User ${isActive ? 'activated' : 'deactivated'}`, user);
}));

// PUT /api/users/:id/role (promote/demote)
router.put('/:id/role', asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['student', 'admin', 'interviewer'].includes(role)) {
    res.status(400); throw new Error('Invalid role');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
  return apiResponse(res, 200, 'User role updated', user);
}));

export default router;
