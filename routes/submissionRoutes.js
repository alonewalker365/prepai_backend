import express from 'express';
import asyncHandler from 'express-async-handler';
import { Submission, User, Progress, Notification } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// ─── GET /api/submissions ─────────────────────────────────────────────────────
// Admin sees all; student sees only their own
router.get('/', asyncHandler(async (req, res) => {
  const { status, taskId, studentId, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'student') {
    filter.student = req.user._id;
  } else {
    if (studentId) filter.student = studentId;
  }
  if (status) filter.status = status;
  if (taskId) filter.task = taskId;

  const skip = (Number(page) - 1) * Number(limit);
  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('student', 'name email avatar')
      .populate('task', 'title category difficulty points')
      .populate('reviewedBy', 'name')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Submission.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Submissions fetched', {
    submissions,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
}));

// ─── GET /api/submissions/:id ─────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('student', 'name email avatar')
    .populate('task', 'title category difficulty content points')
    .populate('reviewedBy', 'name avatar');

  if (!submission) { res.status(404); throw new Error('Submission not found'); }

  if (req.user.role === 'student' && submission.student._id.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Access denied');
  }

  return apiResponse(res, 200, 'Submission fetched', submission);
}));

// ─── PUT /api/submissions/:id/review  (admin only) ────────────────────────────
// action: 'accept' → status=completed, points awarded
// action: 'reject' → status=rejected, no points
router.put('/:id/review', authorize('admin'), asyncHandler(async (req, res) => {
  const { action, feedback, score } = req.body;

  if (!action || !['accept', 'reject'].includes(action)) {
    res.status(400); throw new Error("action must be 'accept' or 'reject'");
  }
  if (!feedback?.trim()) {
    res.status(400); throw new Error('Feedback is required before reviewing');
  }

  const submission = await Submission.findById(req.params.id)
    .populate('student', 'name email avatar')
    .populate('task', 'title category points');

  if (!submission) { res.status(404); throw new Error('Submission not found'); }
  if (submission.status !== 'under_review') {
    res.status(400); throw new Error('This submission has already been reviewed');
  }

  const newStatus = action === 'accept' ? 'completed' : 'rejected';

  // Update submission
  submission.status = newStatus;
  submission.feedback = feedback.trim();
  submission.score = score ? Number(score) : undefined;
  submission.reviewedBy = req.user._id;
  submission.reviewedAt = new Date();
  await submission.save();

  const io = req.app.get('io');

  if (action === 'accept') {
    // ✅ Award points to student
    const points = submission.task?.points || 0;
    await User.findByIdAndUpdate(submission.student._id, {
      $inc: { totalPoints: points },
    });

    // ✅ Mark task as completed in Progress
    await Progress.findOneAndUpdate(
      { student: submission.student._id },
      {
        $addToSet: { tasksCompleted: submission.task._id },
        $inc: { totalTasksCompleted: 1, totalPoints: points },
      },
      { upsert: true }
    );

    // ✅ Notify student: accepted
    const notif = await Notification.create({
      recipient: submission.student._id,
      type: 'submission_accepted',
      title: '✅ Answer Accepted!',
      message: `Your answer for "${submission.task.title}" was accepted by the admin. You earned ${points} points! Feedback: ${feedback}`,
      submission: submission._id,
      task: submission.task._id,
    });

    // Real-time socket to student
    if (io) {
      io.to(`user_${submission.student._id}`).emit('new_notification', {
        ...notif.toObject(),
        task: { _id: submission.task._id, title: submission.task.title },
      });
      io.to(`user_${submission.student._id}`).emit('submission_reviewed', {
        submissionId: submission._id,
        taskId: submission.task._id,
        status: 'completed',
        feedback,
        score: submission.score,
        pointsEarned: points,
      });
    }
  } else {
    // ❌ Notify student: rejected
    const notif = await Notification.create({
      recipient: submission.student._id,
      type: 'submission_rejected',
      title: '❌ Answer Needs Revision',
      message: `Your answer for "${submission.task.title}" needs improvement. Admin feedback: ${feedback}`,
      submission: submission._id,
      task: submission.task._id,
    });

    if (io) {
      io.to(`user_${submission.student._id}`).emit('new_notification', {
        ...notif.toObject(),
        task: { _id: submission.task._id, title: submission.task.title },
      });
      io.to(`user_${submission.student._id}`).emit('submission_reviewed', {
        submissionId: submission._id,
        taskId: submission.task._id,
        status: 'rejected',
        feedback,
      });
    }
  }

  // Mark the admin's notification for this submission as read
  await Notification.updateMany(
    { submission: submission._id, recipient: req.user._id },
    { isRead: true, readAt: new Date() }
  );

  return apiResponse(res, 200, `Submission ${action === 'accept' ? 'accepted' : 'rejected'} successfully`, {
    submission,
    action,
    pointsAwarded: action === 'accept' ? (submission.task?.points || 0) : 0,
  });
}));

export default router;
