import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, Task, Course, CodingQuestion, Announcement, Progress } from '../models/index.js';

dotenv.config();

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Course.deleteMany({}),
    CodingQuestion.deleteMany({}),
    Announcement.deleteMany({}),
    Progress.deleteMany({}),
  ]);

  const admin = await User.create({
    name: 'PrepWise Admin',
    email: 'admin@demo.com',
    password: 'password123',
    role: 'admin',
    isActive: true,
    totalPoints: 0,
  });

  const students = await User.insertMany([
    { name: 'Rahul Sharma', email: 'student@demo.com', password: 'password123', role: 'student', streak: 7, totalPoints: 450, preferredRole: 'Software Engineer', skillGoals: ['DSA', 'System Design', 'React'], dailyGoalMinutes: 90, isActive: true },
    { name: 'Priya Patel', email: 'priya@demo.com', password: 'password123', role: 'student', streak: 14, totalPoints: 820, preferredRole: 'Full Stack Developer', skillGoals: ['React', 'Node.js'], isActive: true },
    { name: 'Arjun Kumar', email: 'arjun@demo.com', password: 'password123', role: 'student', streak: 3, totalPoints: 210, preferredRole: 'Backend Developer', isActive: true },
  ]);

  await Progress.insertMany(students.map((s, i) => ({
    student: s._id,
    totalTasksCompleted: [23, 45, 12][i],
    totalPoints: [450, 820, 210][i],
  })));

  const today = new Date();
  const d = (offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    date.setDate(date.getDate() + offset);
    return date;
  };

  await Task.insertMany([
    { title: 'Two Sum Problem', description: 'Return indices of two numbers that add up to target.', content: '## Two Sum\n\nGiven `nums = [2,7,11,15]` and `target = 9`, return `[0,1]`.\n\n**Hint:** Use a hashmap for O(n) solution.', category: 'coding', difficulty: 'easy', topic: 'Arrays', scheduledDate: d(0), points: 15, isFeatured: true, isPublished: true, tags: ['array', 'hashmap'], createdBy: admin._id },
    { title: 'Work, Time & Distance — 5 Problems', description: 'Solve 5 aptitude problems under 15 minutes.', category: 'aptitude', difficulty: 'medium', topic: 'Time & Work', scheduledDate: d(0), points: 10, isPublished: true, createdBy: admin._id },
    { title: 'Tell Me About Yourself', description: 'Craft a 90-second self-introduction using Present-Past-Future framework.', category: 'hr', difficulty: 'easy', topic: 'Self Introduction', scheduledDate: d(0), points: 10, isPublished: true, createdBy: admin._id },
    { title: 'Design a URL Shortener', description: 'Design a scalable URL shortening service handling 100M requests/day.', category: 'system-design', difficulty: 'hard', topic: 'System Design', scheduledDate: d(0), points: 30, isFeatured: true, isPublished: true, createdBy: admin._id },
    { title: 'Binary Search Variants', description: 'Solve: first/last occurrence + search in rotated sorted array.', category: 'coding', difficulty: 'medium', topic: 'Binary Search', scheduledDate: d(1), points: 20, isPublished: true, tags: ['binary-search'], createdBy: admin._id },
    { title: 'Sliding Window Problems', description: 'Solve max sum subarray of size k and longest substring with k distinct chars.', category: 'coding', difficulty: 'medium', topic: 'Sliding Window', scheduledDate: d(1), points: 20, isPublished: true, createdBy: admin._id },
    { title: 'STAR Method Behavioral Questions', description: 'Write STAR responses for: conflict resolution, leadership, biggest failure.', category: 'communication', difficulty: 'medium', topic: 'Behavioral', scheduledDate: d(-1), points: 15, isPublished: true, createdBy: admin._id },
    { title: 'Profit, Loss & Percentage', description: 'Solve 6 aptitude problems on Profit, Loss, and Percentage.', category: 'aptitude', difficulty: 'easy', topic: 'Profit & Loss', scheduledDate: d(-1), points: 10, isPublished: true, createdBy: admin._id },
    { title: 'Database Normalization (1NF to BCNF)', description: 'Explain normalization forms with examples and design an e-commerce schema.', category: 'theory', difficulty: 'medium', topic: 'Databases', scheduledDate: d(-2), points: 20, isPublished: true, createdBy: admin._id },
    { title: 'Graph BFS & DFS', description: 'Implement BFS and DFS for both adjacency list and matrix representations.', category: 'coding', difficulty: 'medium', topic: 'Graphs', scheduledDate: d(-2), points: 25, isPublished: true, tags: ['graph', 'bfs', 'dfs'], createdBy: admin._id },
  ]);

  const courseData = [
    { title: 'DSA Mastery: Zero to Hero', description: 'Complete Data Structures & Algorithms for placement preparation.', category: 'dsa', level: 'beginner', tags: ['arrays', 'trees', 'dp'], isPublished: true, enrolledCount: 128, rating: 4.8, totalLessons: 45, totalDuration: 2700, modules: [{ title: 'Arrays & Strings', order: 1, lessons: [{ title: 'Introduction to Arrays', order: 1, duration: 20, isPreview: true }, { title: 'Two Pointer Technique', order: 2, duration: 35 }, { title: 'Sliding Window', order: 3, duration: 40, isPreview: true }] }, { title: 'Trees', order: 2, lessons: [{ title: 'Tree Traversals', order: 1, duration: 40, isPreview: true }, { title: 'BST Operations', order: 2, duration: 35 }] }, { title: 'Dynamic Programming', order: 3, lessons: [{ title: 'Intro to DP', order: 1, duration: 45, isPreview: true }, { title: '0/1 Knapsack', order: 2, duration: 50 }] }] },
    { title: 'System Design Interview Prep', description: 'Design scalable distributed systems. Load balancing, caching, databases, and real case studies.', category: 'system-design', level: 'advanced', tags: ['scaling', 'caching', 'databases'], isPublished: true, enrolledCount: 86, rating: 4.9, totalLessons: 20, totalDuration: 1800, modules: [{ title: 'Fundamentals', order: 1, lessons: [{ title: 'How to Approach System Design', order: 1, duration: 25, isPreview: true }, { title: 'CAP Theorem', order: 2, duration: 20 }, { title: 'Load Balancing', order: 3, duration: 30 }] }, { title: 'Case Studies', order: 2, lessons: [{ title: 'Design WhatsApp', order: 1, duration: 60, isPreview: true }, { title: 'Design URL Shortener', order: 2, duration: 40 }] }] },
    { title: 'Aptitude & Reasoning Bootcamp', description: '30-day bootcamp for quantitative, logical, and verbal ability.', category: 'aptitude', level: 'beginner', tags: ['quantitative', 'logical'], isPublished: true, enrolledCount: 204, rating: 4.6, totalLessons: 30, totalDuration: 1800, modules: [{ title: 'Quantitative Aptitude', order: 1, lessons: [{ title: 'Time, Speed & Distance', order: 1, duration: 30, isPreview: true }, { title: 'Profit & Loss', order: 2, duration: 25 }] }] },
    { title: 'HR Interview Mastery', description: 'Ace every HR interview with structured answers, negotiation tips, and body language.', category: 'interview-prep', level: 'beginner', tags: ['hr', 'behavioral'], isPublished: true, enrolledCount: 156, rating: 4.7, totalLessons: 18, totalDuration: 900, modules: [{ title: 'Common HR Questions', order: 1, lessons: [{ title: 'Tell Me About Yourself', order: 1, duration: 20, isPreview: true }, { title: 'Strengths & Weaknesses', order: 2, duration: 15 }, { title: 'Why This Company?', order: 3, duration: 15 }] }] },
  ];
  await Course.insertMany(courseData.map(c => ({ ...c, createdBy: admin._id })));

  const qBase = { createdBy: admin._id, isActive: true };
  await CodingQuestion.insertMany([
    { ...qBase, title: 'Two Sum', slug: 'two-sum', description: 'Return indices of two numbers that add up to target.', difficulty: 'easy', topic: 'array', companies: ['Google', 'Amazon', 'Facebook'], examples: [{ input: 'nums=[2,7,11,15], target=9', output: '[0,1]' }], hints: ['Use a hashmap'], timeComplexity: 'O(n)', spaceComplexity: 'O(n)', acceptance: 49 },
    { ...qBase, title: 'Longest Substring Without Repeating', slug: 'longest-substring-without-repeating', description: 'Find length of longest substring without repeating characters.', difficulty: 'medium', topic: 'string', companies: ['Amazon', 'Bloomberg', 'Adobe'], examples: [{ input: 's="abcabcbb"', output: '3' }], hints: ['Sliding window with a set'], timeComplexity: 'O(n)', spaceComplexity: 'O(k)', acceptance: 33 },
    { ...qBase, title: 'Merge K Sorted Lists', slug: 'merge-k-sorted-lists', description: 'Merge k sorted linked-lists into one sorted list.', difficulty: 'hard', topic: 'heap', companies: ['Google', 'Amazon', 'Uber'], examples: [{ input: 'lists=[[1,4,5],[1,3,4]]', output: '[1,1,3,4,4,5]' }], hints: ['Use a min-heap of size k'], timeComplexity: 'O(N log k)', spaceComplexity: 'O(k)', acceptance: 48 },
    { ...qBase, title: 'Climbing Stairs', slug: 'climbing-stairs', description: 'Count distinct ways to climb n stairs (1 or 2 steps at a time).', difficulty: 'easy', topic: 'dp', companies: ['Apple', 'Adobe', 'Uber'], examples: [{ input: 'n=3', output: '3', explanation: '1+1+1, 1+2, 2+1' }], hints: ['Fibonacci pattern'], timeComplexity: 'O(n)', spaceComplexity: 'O(1)', acceptance: 51 },
    { ...qBase, title: 'Maximum Subarray', slug: 'maximum-subarray', description: 'Find the contiguous subarray with the largest sum.', difficulty: 'medium', topic: 'dp', companies: ['Microsoft', 'Amazon', 'LinkedIn'], examples: [{ input: 'nums=[-2,1,-3,4,-1,2,1,-5,4]', output: '6' }], hints: ["Kadane's algorithm"], timeComplexity: 'O(n)', spaceComplexity: 'O(1)', acceptance: 50 },
    { ...qBase, title: 'Valid Parentheses', slug: 'valid-parentheses', description: 'Determine if the input string of brackets is valid.', difficulty: 'easy', topic: 'stack', companies: ['Google', 'Amazon', 'Facebook', 'Bloomberg'], examples: [{ input: 's="()[]{}"', output: 'true' }, { input: 's="(]"', output: 'false' }], hints: ['Use a stack'], timeComplexity: 'O(n)', spaceComplexity: 'O(n)', acceptance: 40 },
    { ...qBase, title: 'Binary Search', slug: 'binary-search', description: 'Search target in a sorted array, return index or -1.', difficulty: 'easy', topic: 'binarysearch', companies: ['Google', 'Facebook', 'Apple'], examples: [{ input: 'nums=[-1,0,3,5,9,12], target=9', output: '4' }], hints: ['left + (right - left) / 2 to avoid overflow'], timeComplexity: 'O(log n)', spaceComplexity: 'O(1)', acceptance: 55 },
    { ...qBase, title: 'Number of Islands', slug: 'number-of-islands', description: 'Count the number of islands in a binary grid.', difficulty: 'medium', topic: 'graph', companies: ['Amazon', 'Google', 'Microsoft', 'Bloomberg'], examples: [{ input: 'grid=2D binary matrix', output: '1' }], hints: ['DFS/BFS, mark visited cells'], timeComplexity: 'O(m*n)', spaceComplexity: 'O(m*n)', acceptance: 55 },
    { ...qBase, title: 'LRU Cache', slug: 'lru-cache', description: 'Implement LRU Cache with O(1) get and put.', difficulty: 'medium', topic: 'linkedlist', companies: ['Amazon', 'Microsoft', 'Google', 'Goldman Sachs'], examples: [{ input: 'capacity=2, operations=[put(1,1), put(2,2), get(1)]', output: '1' }], hints: ['HashMap + Doubly Linked List'], timeComplexity: 'O(1)', spaceComplexity: 'O(capacity)', acceptance: 41 },
    { ...qBase, title: 'Word Break', slug: 'word-break', description: 'Determine if string can be segmented using dictionary words.', difficulty: 'medium', topic: 'dp', companies: ['Google', 'Amazon', 'Facebook', 'Uber'], examples: [{ input: 's="leetcode", wordDict=["leet","code"]', output: 'true' }], hints: ['DP: dp[i] = can s[0..i] be segmented'], timeComplexity: 'O(n²)', spaceComplexity: 'O(n)', acceptance: 45 },
    { ...qBase, title: 'Course Schedule', slug: 'course-schedule', description: 'Determine if you can finish all courses given prerequisites (cycle detection in directed graph).', difficulty: 'medium', topic: 'graph', companies: ['Google', 'Facebook', 'Airbnb'], examples: [{ input: 'numCourses=2, prerequisites=[[1,0]]', output: 'true' }], hints: ['Topological sort / DFS cycle detection'], timeComplexity: 'O(V+E)', spaceComplexity: 'O(V+E)', acceptance: 45 },
    { ...qBase, title: 'Trapping Rain Water', slug: 'trapping-rain-water', description: 'Calculate how much water can be trapped between elevation bars.', difficulty: 'hard', topic: 'twopointers', companies: ['Amazon', 'Google', 'Facebook', 'Goldman Sachs'], examples: [{ input: 'height=[0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' }], hints: ['Two pointers from both ends', 'Track max left and max right'], timeComplexity: 'O(n)', spaceComplexity: 'O(1)', acceptance: 57 },
  ]);

  await Announcement.insertMany([
    { title: '🎉 Welcome to PrepWise AI!', content: 'Your AI-powered placement prep platform is live! Complete daily tasks, practice mock interviews, and build your streak. Consistency beats intensity!', type: 'general', targetRole: 'all', isActive: true, createdBy: admin._id },
    { title: '💡 Interview Tip: System Design', content: 'Always start system design with clarifying requirements before architecture. Ask about scale, read/write ratio, and consistency needs.', type: 'tip', targetRole: 'student', isActive: true, createdBy: admin._id },
    { title: '⏰ Complete All 4 Daily Tasks', content: "Today's 4 tasks are live! Completing all earns you a 25-point bonus. Don't break your streak!", type: 'reminder', targetRole: 'student', isActive: true, createdBy: admin._id },
  ]);

  console.log('\n✅ Database seeded!\n');
  console.log('👤 Demo Accounts:');
  console.log('   admin@demo.com    / password123  (Admin)');
  console.log('   student@demo.com  / password123  (🔥7d streak, 450pts)');
  console.log('   priya@demo.com    / password123  (🔥14d streak, 820pts)');
  console.log('   arjun@demo.com    / password123  (🔥3d streak, 210pts)\n');
  process.exit(0);
};

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
// NOTE: The main seed() function ends with process.exit(0) above.
// To seed new module data, run seedModules() separately:
// node -e "import('./utils/seedModules.js')"
