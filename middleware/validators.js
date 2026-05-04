import { body, validationResult } from 'express-validator';

// ─── Validation runner ────────────────────────────────────────────────────────
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth validators ──────────────────────────────────────────────────────────
export const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

export const loginValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

// ─── Task validators ──────────────────────────────────────────────────────────
export const taskValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title too long'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').notEmpty().withMessage('Category is required').isIn(['coding', 'aptitude', 'hr', 'system-design', 'theory', 'communication']).withMessage('Invalid category'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
  body('scheduledDate').notEmpty().withMessage('Scheduled date is required').isISO8601().withMessage('Invalid date format'),
  body('points').optional().isInt({ min: 1, max: 500 }).withMessage('Points must be between 1 and 500'),
  validate,
];

// ─── Course validators ────────────────────────────────────────────────────────
export const courseValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title too long'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').notEmpty().withMessage('Category is required').isIn(['dsa', 'web-dev', 'system-design', 'aptitude', 'soft-skills', 'interview-prep']).withMessage('Invalid category'),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid level'),
  validate,
];

// ─── Review validator ─────────────────────────────────────────────────────────
export const reviewValidator = [
  body('feedback').trim().notEmpty().withMessage('Feedback is required'),
  body('status').optional().isIn(['completed', 'incomplete', 'under-review']).withMessage('Invalid status'),
  body('score').optional().isInt({ min: 0, max: 100 }).withMessage('Score must be 0-100'),
  validate,
];
