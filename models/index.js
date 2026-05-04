import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

// ─── USER MODEL ────────────────────────────────────────────────────────────────
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['student', 'admin', 'interviewer'], default: 'student' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  preferredRole: { type: String, default: '' },
  skillGoals: [{ type: String }],
  dailyGoalMinutes: { type: Number, default: 60 },
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },
  badges: [{ name: String, earnedAt: Date, icon: String }],
  isActive: { type: Boolean, default: true },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  bookmarks: [{ type: Schema.Types.ObjectId, ref: 'CodingQuestion' }],
  solvedQuestions: [{ type: Schema.Types.ObjectId, ref: 'CodingQuestion' }],
  totalPoints: { type: Number, default: 0 },
  leaderboardRank: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.updateStreak = function () {
  const today = new Date().toDateString();
  const lastActive = this.lastActiveDate ? new Date(this.lastActiveDate).toDateString() : null;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastActive === today) return;
  this.streak = lastActive === yesterday ? this.streak + 1 : 1;
  this.lastActiveDate = new Date();
};

// ─── TASK MODEL ────────────────────────────────────────────────────────────────
const taskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['coding', 'aptitude', 'hr', 'system-design', 'theory', 'communication'],
    required: true,
  },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  topic: { type: String },
  scheduledDate: { type: Date, required: true },
  deadline: { type: Date },
  isFeatured: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  points: { type: Number, default: 10 },
  content: { type: String },
  resources: [{ title: String, url: String, type: { type: String, enum: ['video', 'article', 'pdf'] } }],
  tags: [{ type: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submissionCount: { type: Number, default: 0 },
}, { timestamps: true });

// ─── SUBMISSION MODEL ──────────────────────────────────────────────────────────
// Status flow: under_review → completed (accepted) | rejected (rejected by admin)
const submissionSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  content: { type: String },
  fileUrl: { type: String },
  status: {
    type: String,
    enum: ['under_review', 'completed', 'rejected'],
    default: 'under_review',  // always starts as under_review — admin must accept
  },
  score: { type: Number, min: 0, max: 100 },
  feedback: { type: String },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now },
  timeTaken: { type: Number }, // seconds
}, { timestamps: true });

// ─── NOTIFICATION MODEL ────────────────────────────────────────────────────────
// Used for both admin alerts (new submission) and student alerts (reviewed)
const notificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'new_submission',   // → admin: student submitted a task
      'submission_accepted', // → student: admin accepted your answer
      'submission_rejected', // → student: admin rejected your answer
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  submission: { type: Schema.Types.ObjectId, ref: 'Submission' },
  task: { type: Schema.Types.ObjectId, ref: 'Task' },
  student: { type: Schema.Types.ObjectId, ref: 'User' }, // for admin notifications
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

// ─── COURSE MODEL ─────────────────────────────────────────────────────────────
const lessonSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String },
  videoUrl: { type: String },
  duration: { type: Number, default: 0 },
  order: { type: Number, required: true },
  isPreview: { type: Boolean, default: false },
  resources: [{ title: String, url: String }],
});

const moduleSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  order: { type: Number, required: true },
  lessons: [lessonSchema],
});

const courseSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  thumbnail: { type: String },
  category: {
    type: String,
    enum: ['dsa', 'web-dev', 'system-design', 'aptitude', 'soft-skills', 'interview-prep'],
    required: true,
  },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  tags: [{ type: String }],
  modules: [moduleSchema],
  isPublished: { type: Boolean, default: false },
  enrolledCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  totalDuration: { type: Number, default: 0 },
  totalLessons: { type: Number, default: 0 },
}, { timestamps: true });

// ─── QUIZ MODEL ────────────────────────────────────────────────────────────────
const questionSchema = new Schema({
  text: { type: String, required: true },
  options: [{ text: String, isCorrect: Boolean }],
  explanation: { type: String },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  points: { type: Number, default: 5 },
});

const quizSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  questions: [questionSchema],
  timeLimit: { type: Number, default: 30 },
  passingScore: { type: Number, default: 70 },
  isPublished: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// ─── PROGRESS MODEL ────────────────────────────────────────────────────────────
const progressSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  coursesEnrolled: [{
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    enrolledAt: { type: Date, default: Date.now },
    completedLessons: [{ type: String }],
    completionPercentage: { type: Number, default: 0 },
    lastAccessedAt: Date,
  }],
  tasksCompleted: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  tasksMissed: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  quizAttempts: [{
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz' },
    score: Number,
    passed: Boolean,
    attemptedAt: Date,
  }],
  weeklyActivity: [{
    week: Date,
    tasksCompleted: { type: Number, default: 0 },
    hoursSpent: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
  }],
  totalTasksCompleted: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
}, { timestamps: true });

// ─── INTERVIEW SESSION MODEL ───────────────────────────────────────────────────
const interviewSessionSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['hr', 'technical', 'coding', 'behavioral', 'system-design'], required: true },
  questions: [{
    question: String,
    answer: String,
    aiFeedback: String,
    score: Number,
    improvementTips: [String],
  }],
  overallScore: { type: Number, default: 0 },
  overallFeedback: { type: String },
  communicationScore: { type: Number, default: 0 },
  technicalScore: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
}, { timestamps: true });

// ─── CODING QUESTION MODEL ─────────────────────────────────────────────────────
const codingQuestionSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  topic: {
    type: String,
    enum: ['array', 'string', 'dp', 'graph', 'tree', 'linkedlist', 'sorting', 'greedy', 'backtracking', 'math', 'twopointers', 'binarysearch', 'stack', 'queue', 'heap'],
    required: true,
  },
  companies: [{ type: String }],
  examples: [{ input: String, output: String, explanation: String }],
  constraints: [{ type: String }],
  hints: [{ type: String }],
  solution: { type: String },
  solutionExplanation: { type: String },
  timeComplexity: { type: String },
  spaceComplexity: { type: String },
  acceptance: { type: Number, default: 0 },
  totalAttempts: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// ─── ANNOUNCEMENT MODEL ────────────────────────────────────────────────────────
const announcementSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['general', 'reminder', 'tip', 'urgent'], default: 'general' },
  targetRole: { type: String, enum: ['all', 'student', 'admin'], default: 'all' },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const User         = mongoose.model('User', userSchema);
export const Task         = mongoose.model('Task', taskSchema);
export const Submission   = mongoose.model('Submission', submissionSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Course       = mongoose.model('Course', courseSchema);
export const Quiz         = mongoose.model('Quiz', quizSchema);
export const Progress     = mongoose.model('Progress', progressSchema);
export const InterviewSession  = mongoose.model('InterviewSession', interviewSessionSchema);
export const CodingQuestion    = mongoose.model('CodingQuestion', codingQuestionSchema);
export const Announcement      = mongoose.model('Announcement', announcementSchema);

// ─── APTITUDE QUIZ MODEL ──────────────────────────────────────────────────────
const aptitudeQuizSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  topic: {
    type: String,
    enum: ['quantitative','logical','verbal','data-interpretation','general-knowledge','reasoning','technical'],
    required: true,
  },
  difficulty: { type: String, enum: ['easy','medium','hard'], default: 'medium' },
  timeLimit: { type: Number, default: 20 }, // minutes
  passingScore: { type: Number, default: 60 },
  isPublished: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [{
    text: { type: String, required: true },
    options: [{ text: String, isCorrect: Boolean }],
    explanation: { type: String },
    points: { type: Number, default: 4 },
    negativeMark: { type: Number, default: 1 }, // negative marking
    imageUrl: { type: String },
  }],
  totalAttempts: { type: Number, default: 0 },
}, { timestamps: true });

// ─── APTITUDE QUIZ ATTEMPT ────────────────────────────────────────────────────
const aptitudeAttemptSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: Schema.Types.ObjectId, ref: 'AptitudeQuiz', required: true },
  answers: [{
    questionIndex: Number,
    selectedOption: Number,   // index of selected option
    isCorrect: Boolean,
    pointsEarned: Number,
    timeTaken: Number,        // seconds per question
  }],
  score: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  timeTaken: { type: Number, default: 0 }, // total seconds
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  status: { type: String, enum: ['in_progress','completed'], default: 'in_progress' },
}, { timestamps: true });

// ─── CODING PROBLEM MODEL ─────────────────────────────────────────────────────
const testCaseSchema = new Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false }, // hidden test cases
  explanation: { type: String },
});

const codingProblemSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['easy','medium','hard'], required: true },
  topic: { type: String, required: true },
  companies: [{ type: String }],
  tags: [{ type: String }],
  constraints: [{ type: String }],
  examples: [{
    input: String,
    output: String,
    explanation: String,
  }],
  testCases: [testCaseSchema],
  starterCode: {
    javascript: { type: String, default: '// Write your solution here\nfunction solution(input) {\n  \n}' },
    python: { type: String, default: '# Write your solution here\ndef solution(input):\n    pass' },
    java: { type: String, default: 'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}' },
    cpp: { type: String, default: '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    \n    return 0;\n}' },
  },
  solution: { type: String },
  solutionExplanation: { type: String },
  timeComplexity: { type: String },
  spaceComplexity: { type: String },
  maxPoints: { type: Number, default: 100 },
  isPublished: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  totalAttempts: { type: Number, default: 0 },
  totalSolved: { type: Number, default: 0 },
}, { timestamps: true });

// ─── CODING SUBMISSION MODEL ──────────────────────────────────────────────────
const codingSubmissionSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  problem: { type: Schema.Types.ObjectId, ref: 'CodingProblem', required: true },
  code: { type: String, required: true },
  language: { type: String, enum: ['javascript','python','java','cpp'], required: true },
  status: {
    type: String,
    enum: ['pending','running','accepted','wrong_answer','time_limit','runtime_error','compile_error'],
    default: 'pending',
  },
  testResults: [{
    testCase: Number,
    input: String,
    expectedOutput: String,
    actualOutput: String,
    passed: Boolean,
    isHidden: Boolean,
    executionTime: Number, // ms
    error: String,
  }],
  passedTestCases: { type: Number, default: 0 },
  totalTestCases: { type: Number, default: 0 },
  pointsEarned: { type: Number, default: 0 },
  executionTime: { type: Number, default: 0 },
  memoryUsed: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// ─── HR TASK MODEL ────────────────────────────────────────────────────────────
const hrTaskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['behavioral','situational','competency','motivation','culture-fit','leadership','communication','technical'],
    required: true,
  },
  difficulty: { type: String, enum: ['easy','medium','hard'], default: 'medium' },
  instructions: { type: String },
  sampleAnswer: { type: String }, // shown after submission
  tips: [{ type: String }],
  maxPoints: { type: Number, default: 20 },
  isPublished: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rubric: [{
    criterion: String,
    maxScore: Number,
    description: String,
  }],
}, { timestamps: true });

// ─── HR SUBMISSION MODEL ──────────────────────────────────────────────────────
const hrSubmissionSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: Schema.Types.ObjectId, ref: 'HRTask', required: true },
  answer: { type: String, required: true },
  status: {
    type: String,
    enum: ['under_review','reviewed'],
    default: 'under_review',
  },
  rubricScores: [{
    criterion: String,
    score: Number,
    maxScore: Number,
    feedback: String,
  }],
  totalScore: { type: Number },
  overallFeedback: { type: String },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const AptitudeQuiz     = mongoose.model('AptitudeQuiz', aptitudeQuizSchema);
export const AptitudeAttempt  = mongoose.model('AptitudeAttempt', aptitudeAttemptSchema);
export const CodingProblem    = mongoose.model('CodingProblem', codingProblemSchema);
export const CodingSubmission = mongoose.model('CodingSubmission', codingSubmissionSchema);
export const HRTask           = mongoose.model('HRTask', hrTaskSchema);
export const HRSubmission     = mongoose.model('HRSubmission', hrSubmissionSchema);
