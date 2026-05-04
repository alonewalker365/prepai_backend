import express from 'express';
import asyncHandler from 'express-async-handler';
import { Course, Progress, User } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// GET /api/courses
router.get('/', asyncHandler(async (req, res) => {
  const { category, level, search, page = 1, limit = 12 } = req.query;
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);
  const [courses, total] = await Promise.all([
    Course.find(filter).populate('createdBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Course.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Courses fetched', {
    courses,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
}));

// GET /api/courses/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('createdBy', 'name');
  if (!course) { res.status(404); throw new Error('Course not found'); }

  let userProgress = null;
  if (req.user.role === 'student') {
    const progress = await Progress.findOne({ student: req.user._id });
    userProgress = progress?.coursesEnrolled?.find(e => e.course?.toString() === req.params.id) || null;
  }

  return apiResponse(res, 200, 'Course fetched', { ...course.toObject(), userProgress });
}));

// POST /api/courses
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const course = await Course.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Course created', course);
}));

// PUT /api/courses/:id
router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!course) { res.status(404); throw new Error('Course not found'); }
  return apiResponse(res, 200, 'Course updated', course);
}));

// DELETE /api/courses/:id
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  await Course.findByIdAndDelete(req.params.id);
  return apiResponse(res, 200, 'Course deleted');
}));

// POST /api/courses/:id/enroll
router.post('/:id/enroll', authorize('student'), asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) { res.status(404); throw new Error('Course not found'); }

  const progress = await Progress.findOne({ student: req.user._id });
  const alreadyEnrolled = progress?.coursesEnrolled?.some(e => e.course?.toString() === req.params.id);
  if (alreadyEnrolled) { res.status(400); throw new Error('Already enrolled in this course'); }

  await Progress.findOneAndUpdate(
    { student: req.user._id },
    { $push: { coursesEnrolled: { course: req.params.id, enrolledAt: new Date() } } },
    { upsert: true }
  );
  await Course.findByIdAndUpdate(req.params.id, { $inc: { enrolledCount: 1 } });
  return apiResponse(res, 200, 'Enrolled successfully');
}));

// PUT /api/courses/:id/progress
router.put('/:id/progress', authorize('student'), asyncHandler(async (req, res) => {
  const { lessonId, completionPercentage } = req.body;
  await Progress.findOneAndUpdate(
    { student: req.user._id, 'coursesEnrolled.course': req.params.id },
    {
      $addToSet: { 'coursesEnrolled.$.completedLessons': lessonId },
      $set: {
        'coursesEnrolled.$.completionPercentage': completionPercentage,
        'coursesEnrolled.$.lastAccessedAt': new Date(),
      },
    }
  );
  return apiResponse(res, 200, 'Progress updated');
}));

export default router;
