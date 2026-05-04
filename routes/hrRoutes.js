import express from 'express';
import {
  createHRTask, updateHRTask, deleteHRTask,
  getHRTasks, getHRTaskById, submitHRAnswer,
  getAllHRSubmissions, reviewHRSubmission,
} from '../controllers/hrController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

// Student routes
router.get('/',                       getHRTasks);
router.get('/:id',                    getHRTaskById);
router.post('/:id/submit',            authorize('student'), submitHRAnswer);

// Admin routes
router.post('/',                      authorize('admin'), createHRTask);
router.put('/:id',                    authorize('admin'), updateHRTask);
router.delete('/:id',                 authorize('admin'), deleteHRTask);
router.get('/admin/submissions',      authorize('admin'), getAllHRSubmissions);
router.put('/admin/submissions/:id/review', authorize('admin'), reviewHRSubmission);

export default router;
