import express from 'express';
import asyncHandler from 'express-async-handler';
import { CodingQuestion, User } from '../models/index.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const router = express.Router();
router.use(protect);

// GET /api/coding
router.get('/', asyncHandler(async (req, res) => {
  const { topic, difficulty, company, search, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };

  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (company) filter.companies = { $in: [new RegExp(company, 'i')] };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);
  const [questions, total] = await Promise.all([
    CodingQuestion.find(filter)
      .select('-solution -solutionExplanation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    CodingQuestion.countDocuments(filter),
  ]);

  const bookmarks = (req.user.bookmarks || []).map(b => b.toString());
  const solved = (req.user.solvedQuestions || []).map(s => s.toString());

  const withMeta = questions.map(q => ({
    ...q.toObject(),
    isBookmarked: bookmarks.includes(q._id.toString()),
    isSolved: solved.includes(q._id.toString()),
  }));

  return apiResponse(res, 200, 'Questions fetched', {
    questions: withMeta,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
}));

// GET /api/coding/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const question = await CodingQuestion.findById(req.params.id);
  if (!question) { res.status(404); throw new Error('Question not found'); }

  const isSolved = req.user.solvedQuestions?.some(s => s.toString() === req.params.id);
  const isBookmarked = req.user.bookmarks?.some(b => b.toString() === req.params.id);

  return apiResponse(res, 200, 'Question fetched', { ...question.toObject(), isSolved, isBookmarked });
}));

// POST /api/coding/:id/bookmark  (toggle)
router.post('/:id/bookmark', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const qId = req.params.id;
  const user = await User.findById(userId);
  const isBookmarked = user.bookmarks.some(b => b.toString() === qId);

  if (isBookmarked) {
    await User.findByIdAndUpdate(userId, { $pull: { bookmarks: qId } });
  } else {
    await User.findByIdAndUpdate(userId, { $addToSet: { bookmarks: qId } });
  }

  return apiResponse(res, 200, isBookmarked ? 'Bookmark removed' : 'Question bookmarked', { isBookmarked: !isBookmarked });
}));

// POST /api/coding/:id/solve
router.post('/:id/solve', asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { solvedQuestions: req.params.id },
    $inc: { totalPoints: 5 },
  });
  return apiResponse(res, 200, 'Marked as solved');
}));

// POST /api/coding  (admin only)
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  // Auto-generate slug from title
  const slug = req.body.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);

  const question = await CodingQuestion.create({
    ...req.body,
    slug,
    createdBy: req.user._id,
  });
  return apiResponse(res, 201, 'Question created', question);
}));

// PUT /api/coding/:id  (admin only)
router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const question = await CodingQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!question) { res.status(404); throw new Error('Question not found'); }
  return apiResponse(res, 200, 'Question updated', question);
}));

// DELETE /api/coding/:id  (admin only)
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  await CodingQuestion.findByIdAndDelete(req.params.id);
  return apiResponse(res, 200, 'Question deleted');
}));

export default router;
