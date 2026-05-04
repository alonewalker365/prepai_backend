import express from 'express';
import {
  createProblem, updateProblem, deleteProblem,
  getProblems, getProblemById, runCode, submitCode,
  getMySubmissions, getAllSubmissions,
} from '../controllers/codingProblemController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

// Student routes
router.get('/',                         getProblems);
router.get('/:id',                      getProblemById);
router.post('/:id/run',                 runCode);
router.post('/:id/submit',              submitCode);
router.get('/:id/my-submissions',       getMySubmissions);

// Admin routes
router.post('/',                        authorize('admin'), createProblem);
router.put('/:id',                      authorize('admin'), updateProblem);
router.delete('/:id',                   authorize('admin'), deleteProblem);
router.get('/admin/all-submissions',    authorize('admin'), getAllSubmissions);

export default router;
