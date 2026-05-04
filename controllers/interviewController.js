import asyncHandler from 'express-async-handler';
import axios from 'axios';
import { InterviewSession } from '../models/index.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-opus-4-6';

const callClaude = async (systemPrompt, userMessage) => {
  const response = await axios.post(
    CLAUDE_API_URL,
    {
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.content[0].text;
};

// @desc    Generate interview questions by type
// @route   POST /api/interview/generate-questions
export const generateQuestions = asyncHandler(async (req, res) => {
  const { type, difficulty = 'medium', count = 5, role = 'Software Engineer' } = req.body;

  const systemPrompt = `You are an expert technical interviewer at top tech companies. Generate interview questions in JSON format only. No extra text.`;

  const userMessage = `Generate ${count} ${type} interview questions for a ${role} position at ${difficulty} difficulty.
Return a JSON array: [{"question": "...", "expectedAnswer": "...", "tips": ["..."]}]`;

  const raw = await callClaude(systemPrompt, userMessage);

  let questions;
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    questions = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    questions = [{ question: raw, expectedAnswer: '', tips: [] }];
  }

  return apiResponse(res, 200, 'Questions generated', { type, difficulty, questions });
});

// @desc    Evaluate an interview answer
// @route   POST /api/interview/evaluate
export const evaluateAnswer = asyncHandler(async (req, res) => {
  const { question, answer, type, role = 'Software Engineer' } = req.body;

  if (!question || !answer) {
    res.status(400);
    throw new Error('Question and answer are required');
  }

  const systemPrompt = `You are a senior interviewer at a top tech company. Evaluate interview answers precisely and helpfully. Return JSON only.`;

  const userMessage = `Interview type: ${type}
Role: ${role}
Question: ${question}
Candidate's Answer: ${answer}

Evaluate and return JSON:
{
  "score": <0-100>,
  "verdict": "<Excellent|Good|Average|Needs Improvement>",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "improvementTips": ["..."],
  "modelAnswer": "...",
  "communicationScore": <0-100>,
  "technicalAccuracy": <0-100>
}`;

  const raw = await callClaude(systemPrompt, userMessage);
  let feedback;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    feedback = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    feedback = { score: 70, verdict: 'Good', strengths: [], weaknesses: [], improvementTips: [raw], modelAnswer: '' };
  }

  return apiResponse(res, 200, 'Answer evaluated', feedback);
});

// @desc    Start a new interview session
// @route   POST /api/interview/sessions
export const createSession = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const session = await InterviewSession.create({
    student: req.user._id,
    type,
    status: 'in-progress',
  });
  return apiResponse(res, 201, 'Interview session started', session);
});

// @desc    Save session result
// @route   PUT /api/interview/sessions/:id
export const updateSession = asyncHandler(async (req, res) => {
  const { questions, overallScore, overallFeedback, communicationScore, technicalScore, duration } = req.body;

  const session = await InterviewSession.findOneAndUpdate(
    { _id: req.params.id, student: req.user._id },
    { questions, overallScore, overallFeedback, communicationScore, technicalScore, duration, status: 'completed' },
    { new: true }
  );

  if (!session) { res.status(404); throw new Error('Session not found'); }
  return apiResponse(res, 200, 'Session saved', session);
});

// @desc    Get student's interview history
// @route   GET /api/interview/sessions
export const getSessions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type } = req.query;
  const filter = { student: req.user._id, status: 'completed' };
  if (type) filter.type = type;

  const [sessions, total] = await Promise.all([
    InterviewSession.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    InterviewSession.countDocuments(filter),
  ]);

  return apiResponse(res, 200, 'Interview history fetched', {
    sessions,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

// @desc    Get AI-generated interview roadmap
// @route   POST /api/interview/roadmap
export const getInterviewRoadmap = asyncHandler(async (req, res) => {
  const { role = 'Software Engineer', experience = 'fresher', targetCompanies = [] } = req.body;

  const systemPrompt = `You are a career coach specializing in technical interview preparation. Be concise and actionable. Return JSON only.`;

  const userMessage = `Create a 4-week interview preparation roadmap for a ${experience} ${role} targeting ${targetCompanies.join(', ') || 'top tech companies'}.
Return JSON:
{
  "weeks": [
    {
      "week": 1,
      "theme": "...",
      "topics": ["..."],
      "dailyGoal": "...",
      "resources": [{"name": "...", "type": "..."}]
    }
  ],
  "keySkills": ["..."],
  "tips": ["..."]
}`;

  const raw = await callClaude(systemPrompt, userMessage);
  let roadmap;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    roadmap = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    roadmap = { weeks: [], keySkills: [], tips: [raw] };
  }

  return apiResponse(res, 200, 'Roadmap generated', roadmap);
});
