import asyncHandler from 'express-async-handler';
import { Task, Submission, Progress, Notification, User } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

// ─── Helper: notify all admins of a new submission ────────────────────────────
const notifyAdmins = async (submission, task, student, io) => {
  // Find all admin users
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');

  const notifications = admins.map(admin => ({
    recipient: admin._id,
    type: 'new_submission',
    title: 'New submission pending review',
    message: `${student.name} submitted "${task.title}" and is waiting for your review.`,
    submission: submission._id,
    task: task._id,
    student: student._id,
  }));

  const saved = await Notification.insertMany(notifications);

  // Emit real-time socket event to each admin room
  if (io) {
    admins.forEach(admin => {
      io.to(`user_${admin._id}`).emit('new_notification', {
        ...saved[0].toObject(),
        student: { _id: student._id, name: student.name, avatar: student.avatar },
        task: { _id: task._id, title: task.title, category: task.category },
      });
    });
  }
};

// @desc    Get today's tasks for student
// @route   GET /api/tasks/today
export const getTodaysTasks = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const tasks = await Task.find({
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    isPublished: true,
  }).sort({ isFeatured: -1, category: 1 });

  const taskIds = tasks.map(t => t._id);
  const submissions = await Submission.find({
    student: req.user._id,
    task: { $in: taskIds },
  }).select('task status score feedback');

  const subMap = {};
  submissions.forEach(s => { subMap[s.task.toString()] = s; });

  const tasksWithStatus = tasks.map(task => ({
    ...task.toObject(),
    submission: subMap[task._id.toString()] || null,
    userStatus: subMap[task._id.toString()]?.status || 'pending',
  }));

  return apiResponse(res, 200, "Today's tasks fetched", tasksWithStatus);
});

// @desc    Get all tasks
// @route   GET /api/tasks
export const getTasks = asyncHandler(async (req, res) => {
  const { category, difficulty, topic, date, page = 1, limit = 20, search } = req.query;

  const filter = {};
  if (req.user.role !== 'admin') filter.isPublished = true;
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (topic) filter.topic = { $regex: topic, $options: 'i' };
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (date) {
    const d = new Date(date);
    filter.scheduledDate = {
      $gte: new Date(d.setHours(0, 0, 0, 0)),
      $lte: new Date(d.setHours(23, 59, 59, 999)),
    };
  }

  const skip = (page - 1) * limit;
  const [tasks, total] = await Promise.all([
    Task.find(filter).populate('createdBy', 'name').sort({ scheduledDate: -1 }).skip(skip).limit(Number(limit)),
    Task.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Tasks fetched', {
    tasks,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
export const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate('createdBy', 'name');
  if (!task) { res.status(404); throw new Error('Task not found'); }

  let submission = null;
  if (req.user.role === 'student') {
    submission = await Submission.findOne({ student: req.user._id, task: task._id });
  }

  return apiResponse(res, 200, 'Task fetched', { ...task.toObject(), submission });
});

// @desc    Create task (admin)
// @route   POST /api/tasks
export const createTask = asyncHandler(async (req, res) => {
  const task = await Task.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Task created', task);
});

// @desc    Update task (admin)
// @route   PUT /api/tasks/:id
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!task) { res.status(404); throw new Error('Task not found'); }
  return apiResponse(res, 200, 'Task updated', task);
});

// @desc    Delete task (admin)
// @route   DELETE /api/tasks/:id
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) { res.status(404); throw new Error('Task not found'); }
  await Submission.deleteMany({ task: req.params.id });
  await Notification.deleteMany({ task: req.params.id });
  return apiResponse(res, 200, 'Task deleted');
});

// @desc    Submit task answer — sets status to 'under_review', notifies admins
// @route   POST /api/tasks/:id/submit
export const submitTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) { res.status(404); throw new Error('Task not found'); }
  if (!task.isPublished) { res.status(400); throw new Error('Task is not available'); }

  // Prevent duplicate submissions
  const existing = await Submission.findOne({ student: req.user._id, task: task._id });
  if (existing) {
    res.status(400);
    throw new Error('You have already submitted this task. Await admin review.');
  }

  if (!req.body.content?.trim()) {
    res.status(400);
    throw new Error('Answer content is required');
  }

  // Create submission — status starts as 'under_review' (NOT completed)
  const submission = await Submission.create({
    student: req.user._id,
    task: task._id,
    content: req.body.content.trim(),
    fileUrl: req.body.fileUrl || '',
    timeTaken: req.body.timeTaken || 0,
    status: 'under_review',
    submittedAt: new Date(),
  });

  // Increment task submission count
  await Task.findByIdAndUpdate(task._id, { $inc: { submissionCount: 1 } });

  // Notify all admins (socket + DB)
  const io = req.app.get('io');
  await notifyAdmins(submission, task, req.user, io);

  // Populate for response
  const populated = await Submission.findById(submission._id)
    .populate('task', 'title category difficulty points');

  return apiResponse(res, 201, 'Answer submitted! Waiting for admin review.', populated);
});
