import asyncHandler from 'express-async-handler';
import { HRTask, HRSubmission, User, Notification } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

// ─── ADMIN: Create HR Task ────────────────────────────────────────────────────
export const createHRTask = asyncHandler(async (req, res) => {
  const task = await HRTask.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'HR Task created', task);
});

// ─── ADMIN: Update HR Task ────────────────────────────────────────────────────
export const updateHRTask = asyncHandler(async (req, res) => {
  const task = await HRTask.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!task) { res.status(404); throw new Error('Task not found'); }
  return apiResponse(res, 200, 'HR Task updated', task);
});

// ─── ADMIN: Delete HR Task ────────────────────────────────────────────────────
export const deleteHRTask = asyncHandler(async (req, res) => {
  await HRTask.findByIdAndDelete(req.params.id);
  await HRSubmission.deleteMany({ task: req.params.id });
  return apiResponse(res, 200, 'HR Task deleted');
});

// ─── STUDENT: Get all published HR tasks ─────────────────────────────────────
export const getHRTasks = asyncHandler(async (req, res) => {
  const { category, difficulty, search } = req.query;
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const tasks = await HRTask.find(filter).populate('createdBy', 'name').sort({ createdAt: -1 });

  // Attach student's own submission status
  const taskIds = tasks.map(t => t._id);
  const mySubmissions = await HRSubmission.find({
    student: req.user._id, task: { $in: taskIds },
  }).select('task status totalScore');

  const subMap = {};
  mySubmissions.forEach(s => { subMap[s.task.toString()] = s; });

  const enriched = tasks.map(t => ({
    ...t.toObject(),
    mySubmission: subMap[t._id.toString()] || null,
  }));

  return apiResponse(res, 200, 'HR Tasks fetched', enriched);
});

// ─── STUDENT: Get single HR task ─────────────────────────────────────────────
export const getHRTaskById = asyncHandler(async (req, res) => {
  const task = await HRTask.findById(req.params.id);
  if (!task) { res.status(404); throw new Error('Task not found'); }

  const mySubmission = await HRSubmission.findOne({
    student: req.user._id, task: task._id,
  });

  return apiResponse(res, 200, 'Task fetched', { ...task.toObject(), mySubmission });
});

// ─── STUDENT: Submit HR answer ────────────────────────────────────────────────
export const submitHRAnswer = asyncHandler(async (req, res) => {
  const { answer } = req.body;
  if (!answer?.trim()) { res.status(400); throw new Error('Answer is required'); }

  const task = await HRTask.findById(req.params.id);
  if (!task) { res.status(404); throw new Error('Task not found'); }

  // Allow re-submission only if previous was rejected (or no submission)
  const existing = await HRSubmission.findOne({ student: req.user._id, task: task._id });
  if (existing && existing.status !== 'reviewed') {
    res.status(400);
    throw new Error('You already have a submission pending review');
  }

  const submission = existing
    ? await HRSubmission.findByIdAndUpdate(existing._id,
        { answer: answer.trim(), status: 'under_review', submittedAt: new Date(), totalScore: undefined, overallFeedback: undefined, reviewedBy: undefined, reviewedAt: undefined },
        { new: true })
    : await HRSubmission.create({ student: req.user._id, task: task._id, answer: answer.trim() });

  // Notify admins
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Notification.insertMany(admins.map(a => ({
    recipient: a._id,
    type: 'new_submission',
    title: 'New HR Answer — needs review',
    message: `${req.user.name} submitted an answer for "${task.title}"`,
    submission: submission._id,
    task: task._id,
    student: req.user._id,
  })));

  const io = req.app.get('io');
  if (io) {
    admins.forEach(a => {
      io.to(`user_${a._id}`).emit('new_notification', {
        type: 'new_submission',
        title: 'New HR Answer — needs review',
        message: `${req.user.name} submitted "${task.title}"`,
        student: { _id: req.user._id, name: req.user.name },
        task: { _id: task._id, title: task.title },
      });
    });
  }

  return apiResponse(res, 201, 'Answer submitted! Waiting for admin review.', submission);
});

// ─── ADMIN: Get all HR submissions (monitoring) ───────────────────────────────
export const getAllHRSubmissions = asyncHandler(async (req, res) => {
  const { taskId, studentId, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (taskId) filter.task = taskId;
  if (studentId) filter.student = studentId;
  if (status) filter.status = status;

  const [submissions, total] = await Promise.all([
    HRSubmission.find(filter)
      .populate('student', 'name email avatar')
      .populate('task', 'title category difficulty maxPoints rubric')
      .populate('reviewedBy', 'name')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit)),
    HRSubmission.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Submissions fetched', {
    submissions,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

// ─── ADMIN: Review & score HR submission ──────────────────────────────────────
export const reviewHRSubmission = asyncHandler(async (req, res) => {
  const { rubricScores, overallFeedback } = req.body;

  if (!overallFeedback?.trim()) {
    res.status(400); throw new Error('Overall feedback is required');
  }

  const submission = await HRSubmission.findById(req.params.id)
    .populate('student', 'name email')
    .populate('task', 'title maxPoints rubric');

  if (!submission) { res.status(404); throw new Error('Submission not found'); }

  // Calculate total score from rubric
  const totalScore = rubricScores
    ? rubricScores.reduce((sum, r) => sum + (r.score || 0), 0)
    : 0;

  submission.rubricScores = rubricScores || [];
  submission.totalScore = totalScore;
  submission.overallFeedback = overallFeedback.trim();
  submission.reviewedBy = req.user._id;
  submission.reviewedAt = new Date();
  submission.status = 'reviewed';
  await submission.save();

  // Award points
  if (totalScore > 0) {
    await User.findByIdAndUpdate(submission.student._id, { $inc: { totalPoints: totalScore } });
  }

  // Notify student
  const notif = await Notification.create({
    recipient: submission.student._id,
    type: 'submission_accepted',
    title: '📝 HR Answer Reviewed',
    message: `Your answer for "${submission.task.title}" has been reviewed. Score: ${totalScore}/${submission.task.maxPoints}. Feedback: ${overallFeedback}`,
    submission: submission._id,
    task: submission.task._id,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`user_${submission.student._id}`).emit('new_notification', notif.toObject());
    io.to(`user_${submission.student._id}`).emit('submission_reviewed', {
      submissionId: submission._id,
      taskId: submission.task._id,
      status: 'reviewed',
      score: totalScore,
      feedback: overallFeedback,
    });
  }

  return apiResponse(res, 200, 'HR submission reviewed', { submission, totalScore });
});
