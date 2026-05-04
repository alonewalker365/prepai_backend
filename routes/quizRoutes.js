import express from 'express';
import asyncHandler from 'express-async-handler';
import { Quiz, Progress, User } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// GET /api/quiz
router.get('/', asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };
  const quizzes = await Quiz.find(filter)
    .select('-questions.options.isCorrect')
    .populate('course', 'title')
    .sort({ createdAt: -1 });

  return apiResponse(res, 200, 'Quizzes fetched', quizzes);
}));

// GET /api/quiz/:id
router.get('/:id', asyncHandler(async (req, res) => {
  // Hide correct answers for non-admins
  const select = req.user.role === 'admin' ? '' : '-questions.options.isCorrect';
  const quiz = await Quiz.findById(req.params.id).select(select).populate('course', 'title');
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }
  return apiResponse(res, 200, 'Quiz fetched', quiz);
}));

// POST /api/quiz/:id/submit
router.post('/:id/submit', asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }
  if (!quiz.isPublished && req.user.role !== 'admin') {
    res.status(403); throw new Error('Quiz not available');
  }

  const { answers } = req.body; // array of selected option texts, indexed by question
  if (!Array.isArray(answers)) { res.status(400); throw new Error('Answers must be an array'); }

  let score = 0;
  let totalPoints = 0;

  const results = quiz.questions.map((q, i) => {
    const correctOption = q.options.find(o => o.isCorrect);
    const selected = answers[i] || '';
    const isCorrect = selected === correctOption?.text;
    totalPoints += q.points;
    if (isCorrect) score += q.points;

    return {
      question: q.text,
      selected,
      correct: correctOption?.text || '',
      isCorrect,
      explanation: q.explanation || '',
      points: q.points,
    };
  });

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percentage >= quiz.passingScore;

  // Save attempt to progress
  await Progress.findOneAndUpdate(
    { student: req.user._id },
    {
      $push: {
        quizAttempts: {
          quiz: quiz._id,
          score: percentage,
          passed,
          attemptedAt: new Date(),
        },
      },
    },
    { upsert: true }
  );

  // Award points if passed
  if (passed) {
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalPoints: score } });
  }

  return apiResponse(res, 200, 'Quiz submitted', {
    score,
    totalPoints,
    percentage,
    passed,
    passingScore: quiz.passingScore,
    results,
  });
}));

// POST /api/quiz  (admin)
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const quiz = await Quiz.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Quiz created', quiz);
}));

// PUT /api/quiz/:id  (admin)
router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }
  return apiResponse(res, 200, 'Quiz updated', quiz);
}));

// DELETE /api/quiz/:id  (admin)
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  await Quiz.findByIdAndDelete(req.params.id);
  return apiResponse(res, 200, 'Quiz deleted');
}));

export default router;
