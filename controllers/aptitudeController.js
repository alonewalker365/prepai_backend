import asyncHandler from 'express-async-handler';
import { AptitudeQuiz, AptitudeAttempt, User, Notification } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

// ─── ADMIN: Create Quiz ───────────────────────────────────────────────────────
export const createQuiz = asyncHandler(async (req, res) => {
  const quiz = await AptitudeQuiz.create({ ...req.body, createdBy: req.user._id });
  return apiResponse(res, 201, 'Quiz created', quiz);
});

// ─── ADMIN: Update Quiz ───────────────────────────────────────────────────────
export const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await AptitudeQuiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }
  return apiResponse(res, 200, 'Quiz updated', quiz);
});

// ─── ADMIN: Delete Quiz ───────────────────────────────────────────────────────
export const deleteQuiz = asyncHandler(async (req, res) => {
  await AptitudeQuiz.findByIdAndDelete(req.params.id);
  await AptitudeAttempt.deleteMany({ quiz: req.params.id });
  return apiResponse(res, 200, 'Quiz deleted');
});

// ─── ADMIN: Get all quiz attempts (for monitoring) ───────────────────────────
export const getAllAttempts = asyncHandler(async (req, res) => {
  const { quizId, studentId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (quizId) filter.quiz = quizId;
  if (studentId) filter.student = studentId;

  const [attempts, total] = await Promise.all([
    AptitudeAttempt.find(filter)
      .populate('student', 'name email avatar')
      .populate('quiz', 'title topic difficulty')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit)),
    AptitudeAttempt.countDocuments(filter),
  ]);
  return apiResponse(res, 200, 'Attempts fetched', {
    attempts,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

// ─── STUDENT: Get published quizzes ──────────────────────────────────────────
export const getQuizzes = asyncHandler(async (req, res) => {
  const { topic, difficulty, search } = req.query;
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const quizzes = await AptitudeQuiz.find(filter)
    .select('-questions.options.isCorrect -questions.explanation')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  // Attach student's best attempt
  const quizIds = quizzes.map(q => q._id);
  const myAttempts = await AptitudeAttempt.find({
    student: req.user._id,
    quiz: { $in: quizIds },
    status: 'completed',
  }).sort({ score: -1 });

  const bestAttempt = {};
  myAttempts.forEach(a => {
    const qid = a.quiz.toString();
    if (!bestAttempt[qid] || a.score > bestAttempt[qid].score) bestAttempt[qid] = a;
  });

  const enriched = quizzes.map(q => ({
    ...q.toObject(),
    questionCount: q.questions.length,
    myBestScore: bestAttempt[q._id.toString()]?.score || null,
    myBestPercentage: bestAttempt[q._id.toString()]?.percentage || null,
    attempted: !!bestAttempt[q._id.toString()],
  }));

  return apiResponse(res, 200, 'Quizzes fetched', enriched);
});

// ─── STUDENT: Get single quiz (with correct answers hidden) ──────────────────
export const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await AptitudeQuiz.findById(req.params.id);
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }

  // Strip correct answers for students
  const quizData = quiz.toObject();
  if (req.user.role !== 'admin') {
    quizData.questions = quizData.questions.map(q => ({
      ...q,
      options: q.options.map(o => ({ _id: o._id, text: o.text })),
      explanation: undefined,
    }));
  }
  return apiResponse(res, 200, 'Quiz fetched', quizData);
});

// ─── STUDENT: Start quiz attempt ─────────────────────────────────────────────
export const startAttempt = asyncHandler(async (req, res) => {
  const quiz = await AptitudeQuiz.findById(req.params.id);
  if (!quiz || !quiz.isPublished) { res.status(404); throw new Error('Quiz not found'); }

  // Check for existing in-progress attempt
  const existing = await AptitudeAttempt.findOne({
    student: req.user._id, quiz: quiz._id, status: 'in_progress',
  });
  if (existing) return apiResponse(res, 200, 'Resuming existing attempt', existing);

  const attempt = await AptitudeAttempt.create({
    student: req.user._id,
    quiz: quiz._id,
    totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
    startedAt: new Date(),
  });
  return apiResponse(res, 201, 'Quiz started', attempt);
});

// ─── STUDENT: Submit quiz — AUTO-EVALUATE ────────────────────────────────────
export const submitAttempt = asyncHandler(async (req, res) => {
  const { attemptId, answers, timeTaken } = req.body;
  // answers: [{ questionIndex: 0, selectedOption: 2 }, ...]

  const attempt = await AptitudeAttempt.findOne({
    _id: attemptId, student: req.user._id, status: 'in_progress',
  });
  if (!attempt) { res.status(404); throw new Error('Attempt not found or already submitted'); }

  const quiz = await AptitudeQuiz.findById(attempt.quiz);
  if (!quiz) { res.status(404); throw new Error('Quiz not found'); }

  // ── Auto-evaluate with negative marking ───────────────────────────────────
  let totalScore = 0;
  const totalMaxPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
  const evaluatedAnswers = quiz.questions.map((question, idx) => {
    const studentAnswer = answers.find(a => a.questionIndex === idx);
    const selectedOptionIdx = studentAnswer?.selectedOption ?? -1;
    const timeTakenQ = studentAnswer?.timeTaken || 0;

    if (selectedOptionIdx === -1) {
      // Unanswered — no penalty
      return { questionIndex: idx, selectedOption: -1, isCorrect: false, pointsEarned: 0, timeTaken: timeTakenQ };
    }

    const selectedOption = question.options[selectedOptionIdx];
    const isCorrect = selectedOption?.isCorrect || false;
    let pointsEarned = 0;

    if (isCorrect) {
      pointsEarned = question.points;
      totalScore += question.points;
    } else {
      // Negative marking
      const penalty = question.negativeMark || 0;
      pointsEarned = -penalty;
      totalScore -= penalty;
    }

    return { questionIndex: idx, selectedOption: selectedOptionIdx, isCorrect, pointsEarned, timeTaken: timeTakenQ };
  });

  totalScore = Math.max(0, totalScore); // floor at 0
  const percentage = totalMaxPoints > 0 ? Math.round((totalScore / totalMaxPoints) * 100) : 0;
  const passed = percentage >= quiz.passingScore;

  // Update attempt
  attempt.answers = evaluatedAnswers;
  attempt.score = totalScore;
  attempt.totalPoints = totalMaxPoints;
  attempt.percentage = percentage;
  attempt.passed = passed;
  attempt.timeTaken = timeTaken || 0;
  attempt.submittedAt = new Date();
  attempt.status = 'completed';
  await attempt.save();

  await AptitudeQuiz.findByIdAndUpdate(quiz._id, { $inc: { totalAttempts: 1 } });

  // Award points
  if (totalScore > 0) {
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalPoints: totalScore } });
  }

  // Build result with correct answers revealed
  const resultWithAnswers = quiz.questions.map((q, idx) => {
    const ea = evaluatedAnswers[idx];
    const correctIdx = q.options.findIndex(o => o.isCorrect);
    return {
      questionIndex: idx,
      questionText: q.text,
      selectedOption: ea.selectedOption,
      selectedText: ea.selectedOption >= 0 ? q.options[ea.selectedOption]?.text : 'Not answered',
      correctOption: correctIdx,
      correctText: q.options[correctIdx]?.text,
      isCorrect: ea.isCorrect,
      pointsEarned: ea.pointsEarned,
      maxPoints: q.points,
      explanation: q.explanation,
      options: q.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, index: i })),
    };
  });

  return apiResponse(res, 200, 'Quiz submitted and evaluated', {
    attemptId: attempt._id,
    score: totalScore,
    totalPoints: totalMaxPoints,
    percentage,
    passed,
    timeTaken,
    correctCount: evaluatedAnswers.filter(a => a.isCorrect).length,
    wrongCount: evaluatedAnswers.filter(a => !a.isCorrect && a.selectedOption >= 0).length,
    unansweredCount: evaluatedAnswers.filter(a => a.selectedOption === -1).length,
    questions: resultWithAnswers,
  });
});

// ─── STUDENT: Get my attempts ────────────────────────────────────────────────
export const getMyAttempts = asyncHandler(async (req, res) => {
  const attempts = await AptitudeAttempt.find({ student: req.user._id, status: 'completed' })
    .populate('quiz', 'title topic difficulty timeLimit')
    .sort({ submittedAt: -1 });
  return apiResponse(res, 200, 'Attempts fetched', attempts);
});

// ─── ADMIN: Get attempt detail ────────────────────────────────────────────────
export const getAttemptDetail = asyncHandler(async (req, res) => {
  const attempt = await AptitudeAttempt.findById(req.params.id)
    .populate('student', 'name email avatar')
    .populate('quiz');
  if (!attempt) { res.status(404); throw new Error('Attempt not found'); }
  return apiResponse(res, 200, 'Attempt fetched', attempt);
});
