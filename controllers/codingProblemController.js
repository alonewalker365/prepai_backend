import asyncHandler from 'express-async-handler';
import { CodingProblem, CodingSubmission, User, Notification } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Safe JS code executor using Worker threads ───────────────────────────────
const executeJS = (code, input, timeoutMs = 3000) => {
  return new Promise((resolve) => {
    const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      const { code, input } = workerData;
      let output = '';
      let error = null;
      try {
        const originalLog = console.log;
        const logs = [];
        console.log = (...args) => logs.push(args.map(String).join(' '));
        const fn = new Function('input', code + '\\nreturn solution(input);');
        const result = fn(input);
        console.log = originalLog;
        output = result !== undefined ? String(result) : logs.join('\\n');
      } catch(e) {
        error = e.message;
      }
      parentPort.postMessage({ output: output.trim(), error });
    `;

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ output: '', error: 'Time Limit Exceeded', timedOut: true }); }
    }, timeoutMs);

    try {
      const { Worker } = require('worker_threads');
      const worker = new Worker(workerCode, {
        eval: true,
        workerData: { code, input },
      });
      worker.on('message', (msg) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(msg);
        }
        worker.terminate();
      });
      worker.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({ output: '', error: err.message });
        }
      });
    } catch (err) {
      clearTimeout(timer);
      resolve({ output: '', error: err.message });
    }
  });
};

// ─── Simulate test case execution (production would use Judge0 API) ───────────
const runTestCase = async (code, language, testCase, problemSlug) => {
  const start = Date.now();
  
  if (language === 'javascript') {
    const result = await executeJS(code, testCase.input);
    const executionTime = Date.now() - start;
    const actualOutput = result.output?.trim();
    const expectedOutput = testCase.expectedOutput?.trim();
    const passed = !result.error && actualOutput === expectedOutput;
    return {
      input: testCase.input,
      expectedOutput,
      actualOutput: result.error ? '' : actualOutput,
      passed,
      isHidden: testCase.isHidden,
      executionTime,
      error: result.error || null,
    };
  }

  // For non-JS languages: simulate (in production, integrate Judge0)
  // Judge0 API: POST https://judge0-ce.p.rapidapi.com/submissions
  const executionTime = Math.floor(Math.random() * 200) + 50;
  const simulatedPass = Math.random() > 0.3; // demo simulation
  return {
    input: testCase.input,
    expectedOutput: testCase.expectedOutput?.trim(),
    actualOutput: simulatedPass ? testCase.expectedOutput?.trim() : 'Wrong Answer',
    passed: simulatedPass,
    isHidden: testCase.isHidden,
    executionTime,
    error: null,
  };
};

// ─── ADMIN: Create problem ────────────────────────────────────────────────────
export const createProblem = asyncHandler(async (req, res) => {
  const slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const problem = await CodingProblem.create({ ...req.body, slug, createdBy: req.user._id });
  return apiResponse(res, 201, 'Problem created', problem);
});

// ─── ADMIN: Update problem ────────────────────────────────────────────────────
export const updateProblem = asyncHandler(async (req, res) => {
  const problem = await CodingProblem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!problem) { res.status(404); throw new Error('Problem not found'); }
  return apiResponse(res, 200, 'Problem updated', problem);
});

// ─── ADMIN: Delete problem ────────────────────────────────────────────────────
export const deleteProblem = asyncHandler(async (req, res) => {
  await CodingProblem.findByIdAndDelete(req.params.id);
  await CodingSubmission.deleteMany({ problem: req.params.id });
  return apiResponse(res, 200, 'Problem deleted');
});

// ─── STUDENT: Get all problems ────────────────────────────────────────────────
export const getProblems = asyncHandler(async (req, res) => {
  const { topic, difficulty, company, search, page = 1, limit = 20 } = req.query;
  const filter = req.user.role === 'admin' ? {} : { isPublished: true };
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (company) filter.companies = { $in: [new RegExp(company, 'i')] };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const [problems, total] = await Promise.all([
    CodingProblem.find(filter).select('-testCases -solution').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    CodingProblem.countDocuments(filter),
  ]);

  // Attach solved status
  const solvedProblems = await CodingSubmission.distinct('problem', {
    student: req.user._id, status: 'accepted',
  });
  const solvedSet = new Set(solvedProblems.map(String));

  const enriched = problems.map(p => ({
    ...p.toObject(),
    isSolved: solvedSet.has(p._id.toString()),
    exampleCount: p.examples?.length || 0,
  }));

  return apiResponse(res, 200, 'Problems fetched', {
    problems: enriched,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

// ─── STUDENT: Get single problem ──────────────────────────────────────────────
export const getProblemById = asyncHandler(async (req, res) => {
  const problem = await CodingProblem.findById(req.params.id);
  if (!problem) { res.status(404); throw new Error('Problem not found'); }

  // Only show visible test cases to students
  const probData = problem.toObject();
  if (req.user.role !== 'admin') {
    probData.testCases = probData.testCases.filter(tc => !tc.isHidden);
    probData.solution = undefined;
  }

  // Fetch student's best submission
  const myBest = await CodingSubmission.findOne({
    student: req.user._id, problem: problem._id,
  }).sort({ passedTestCases: -1, submittedAt: -1 });

  return apiResponse(res, 200, 'Problem fetched', { ...probData, myBestSubmission: myBest });
});

// ─── STUDENT: Run code (only visible test cases) ──────────────────────────────
export const runCode = asyncHandler(async (req, res) => {
  const { code, language } = req.body;
  const problem = await CodingProblem.findById(req.params.id);
  if (!problem) { res.status(404); throw new Error('Problem not found'); }

  const visibleTests = problem.testCases.filter(tc => !tc.isHidden);
  const results = await Promise.all(
    visibleTests.map(tc => runTestCase(code, language, tc, problem.slug))
  );

  return apiResponse(res, 200, 'Code executed', {
    results,
    passedCount: results.filter(r => r.passed).length,
    totalCount: results.length,
  });
});

// ─── STUDENT: Submit code (all test cases including hidden) ───────────────────
export const submitCode = asyncHandler(async (req, res) => {
  const { code, language } = req.body;
  if (!code?.trim()) { res.status(400); throw new Error('Code is required'); }

  const problem = await CodingProblem.findById(req.params.id);
  if (!problem) { res.status(404); throw new Error('Problem not found'); }

  // Create submission as pending
  const submission = await CodingSubmission.create({
    student: req.user._id,
    problem: problem._id,
    code,
    language,
    status: 'running',
    totalTestCases: problem.testCases.length,
  });

  // Run all test cases (visible + hidden)
  const results = await Promise.all(
    problem.testCases.map((tc, i) => runTestCase(code, language, tc, problem.slug))
  );

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;
  const avgTime = results.reduce((s, r) => s + (r.executionTime || 0), 0) / totalCount;

  // Check for errors
  const hasRuntimeError = results.some(r => r.error && !r.error.includes('Time Limit'));
  const hasTLE = results.some(r => r.error?.includes('Time Limit'));
  const hasCompileError = results.some(r => r.error?.includes('SyntaxError') || r.error?.includes('compile'));

  let status = 'wrong_answer';
  if (allPassed) status = 'accepted';
  else if (hasCompileError) status = 'compile_error';
  else if (hasTLE) status = 'time_limit';
  else if (hasRuntimeError) status = 'runtime_error';

  // Points: proportional to test cases passed
  const pointsEarned = Math.round((passedCount / totalCount) * problem.maxPoints);

  // Update submission
  submission.testResults = results.map((r, i) => ({
    testCase: i,
    input: r.isHidden ? '[Hidden]' : r.input,
    expectedOutput: r.isHidden ? '[Hidden]' : r.expectedOutput,
    actualOutput: r.isHidden ? (r.passed ? '[Passed]' : '[Failed]') : r.actualOutput,
    passed: r.passed,
    isHidden: r.isHidden,
    executionTime: r.executionTime,
    error: r.error,
  }));
  submission.passedTestCases = passedCount;
  submission.totalTestCases = totalCount;
  submission.status = status;
  submission.pointsEarned = pointsEarned;
  submission.executionTime = Math.round(avgTime);
  await submission.save();

  await CodingProblem.findByIdAndUpdate(problem._id, { $inc: { totalAttempts: 1, ...(allPassed ? { totalSolved: 1 } : {}) } });

  // Award points if accepted
  if (allPassed) {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { solvedQuestions: problem._id }, $inc: { totalPoints: pointsEarned } });
  }

  return apiResponse(res, 200, 'Code submitted', {
    submissionId: submission._id,
    status,
    passedTestCases: passedCount,
    totalTestCases: totalCount,
    pointsEarned,
    executionTime: Math.round(avgTime),
    testResults: submission.testResults,
    allPassed,
  });
});

// ─── STUDENT: Get my submissions for a problem ────────────────────────────────
export const getMySubmissions = asyncHandler(async (req, res) => {
  const submissions = await CodingSubmission.find({
    student: req.user._id, problem: req.params.id,
  }).sort({ submittedAt: -1 }).limit(10);
  return apiResponse(res, 200, 'Submissions fetched', submissions);
});

// ─── ADMIN: Get all submissions (monitoring) ──────────────────────────────────
export const getAllSubmissions = asyncHandler(async (req, res) => {
  const { problemId, studentId, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (problemId) filter.problem = problemId;
  if (studentId) filter.student = studentId;
  if (status) filter.status = status;

  const [submissions, total] = await Promise.all([
    CodingSubmission.find(filter)
      .populate('student', 'name email avatar')
      .populate('problem', 'title difficulty topic')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit).limit(Number(limit)),
    CodingSubmission.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Submissions fetched', {
    submissions,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});
