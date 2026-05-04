import express from 'express';
import { getTasks, getTaskById, createTask, updateTask, deleteTask, submitTask, getTodaysTasks } from '../controllers/taskController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);

router.get('/today', getTodaysTasks);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/:id/submit', authorize('student'), submitTask);

router.post('/', authorize('admin'), createTask);
router.put('/:id', authorize('admin'), updateTask);
router.delete('/:id', authorize('admin'), deleteTask);

export default router;
