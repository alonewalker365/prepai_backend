import express from 'express';
import asyncHandler from 'express-async-handler';
import { Announcement } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// GET /api/announcements
router.get('/', asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.user.role !== 'admin') {
    filter.$or = [{ targetRole: 'all' }, { targetRole: req.user.role }];
    // Exclude expired
    filter.$or.push({ expiresAt: { $exists: false } });
    filter.expiresAt = { $gt: new Date() };
  }

  const announcements = await Announcement.find({ isActive: true })
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(20);

  return apiResponse(res, 200, 'Announcements fetched', announcements);
}));

// POST /api/announcements
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const announcement = await Announcement.create({
    ...req.body,
    createdBy: req.user._id,
  });
  return apiResponse(res, 201, 'Announcement created', announcement);
}));

// PUT /api/announcements/:id
router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!announcement) { res.status(404); throw new Error('Announcement not found'); }
  return apiResponse(res, 200, 'Announcement updated', announcement);
}));

// DELETE /api/announcements/:id
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  return apiResponse(res, 200, 'Announcement deleted');
}));

export default router;
