import asyncHandler from 'express-async-handler';
import { Course, Progress } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

// @desc   Get all courses with enrollment status
// @route  GET /api/courses
export const getCourses = asyncHandler(async (req, res) => {
  const { category, level, search, page = 1, limit = 12 } = req.query;
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };

  if (category) filter.category = category;
  if (level)    filter.level = level;
  if (search)   filter.title = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);
  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate('createdBy', 'name')
      .sort({ enrolledCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Course.countDocuments(filter),
  ]);

  // Attach enrollment status if student
  let enriched = courses;
  if (req.user.role === 'student') {
    const progress = await Progress.findOne({ student: req.user._id });
    const enrolled = new Set((progress?.coursesEnrolled || []).map(e => e.course?.toString()));
    enriched = courses.map(c => ({
      ...c.toObject(),
      isEnrolled: enrolled.has(c._id.toString()),
    }));
  }

  return apiResponse(res, 200, 'Courses fetched', {
    courses: enriched,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
});

// @desc   Get single course with user progress
// @route  GET /api/courses/:id
export const getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('createdBy', 'name');
  if (!course) { res.status(404); throw new Error('Course not found'); }

  let userProgress = null;
  if (req.user.role === 'student') {
    const progress = await Progress.findOne({ student: req.user._id });
    userProgress = progress?.coursesEnrolled?.find(
      e => e.course?.toString() === req.params.id
    ) || null;
  }

  return apiResponse(res, 200, 'Course fetched', { ...course.toObject(), userProgress });
});

// @desc   Create course
// @route  POST /api/courses
export const createCourse = asyncHandler(async (req, res) => {
  const course = await Course.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Course created', course);
});

// @desc   Update course
// @route  PUT /api/courses/:id
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!course) { res.status(404); throw new Error('Course not found'); }
  return apiResponse(res, 200, 'Course updated', course);
});

// @desc   Delete course
// @route  DELETE /api/courses/:id
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) { res.status(404); throw new Error('Course not found'); }

  // Remove from all enrolled students' progress
  await Progress.updateMany(
    { 'coursesEnrolled.course': req.params.id },
    { $pull: { coursesEnrolled: { course: req.params.id } } }
  );

  return apiResponse(res, 200, 'Course deleted');
});

// @desc   Enroll in course
// @route  POST /api/courses/:id/enroll
export const enrollCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) { res.status(404); throw new Error('Course not found'); }
  if (!course.isPublished) { res.status(403); throw new Error('Course is not published'); }

  const progress = await Progress.findOne({ student: req.user._id });
  const alreadyEnrolled = progress?.coursesEnrolled?.some(
    e => e.course?.toString() === req.params.id
  );
  if (alreadyEnrolled) { res.status(400); throw new Error('Already enrolled in this course'); }

  await Progress.findOneAndUpdate(
    { student: req.user._id },
    { $push: { coursesEnrolled: { course: req.params.id, enrolledAt: new Date() } } },
    { upsert: true, new: true }
  );

  await Course.findByIdAndUpdate(req.params.id, { $inc: { enrolledCount: 1 } });
  return apiResponse(res, 200, 'Enrolled successfully');
});

// @desc   Update lesson progress
// @route  PUT /api/courses/:id/progress
export const updateLessonProgress = asyncHandler(async (req, res) => {
  const { lessonId, completionPercentage } = req.body;
  if (!lessonId) { res.status(400); throw new Error('lessonId required'); }

  const result = await Progress.findOneAndUpdate(
    { student: req.user._id, 'coursesEnrolled.course': req.params.id },
    {
      $addToSet: { 'coursesEnrolled.$.completedLessons': lessonId },
      $set: {
        'coursesEnrolled.$.completionPercentage': completionPercentage ?? 0,
        'coursesEnrolled.$.lastAccessedAt': new Date(),
      },
    },
    { new: true }
  );

  if (!result) { res.status(404); throw new Error('Enroll in this course first'); }
  return apiResponse(res, 200, 'Progress updated');
});
