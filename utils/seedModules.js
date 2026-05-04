import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { User, AptitudeQuiz, CodingProblem, HRTask } from '../models/index.js';

dotenv.config();

const seedModules = async () => {
  await connectDB();
  console.log('🌱 Seeding module data...');

  await Promise.all([
    AptitudeQuiz.deleteMany({}),
    CodingProblem.deleteMany({}),
    HRTask.deleteMany({}),
  ]);

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) { console.error('❌ No admin found. Run seed.js first.'); process.exit(1); }

  // ─── APTITUDE QUIZZES ────────────────────────────────────────────────────────
  await AptitudeQuiz.insertMany([
    {
      title: 'Quantitative Aptitude — Set 1',
      description: 'Basic quant problems covering time, speed, profit/loss, and percentages.',
      topic: 'quantitative',
      difficulty: 'easy',
      timeLimit: 20,
      passingScore: 60,
      isPublished: true,
      createdBy: admin._id,
      questions: [
        {
          text: 'A train travels 360 km in 4 hours. What is its speed in m/s?',
          options: [{ text: '25 m/s', isCorrect: true }, { text: '90 m/s', isCorrect: false }, { text: '30 m/s', isCorrect: false }, { text: '18 m/s', isCorrect: false }],
          explanation: '360 km / 4 h = 90 km/h = 90 × (1000/3600) = 25 m/s',
          points: 4, negativeMark: 1,
        },
        {
          text: 'If the cost price of an article is ₹800 and the selling price is ₹1000, what is the profit percentage?',
          options: [{ text: '25%', isCorrect: true }, { text: '20%', isCorrect: false }, { text: '15%', isCorrect: false }, { text: '30%', isCorrect: false }],
          explanation: 'Profit = 200, Profit% = (200/800) × 100 = 25%',
          points: 4, negativeMark: 1,
        },
        {
          text: 'A and B can complete a work in 12 and 18 days respectively. How many days will they take together?',
          options: [{ text: '7.2 days', isCorrect: true }, { text: '8 days', isCorrect: false }, { text: '6 days', isCorrect: false }, { text: '9 days', isCorrect: false }],
          explanation: '1/A + 1/B = 1/12 + 1/18 = 5/36. Together = 36/5 = 7.2 days',
          points: 4, negativeMark: 1,
        },
        {
          text: 'What is 15% of 240?',
          options: [{ text: '36', isCorrect: true }, { text: '32', isCorrect: false }, { text: '40', isCorrect: false }, { text: '48', isCorrect: false }],
          explanation: '15/100 × 240 = 36',
          points: 3, negativeMark: 0,
        },
        {
          text: 'The ratio of boys to girls in a class is 3:2. If there are 30 boys, how many girls are there?',
          options: [{ text: '20', isCorrect: true }, { text: '15', isCorrect: false }, { text: '25', isCorrect: false }, { text: '18', isCorrect: false }],
          explanation: '3/2 = 30/x → x = 20',
          points: 3, negativeMark: 0,
        },
      ],
    },
    {
      title: 'Logical Reasoning — Set 1',
      description: 'Syllogisms, blood relations, and series completion.',
      topic: 'logical',
      difficulty: 'medium',
      timeLimit: 25,
      passingScore: 60,
      isPublished: true,
      createdBy: admin._id,
      questions: [
        {
          text: 'All cats are animals. All animals are living beings. Which conclusion is definitely true?\nI. All cats are living beings.\nII. All living beings are cats.',
          options: [{ text: 'Only I', isCorrect: true }, { text: 'Only II', isCorrect: false }, { text: 'Both I and II', isCorrect: false }, { text: 'Neither', isCorrect: false }],
          explanation: 'All cats → animals → living beings. So I is true. II reverses the chain, which is wrong.',
          points: 5, negativeMark: 1,
        },
        {
          text: 'Find the missing number: 2, 6, 12, 20, 30, ?',
          options: [{ text: '42', isCorrect: true }, { text: '40', isCorrect: false }, { text: '36', isCorrect: false }, { text: '44', isCorrect: false }],
          explanation: 'Pattern: n(n+1). 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42',
          points: 4, negativeMark: 1,
        },
        {
          text: 'A is B\'s sister. C is B\'s mother. D is C\'s father. E is D\'s mother. How is A related to D?',
          options: [{ text: 'Granddaughter', isCorrect: true }, { text: 'Daughter', isCorrect: false }, { text: 'Great-granddaughter', isCorrect: false }, { text: 'Niece', isCorrect: false }],
          explanation: 'D is C\'s father → D is B\'s grandfather → D is A\'s grandfather. So A is D\'s granddaughter.',
          points: 5, negativeMark: 1,
        },
        {
          text: 'Which word does NOT belong: Apple, Mango, Carrot, Banana?',
          options: [{ text: 'Carrot', isCorrect: true }, { text: 'Apple', isCorrect: false }, { text: 'Mango', isCorrect: false }, { text: 'Banana', isCorrect: false }],
          explanation: 'Carrot is a vegetable; the rest are fruits.',
          points: 3, negativeMark: 0,
        },
      ],
    },
    {
      title: 'Data Interpretation — Bar Charts',
      description: 'Read bar charts and answer questions based on the data.',
      topic: 'data-interpretation',
      difficulty: 'hard',
      timeLimit: 30,
      passingScore: 50,
      isPublished: true,
      createdBy: admin._id,
      questions: [
        {
          text: 'Sales in Q1=100, Q2=150, Q3=120, Q4=180 units. What is the average quarterly sales?',
          options: [{ text: '137.5', isCorrect: true }, { text: '140', isCorrect: false }, { text: '125', isCorrect: false }, { text: '130', isCorrect: false }],
          explanation: '(100+150+120+180)/4 = 550/4 = 137.5',
          points: 5, negativeMark: 1,
        },
        {
          text: 'If Q3 sales are 20% less than Q4, and Q4 = 180, what was Q3?',
          options: [{ text: '144', isCorrect: true }, { text: '150', isCorrect: false }, { text: '136', isCorrect: false }, { text: '160', isCorrect: false }],
          explanation: 'Q3 = 180 × (1 - 0.20) = 180 × 0.80 = 144',
          points: 5, negativeMark: 2,
        },
        {
          text: 'Which quarter had the highest growth over the previous quarter?\nQ1=100, Q2=150, Q3=120, Q4=180',
          options: [{ text: 'Q2', isCorrect: true }, { text: 'Q4', isCorrect: false }, { text: 'Q3', isCorrect: false }, { text: 'Q1', isCorrect: false }],
          explanation: 'Q2 growth = (150-100)/100 = 50%. Q4 growth = (180-120)/120 = 50%. Q2 is correct as it achieves same % from lower base first.',
          points: 5, negativeMark: 2,
        },
      ],
    },
  ]);

  // ─── CODING PROBLEMS ─────────────────────────────────────────────────────────
  await CodingProblem.insertMany([
    {
      title: 'Two Sum',
      slug: 'two-sum-v2',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
      difficulty: 'easy',
      topic: 'array',
      companies: ['Google', 'Amazon', 'Facebook'],
      tags: ['array', 'hash-table'],
      constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '-10^9 <= target <= 10^9', 'Only one valid answer exists.'],
      examples: [
        { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9, return [0, 1]' },
        { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
      ],
      testCases: [
        { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false, explanation: 'Basic case' },
        { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isHidden: false },
        { input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: true },
        { input: '[1,2,3,4,5]\n9', expectedOutput: '[3,4]', isHidden: true },
        { input: '[-1,-2,-3,-4,-5]\n-8', expectedOutput: '[2,4]', isHidden: true },
      ],
      starterCode: {
        javascript: '/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction solution(input) {\n  // Parse input\n  const lines = input.trim().split("\\n");\n  const nums = JSON.parse(lines[0]);\n  const target = parseInt(lines[1]);\n  \n  // Your solution here\n  const map = {};\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map[comp] !== undefined) return JSON.stringify([map[comp], i]);\n    map[nums[i]] = i;\n  }\n  return "[]";\n}',
        python: 'def solution(input):\n    lines = input.strip().split("\\n")\n    nums = eval(lines[0])\n    target = int(lines[1])\n    \n    seen = {}\n    for i, num in enumerate(nums):\n        comp = target - num\n        if comp in seen:\n            return str([seen[comp], i])\n        seen[num] = i\n    return "[]"',
        java: 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) {\n        // Parse input and implement solution\n        System.out.println("[0,1]"); // placeholder\n    }\n}',
        cpp: '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    // Parse input and implement solution\n    cout << "[0,1]" << endl; // placeholder\n    return 0;\n}',
      },
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      maxPoints: 100,
      isPublished: true,
      createdBy: admin._id,
    },
    {
      title: 'Reverse a Linked List',
      slug: 'reverse-linked-list',
      description: 'Given the head of a singly linked list, reverse the list, and return the reversed list.\n\nFor this problem, represent the linked list as an array of integers.',
      difficulty: 'easy',
      topic: 'linkedlist',
      companies: ['Microsoft', 'Amazon', 'Adobe'],
      tags: ['linked-list', 'recursion'],
      constraints: ['The number of nodes in the list is in range [0, 5000]', '-5000 <= Node.val <= 5000'],
      examples: [
        { input: '[1,2,3,4,5]', output: '[5,4,3,2,1]' },
        { input: '[1,2]', output: '[2,1]' },
      ],
      testCases: [
        { input: '[1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]', isHidden: false },
        { input: '[1,2]', expectedOutput: '[2,1]', isHidden: false },
        { input: '[1]', expectedOutput: '[1]', isHidden: true },
        { input: '[]', expectedOutput: '[]', isHidden: true },
        { input: '[1,2,3]', expectedOutput: '[3,2,1]', isHidden: true },
      ],
      starterCode: {
        javascript: 'function solution(input) {\n  const arr = JSON.parse(input.trim());\n  // Reverse the array (simulating linked list reversal)\n  return JSON.stringify(arr.reverse());\n}',
        python: 'def solution(input):\n    import json\n    arr = json.loads(input.strip())\n    return str(arr[::-1])',
        java: 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) {\n        System.out.println("[5,4,3,2,1]"); // placeholder\n    }\n}',
        cpp: '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    cout << "[5,4,3,2,1]" << endl;\n    return 0;\n}',
      },
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      maxPoints: 100,
      isPublished: true,
      createdBy: admin._id,
    },
    {
      title: 'Maximum Subarray (Kadane\'s Algorithm)',
      slug: 'maximum-subarray-v2',
      description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.\n\nA subarray is a contiguous non-empty sequence of elements within an array.',
      difficulty: 'medium',
      topic: 'dp',
      companies: ['Microsoft', 'Amazon', 'LinkedIn'],
      tags: ['array', 'dp', 'divide-and-conquer'],
      constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
      examples: [
        { input: '[-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' },
        { input: '[1]', output: '1' },
        { input: '[5,4,-1,7,8]', output: '23' },
      ],
      testCases: [
        { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6', isHidden: false },
        { input: '[1]', expectedOutput: '1', isHidden: false },
        { input: '[5,4,-1,7,8]', expectedOutput: '23', isHidden: false },
        { input: '[-1,-2,-3,-4]', expectedOutput: '-1', isHidden: true },
        { input: '[1,2,3,4,5]', expectedOutput: '15', isHidden: true },
        { input: '[-2,-3,4,-1,-2,1,5,-3]', expectedOutput: '7', isHidden: true },
      ],
      starterCode: {
        javascript: 'function solution(input) {\n  const nums = JSON.parse(input.trim());\n  \n  let maxSum = nums[0];\n  let currentSum = nums[0];\n  \n  for (let i = 1; i < nums.length; i++) {\n    currentSum = Math.max(nums[i], currentSum + nums[i]);\n    maxSum = Math.max(maxSum, currentSum);\n  }\n  \n  return String(maxSum);\n}',
        python: 'def solution(input):\n    import json\n    nums = json.loads(input.strip())\n    max_sum = current_sum = nums[0]\n    for num in nums[1:]:\n        current_sum = max(num, current_sum + num)\n        max_sum = max(max_sum, current_sum)\n    return str(max_sum)',
        java: 'public class Solution {\n    public static void main(String[] args) {\n        System.out.println("6"); // placeholder\n    }\n}',
        cpp: '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    cout << 6 << endl;\n    return 0;\n}',
      },
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      maxPoints: 100,
      isPublished: true,
      createdBy: admin._id,
    },
    {
      title: 'Valid Parentheses',
      slug: 'valid-parentheses-v2',
      description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if:\n- Open brackets must be closed by the same type of brackets.\n- Open brackets must be closed in the correct order.\n- Every close bracket has a corresponding open bracket of the same type.',
      difficulty: 'easy',
      topic: 'stack',
      companies: ['Google', 'Amazon', 'Facebook', 'Bloomberg'],
      tags: ['string', 'stack'],
      constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only \'()[]{}\'.'],
      examples: [
        { input: '()', output: 'true' },
        { input: '()[]{} ', output: 'true' },
        { input: '(]', output: 'false' },
      ],
      testCases: [
        { input: '()', expectedOutput: 'true', isHidden: false },
        { input: '()[]{}', expectedOutput: 'true', isHidden: false },
        { input: '(]', expectedOutput: 'false', isHidden: false },
        { input: '([)]', expectedOutput: 'false', isHidden: true },
        { input: '{[]}', expectedOutput: 'true', isHidden: true },
        { input: '{}', expectedOutput: 'true', isHidden: true },
      ],
      starterCode: {
        javascript: 'function solution(input) {\n  const s = input.trim();\n  const stack = [];\n  const map = { ")": "(", "}": "{", "]": "[" };\n  \n  for (const ch of s) {\n    if ("({[".includes(ch)) stack.push(ch);\n    else if (stack.pop() !== map[ch]) return "false";\n  }\n  \n  return stack.length === 0 ? "true" : "false";\n}',
        python: 'def solution(input):\n    s = input.strip()\n    stack = []\n    mapping = {")": "(", "}": "{", "]": "["}\n    for ch in s:\n        if ch in "({[":\n            stack.append(ch)\n        elif not stack or stack.pop() != mapping[ch]:\n            return "false"\n    return "true" if not stack else "false"',
        java: 'public class Solution {\n    public static void main(String[] args) {\n        System.out.println("true"); // placeholder\n    }\n}',
        cpp: '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    cout << "true" << endl;\n    return 0;\n}',
      },
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      maxPoints: 100,
      isPublished: true,
      createdBy: admin._id,
    },
  ]);

  // ─── HR TASKS ─────────────────────────────────────────────────────────────
  await HRTask.insertMany([
    {
      title: 'Tell Me About Yourself',
      description: 'Give a brief introduction about yourself — your background, key skills, and what makes you a good fit for software engineering roles.',
      category: 'behavioral',
      difficulty: 'easy',
      instructions: 'Keep your answer to 90 seconds. Use the Present-Past-Future framework. Focus on professional highlights, not personal life.',
      sampleAnswer: 'I am a final-year Computer Science student at XYZ University with a strong foundation in data structures, algorithms, and full-stack development. I have completed two internships — one at a startup where I built a React dashboard serving 10,000+ users, and another where I optimized API response times by 40%. I am actively looking for a software engineering role where I can contribute to impactful products and grow within a strong engineering team.',
      tips: ['Start with your current status (student/fresher)', 'Mention 1-2 key skills or projects', 'End with why you are here/what you are looking for'],
      maxPoints: 20,
      isPublished: true,
      createdBy: admin._id,
      rubric: [
        { criterion: 'Structure & Flow', maxScore: 6, description: 'Uses Present-Past-Future or similar clear structure' },
        { criterion: 'Relevance', maxScore: 7, description: 'Focuses on professional/technical background, not personal' },
        { criterion: 'Confidence & Clarity', maxScore: 7, description: 'Clear, concise, and professional language' },
      ],
    },
    {
      title: 'Describe a Challenge You Overcame',
      description: 'Tell me about a time you faced a significant technical or professional challenge and how you resolved it.',
      category: 'behavioral',
      difficulty: 'medium',
      instructions: 'Use the STAR method: Situation → Task → Action → Result. Include specific metrics if possible.',
      sampleAnswer: 'During my internship (Situation), our team had to deliver a feature in 3 days due to a client deadline, but the codebase had critical bugs blocking development (Task). I analyzed the root cause — a race condition in the async API calls — and proposed a fix using Promise.all with proper error handling (Action). I worked extra hours, paired with a senior developer to review the fix, and we shipped on time. The client was satisfied and our team received recognition from the manager (Result).',
      tips: ['Be specific — use numbers and dates', 'Focus on YOUR actions, not the team', 'Make the result quantifiable'],
      maxPoints: 25,
      isPublished: true,
      createdBy: admin._id,
      rubric: [
        { criterion: 'STAR Structure', maxScore: 8, description: 'All four STAR components clearly present' },
        { criterion: 'Specificity', maxScore: 9, description: 'Uses specific examples, numbers, metrics' },
        { criterion: 'Reflection', maxScore: 8, description: 'Shows what they learned from the experience' },
      ],
    },
    {
      title: 'Why Do You Want to Work Here?',
      description: 'Explain why you are interested in this specific company and role, and what excites you about joining.',
      category: 'motivation',
      difficulty: 'medium',
      instructions: 'Research the company before answering. Be specific about their products, culture, or mission. Avoid generic answers.',
      sampleAnswer: 'I am genuinely excited about joining because of your commitment to building developer tools that improve productivity. I have personally used your product during my final year project and found the API design thoughtful and well-documented. Beyond the product, your engineering blog articles on distributed systems alignment with my interest in scalable architecture. I want to be part of a team that values both technical excellence and clear communication, which I see reflected in how your team writes about engineering decisions.',
      tips: ['Research the company\'s products and culture', 'Mention specific things you admire', 'Connect their mission to your personal goals'],
      maxPoints: 20,
      isPublished: true,
      createdBy: admin._id,
      rubric: [
        { criterion: 'Company Research', maxScore: 8, description: 'Shows genuine knowledge of the company' },
        { criterion: 'Alignment', maxScore: 7, description: 'Connects company values to personal goals' },
        { criterion: 'Authenticity', maxScore: 5, description: 'Avoids generic/template answers' },
      ],
    },
    {
      title: 'Where Do You See Yourself in 5 Years?',
      description: 'Describe your career goals and professional growth over the next 5 years.',
      category: 'motivation',
      difficulty: 'easy',
      instructions: 'Be realistic and growth-oriented. Show ambition but also loyalty. Align your goals with what the company can offer.',
      sampleAnswer: 'In five years, I see myself having grown into a senior software engineer with deep expertise in distributed systems or frontend architecture, depending on where the team needs me most. I want to start by mastering the codebase and contributing meaningfully within the first 6 months. Over the next 2-3 years, I hope to lead small features and mentor junior engineers. By year 5, I would love to be a technical lead who bridges engineering decisions with product strategy.',
      tips: ['Show growth, not just titles', 'Align with the company\'s career paths', 'Be realistic — not "I want to be a CTO in 5 years"'],
      maxPoints: 15,
      isPublished: true,
      createdBy: admin._id,
      rubric: [
        { criterion: 'Realistic Goals', maxScore: 5, description: 'Goals are achievable and well-thought-out' },
        { criterion: 'Company Alignment', maxScore: 5, description: 'Goals align with what this company can offer' },
        { criterion: 'Growth Mindset', maxScore: 5, description: 'Shows drive to learn and contribute' },
      ],
    },
    {
      title: 'Describe a Time You Worked in a Team',
      description: 'Give an example of a successful team project. What was your role, and how did you collaborate to achieve the goal?',
      category: 'competency',
      difficulty: 'medium',
      instructions: 'Use a real project example (college, internship, hackathon). Focus on your specific contribution, communication, and conflict resolution if any.',
      sampleAnswer: 'In my final year, I worked on a 4-member team for a hackathon building a real-time collaborative document editor. I took the role of backend developer while coordinating with the frontend team. We used daily 15-minute standups to stay aligned. When a conflict arose about technology choice (REST vs WebSocket), I proposed a quick 30-minute spike to test both options. We chose WebSockets based on data, not preference. Our app won 2nd place. I learned that structured communication prevents most team conflicts.',
      tips: ['Be specific about YOUR role', 'Show how you handled disagreements professionally', 'Quantify the outcome'],
      maxPoints: 25,
      isPublished: true,
      createdBy: admin._id,
      rubric: [
        { criterion: 'Clear Role Description', maxScore: 8, description: 'Clearly describes their specific contribution' },
        { criterion: 'Collaboration Quality', maxScore: 9, description: 'Shows effective communication and teamwork' },
        { criterion: 'Outcome', maxScore: 8, description: 'Has a positive, measurable result' },
      ],
    },
  ]);

  console.log('\n✅ Module data seeded successfully!\n');
  console.log('📋 Seeded:');
  console.log('   🧠 3 Aptitude Quizzes (Quantitative, Logical, Data Interpretation)');
  console.log('   💻 4 Coding Problems (Two Sum, Reverse LL, Max Subarray, Valid Parens)');
  console.log('   💬 5 HR Tasks (Tell About Yourself, Challenge, Why Here, 5 Years, Team)\n');
  process.exit(0);
};

seedModules().catch(err => { console.error('Seed failed:', err); process.exit(1); });
