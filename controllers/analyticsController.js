import asyncHandler from 'express-async-handler';
import { User, Task, Submission, Course, InterviewSession, Progress } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

// @desc    Get admin dashboard analytics
// @route   GET /api/analytics/dashboard
export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    totalCourses,
    totalTasks,
    todaySubmissions,
    weekSubmissions,
    monthSubmissions,
    pendingReviews,
    interviewSessions,
    categoryBreakdown,
    difficultyBreakdown,
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', isActive: true, lastActiveDate: { $gte: last7Days } }),
    Course.countDocuments({ isPublished: true }),
    Task.countDocuments({ isPublished: true }),
    Submission.countDocuments({ submittedAt: { $gte: startOfToday } }),
    Submission.countDocuments({ submittedAt: { $gte: last7Days } }),
    Submission.countDocuments({ submittedAt: { $gte: last30Days } }),
    Submission.countDocuments({ status: 'under_review' }),
    InterviewSession.countDocuments({ status: 'completed', createdAt: { $gte: last30Days } }),
    Submission.aggregate([
      { $lookup: { from: 'tasks', localField: 'task', foreignField: '_id', as: 'taskData' } },
      { $unwind: '$taskData' },
      { $group: { _id: '$taskData.category', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]),
  ]);

  // Daily submission trend (last 7 days)
  const dailyTrend = await Submission.aggregate([
    { $match: { submittedAt: { $gte: last7Days } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Top performers
  const topPerformers = await User.find({ role: 'student', isActive: true })
    .sort({ totalPoints: -1, streak: -1 })
    .limit(5)
    .select('name email avatar totalPoints streak');

  return apiResponse(res, 200, 'Dashboard stats fetched', {
    overview: {
      totalUsers,
      activeUsers,
      totalCourses,
      totalTasks,
      todaySubmissions,
      weekSubmissions,
      monthSubmissions,
      pendingReviews,
      interviewSessions,
    },
    charts: {
      dailyTrend,
      categoryBreakdown,
      difficultyBreakdown,
    },
    topPerformers,
  });
});

// @desc    Get student's own analytics
// @route   GET /api/analytics/me
export const getMyAnalytics = asyncHandler(async (req, res) => {
  const progress = await Progress.findOne({ student: req.user._id })
    .populate('coursesEnrolled.course', 'title thumbnail')
    .populate('tasksCompleted', 'title category difficulty');

  const recentSubmissions = await Submission.find({ student: req.user._id })
    .populate('task', 'title category difficulty')
    .sort({ submittedAt: -1 })
    .limit(10);

  const weeklyActivity = await Submission.aggregate([
    { $match: { student: req.user._id } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 30 },
  ]);

  const categoryPerformance = await Submission.aggregate([
    { $match: { student: req.user._id } },
    { $lookup: { from: 'tasks', localField: 'task', foreignField: '_id', as: 'taskData' } },
    { $unwind: '$taskData' },
    {
      $group: {
        _id: '$taskData.category',
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        total: { $sum: 1 },
        avgScore: { $avg: '$score' },
      },
    },
  ]);

  return apiResponse(res, 200, 'Analytics fetched', {
    progress,
    recentSubmissions,
    weeklyActivity: weeklyActivity.reverse(),
    categoryPerformance,
    user: {
      streak: req.user.streak,
      totalPoints: req.user.totalPoints,
      badges: req.user.badges,
    },
  });
});

// @desc    Get leaderboard
// @route   GET /api/analytics/leaderboard
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { period = 'all' } = req.query;

  const dateFilter = {};
  if (period === 'week') dateFilter.lastActiveDate = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  if (period === 'month') dateFilter.lastActiveDate = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };

  const leaderboard = await User.find({ role: 'student', isActive: true, ...dateFilter })
    .sort({ totalPoints: -1, streak: -1 })
    .limit(50)
    .select('name email avatar totalPoints streak badges preferredRole');

  const withRank = leaderboard.map((user, idx) => ({ ...user.toObject(), rank: idx + 1 }));

  // Get current user's rank
  const myRank = withRank.findIndex((u) => u._id.toString() === req.user._id.toString()) + 1;

  return apiResponse(res, 200, 'Leaderboard fetched', { leaderboard: withRank, myRank });
});
