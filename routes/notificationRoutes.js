import express from 'express';
import asyncHandler from 'express-async-handler';
import { Notification } from '../models/index.js';
import { protect } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// GET /api/notifications — fetch user's notifications
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const filter = { recipient: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;

  const skip = (Number(page) - 1) * Number(limit);
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('task', 'title category difficulty')
      .populate('student', 'name avatar')
      .populate('submission', 'status score feedback content')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  return apiResponse(res, 200, 'Notifications fetched', {
    notifications,
    unreadCount,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
}));

// GET /api/notifications/unread-count
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  return apiResponse(res, 200, 'Unread count', { count });
}));

// PUT /api/notifications/:id/read — mark single notification read
router.put('/:id/read', asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notif) { res.status(404); throw new Error('Notification not found'); }
  return apiResponse(res, 200, 'Marked as read', notif);
}));

// PUT /api/notifications/mark-all-read — mark all read
router.put('/mark-all-read', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return apiResponse(res, 200, 'All notifications marked as read');
}));

// DELETE /api/notifications/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  return apiResponse(res, 200, 'Notification deleted');
}));

export default router;
