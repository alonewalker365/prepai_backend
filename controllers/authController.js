import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import { User, Progress } from '../models/index.js';
import { generateToken } from '../middleware/authMiddleware.js';
import { apiResponse } from '../middleware/errorMiddleware.js';

// @desc    Register new user
// @route   POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role === 'admin' ? 'student' : (role || 'student'),
  });

  // Initialize progress document for student
  if (user.role === 'student') {
    await Progress.create({ student: user._id });
  }

  return apiResponse(res, 201, 'Registration successful', {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    streak: user.streak,
    token: generateToken(user._id),
  });
});

// @desc    Login user
// @route   POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('Account deactivated. Contact admin.');
  }

  // Update streak
  user.updateStreak();
  await user.save();

  return apiResponse(res, 200, 'Login successful', {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    streak: user.streak,
    totalPoints: user.totalPoints,
    token: generateToken(user._id),
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  return apiResponse(res, 200, 'Profile fetched', user);
});

// @desc    Update profile
// @route   PUT /api/auth/me
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, preferredRole, skillGoals, dailyGoalMinutes, avatar } = req.body;
  const user = await User.findById(req.user._id);

  user.name = name || user.name;
  user.bio = bio ?? user.bio;
  user.preferredRole = preferredRole ?? user.preferredRole;
  user.skillGoals = skillGoals ?? user.skillGoals;
  user.dailyGoalMinutes = dailyGoalMinutes ?? user.dailyGoalMinutes;
  user.avatar = avatar ?? user.avatar;

  await user.save();
  return apiResponse(res, 200, 'Profile updated', user);
});

// @desc    Forgot password - sends reset email
// @route   POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    res.status(404);
    throw new Error('No account found with this email');
  }

  const resetToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 min
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  // In production, send an email. For dev, return the URL.
  if (process.env.NODE_ENV === 'development') {
    return apiResponse(res, 200, 'Reset token generated (dev mode)', { resetUrl });
  }

  return apiResponse(res, 200, 'Password reset email sent');
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired reset token');
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  return apiResponse(res, 200, 'Password reset successful', {
    token: generateToken(user._id),
  });
});

// @desc    Change password (authenticated)
// @route   PUT /api/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  if (!(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  return apiResponse(res, 200, 'Password changed successfully');
});
