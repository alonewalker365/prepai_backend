import express from 'express';
import {
  createQuiz, updateQuiz, deleteQuiz, getQuizzes, getQuizById,
  startAttempt, submitAttempt, getMyAttempts, getAttemptDetail, getAllAttempts,
} from '../controllers/aptitudeController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

// Student routes
router.get('/',                       getQuizzes);
router.get('/my-attempts',            getMyAttempts);
router.get('/:id',                    getQuizById);
router.post('/:id/start',             authorize('student'), startAttempt);
router.post('/submit',                authorize('student'), submitAttempt);

// Admin routes
router.post('/',                      authorize('admin'), createQuiz);
router.put('/:id',                    authorize('admin'), updateQuiz);
router.delete('/:id',                 authorize('admin'), deleteQuiz);
router.get('/admin/attempts',         authorize('admin'), getAllAttempts);
router.get('/admin/attempts/:id',     authorize('admin'), getAttemptDetail);

export default router;
