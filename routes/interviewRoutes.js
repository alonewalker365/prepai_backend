import express from 'express';
import { generateQuestions, evaluateAnswer, createSession, updateSession, getSessions, getInterviewRoadmap } from '../controllers/interviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.post('/generate-questions', generateQuestions);
router.post('/evaluate', evaluateAnswer);
router.post('/roadmap', getInterviewRoadmap);
router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.put('/sessions/:id', updateSession);

export default router;
