// ─── courseRoutes.js ─────────────────────────────────────────────────────────
import express from 'express';
import asyncHandler from 'express-async-handler';
import { Course, Progress } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const courseRouter = express.Router();
courseRouter.use(protect);

courseRouter.get('/', asyncHandler(async (req, res) => {
  const { category, level, search, page = 1, limit = 12 } = req.query;
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (search) filter.title = { $regex: search, $options: 'i' };
  const [courses, total] = await Promise.all([
    Course.find(filter).populate('createdBy', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Course.countDocuments(filter),
  ]);
  return apiResponse(res, 200, 'Courses fetched', { courses, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
}));

courseRouter.get('/:id', asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('createdBy', 'name');
  if (!course) { res.status(404); throw new Error('Course not found'); }
  let userProgress = null;
  if (req.user.role === 'student') {
    const progress = await Progress.findOne({ student: req.user._id });
    userProgress = progress?.coursesEnrolled.find(e => e.course.toString() === req.params.id) || null;
  }
  return apiResponse(res, 200, 'Course fetched', { ...course.toObject(), userProgress });
}));

courseRouter.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const course = await Course.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Course created', course);
}));

courseRouter.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
  return apiResponse(res, 200, 'Course updated', course);
}));

courseRouter.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  await Course.findByIdAndDelete(req.params.id);
  return apiResponse(res, 200, 'Course deleted');
}));

courseRouter.post('/:id/enroll', authorize('student'), asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) { res.status(404); throw new Error('Course not found'); }
  const progress = await Progress.findOne({ student: req.user._id });
  const alreadyEnrolled = progress?.coursesEnrolled.some(e => e.course.toString() === req.params.id);
  if (alreadyEnrolled) { res.status(400); throw new Error('Already enrolled'); }
  await Progress.findOneAndUpdate({ student: req.user._id }, { $push: { coursesEnrolled: { course: req.params.id } } });
  await Course.findByIdAndUpdate(req.params.id, { $inc: { enrolledCount: 1 } });
  return apiResponse(res, 200, 'Enrolled successfully');
}));

courseRouter.put('/:id/progress', authorize('student'), asyncHandler(async (req, res) => {
  const { lessonId, completionPercentage } = req.body;
  await Progress.findOneAndUpdate(
    { student: req.user._id, 'coursesEnrolled.course': req.params.id },
    {
      $addToSet: { 'coursesEnrolled.$.completedLessons': lessonId },
      $set: { 'coursesEnrolled.$.completionPercentage': completionPercentage, 'coursesEnrolled.$.lastAccessedAt': new Date() },
    }
  );
  return apiResponse(res, 200, 'Progress updated');
}));

export { courseRouter };

// ─── userRoutes.js ────────────────────────────────────────────────────────────
import { User, Submission } from '../models/index.js';

const userRouter = express.Router();
userRouter.use(protect, authorize('admin'));

userRouter.get('/', asyncHandler(async (req, res) => {
  const { search, role, isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    User.countDocuments(filter),
  ]);
  return apiResponse(res, 200, 'Users fetched', { users, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
}));

userRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) { res.status(404); throw new Error('User not found'); }
  const submissions = await Submission.find({ student: req.params.id }).populate('task', 'title category').sort({ submittedAt: -1 }).limit(10);
  return apiResponse(res, 200, 'User fetched', { user, submissions });
}));

userRouter.put('/:id/status', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true }).select('-password');
  return apiResponse(res, 200, `User ${req.body.isActive ? 'activated' : 'deactivated'}`, user);
}));

export { userRouter };

// ─── analyticsRoutes.js ───────────────────────────────────────────────────────
import { getDashboardStats, getMyAnalytics, getLeaderboard } from '../controllers/analyticsController.js';

const analyticsRouter = express.Router();
analyticsRouter.use(protect);
analyticsRouter.get('/dashboard', authorize('admin'), getDashboardStats);
analyticsRouter.get('/me', getMyAnalytics);
analyticsRouter.get('/leaderboard', getLeaderboard);

export { analyticsRouter };

// ─── submissionRoutes.js ──────────────────────────────────────────────────────
const submissionRouter = express.Router();
submissionRouter.use(protect);

submissionRouter.get('/', asyncHandler(async (req, res) => {
  const { Submission } = await import('../models/index.js');
  const { status, taskId, studentId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (req.user.role === 'student') filter.student = req.user._id;
  else {
    if (studentId) filter.student = studentId;
  }
  if (status) filter.status = status;
  if (taskId) filter.task = taskId;
  const [submissions, total] = await Promise.all([
    Submission.find(filter).populate('student', 'name email avatar').populate('task', 'title category difficulty').sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Submission.countDocuments(filter),
  ]);
  return apiResponse(res, 200, 'Submissions fetched', { submissions, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
}));

submissionRouter.put('/:id/review', authorize('admin'), asyncHandler(async (req, res) => {
  const { Submission } = await import('../models/index.js');
  const { feedback, score, status } = req.body;
  const submission = await Submission.findByIdAndUpdate(
    req.params.id,
    { feedback, score, status, reviewedBy: req.user._id, reviewedAt: new Date() },
    { new: true }
  ).populate('student', 'name email').populate('task', 'title');
  if (!submission) { res.status(404); throw new Error('Submission not found'); }
  return apiResponse(res, 200, 'Submission reviewed', submission);
}));

export { submissionRouter };

// ─── announcementRoutes.js ────────────────────────────────────────────────────
const announcementRouter = express.Router();
announcementRouter.use(protect);

announcementRouter.get('/', asyncHandler(async (req, res) => {
  const { Announcement } = await import('../models/index.js');
  const filter = { isActive: true };
  if (req.user.role !== 'admin') filter.$or = [{ targetRole: 'all' }, { targetRole: req.user.role }];
  const announcements = await Announcement.find(filter).populate('createdBy', 'name').sort({ createdAt: -1 }).limit(20);
  return apiResponse(res, 200, 'Announcements fetched', announcements);
}));

announcementRouter.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { Announcement } = await import('../models/index.js');
  const announcement = await Announcement.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Announcement created', announcement);
}));

announcementRouter.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { Announcement } = await import('../models/index.js');
  await Announcement.findByIdAndDelete(req.params.id);
  return apiResponse(res, 200, 'Announcement deleted');
}));

export { announcementRouter };

// ─── codingRoutes.js ──────────────────────────────────────────────────────────
const codingRouter = express.Router();
codingRouter.use(protect);

codingRouter.get('/', asyncHandler(async (req, res) => {
  const { CodingQuestion } = await import('../models/index.js');
  const { topic, difficulty, company, search, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (company) filter.companies = { $in: [new RegExp(company, 'i')] };
  if (search) filter.title = { $regex: search, $options: 'i' };
  const [questions, total] = await Promise.all([
    CodingQuestion.find(filter).select('-solution -solutionExplanation').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    CodingQuestion.countDocuments(filter),
  ]);
  const savedQ = req.user.bookmarks.map(b => b.toString());
  const solvedQ = req.user.solvedQuestions.map(s => s.toString());
  const withMeta = questions.map(q => ({ ...q.toObject(), isBookmarked: savedQ.includes(q._id.toString()), isSolved: solvedQ.includes(q._id.toString()) }));
  return apiResponse(res, 200, 'Questions fetched', { questions: withMeta, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
}));

codingRouter.get('/:id', asyncHandler(async (req, res) => {
  const { CodingQuestion } = await import('../models/index.js');
  const q = await CodingQuestion.findById(req.params.id);
  if (!q) { res.status(404); throw new Error('Question not found'); }
  return apiResponse(res, 200, 'Question fetched', q);
}));

codingRouter.post('/:id/bookmark', asyncHandler(async (req, res) => {
  const user = req.user;
  const qid = req.params.id;
  const isBookmarked = user.bookmarks.some(b => b.toString() === qid);
  if (isBookmarked) await User.findByIdAndUpdate(user._id, { $pull: { bookmarks: qid } });
  else await User.findByIdAndUpdate(user._id, { $addToSet: { bookmarks: qid } });
  return apiResponse(res, 200, isBookmarked ? 'Bookmark removed' : 'Question bookmarked');
}));

codingRouter.post('/:id/solve', asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { solvedQuestions: req.params.id } });
  return apiResponse(res, 200, 'Marked as solved');
}));

codingRouter.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { CodingQuestion } = await import('../models/index.js');
  const q = await CodingQuestion.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Question created', q);
}));

export { codingRouter };

// ─── progressRoutes.js ────────────────────────────────────────────────────────
const progressRouter = express.Router();
progressRouter.use(protect);
progressRouter.get('/me', asyncHandler(async (req, res) => {
  const progress = await Progress.findOne({ student: req.user._id }).populate('coursesEnrolled.course', 'title thumbnail totalLessons');
  return apiResponse(res, 200, 'Progress fetched', progress);
}));

export { progressRouter };

// ─── quizRoutes.js ────────────────────────────────────────────────────────────
const quizRouter = express.Router();
quizRouter.use(protect);

quizRouter.get('/', asyncHandler(async (req, res) => {
  const { Quiz } = await import('../models/index.js');
  const quizzes = await Quiz.find({ isPublished: true }).select('-questions.options.isCorrect').populate('course', 'title');
  return apiResponse(res, 200, 'Quizzes fetched', quizzes);
}));

quizRouter.get('/:id', asyncHandler(async (req, res) => {
  const { Quiz } = await import('../models/index.js');
  const quiz = await Quiz.findById(req.params.id).select('-questions.options.isCorrect');
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }
  return apiResponse(res, 200, 'Quiz fetched', quiz);
}));

quizRouter.post('/:id/submit', asyncHandler(async (req, res) => {
  const { Quiz } = await import('../models/index.js');
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }
  const { answers } = req.body;
  let score = 0, totalPoints = 0;
  const results = quiz.questions.map((q, i) => {
    const correctOption = q.options.find(o => o.isCorrect);
    const isCorrect = answers[i] === correctOption?.text;
    totalPoints += q.points;
    if (isCorrect) score += q.points;
    return { question: q.text, selected: answers[i], correct: correctOption?.text, isCorrect, explanation: q.explanation };
  });
  const percentage = Math.round((score / totalPoints) * 100);
  const passed = percentage >= quiz.passingScore;
  await Progress.findOneAndUpdate(
    { student: req.user._id },
    { $push: { quizAttempts: { quiz: quiz._id, score: percentage, passed, attemptedAt: new Date() } } }
  );
  if (passed) await User.findByIdAndUpdate(req.user._id, { $inc: { totalPoints: score } });
  return apiResponse(res, 200, 'Quiz submitted', { score, totalPoints, percentage, passed, results });
}));

quizRouter.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { Quiz } = await import('../models/index.js');
  const quiz = await Quiz.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Quiz created', quiz);
}));

export { quizRouter };

// ─── Re-exports for server.js ─────────────────────────────────────────────────
// Note: In production, split these into separate files. For brevity they're combined here.
// server.js should import: courseRouter as courseRoutes, userRouter as userRoutes, etc.
