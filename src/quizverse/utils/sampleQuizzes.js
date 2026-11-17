// Pre-built sample quizzes for demonstration and frontend testing in Phase 4
import { generateQuestionId } from './quizHelpers.js';

export const SAMPLE_QUIZZES = [
  {
    title: 'Biology: Cell Structure & Cellular Energy',
    description: 'Practice quiz covering organelle functions, ATP synthesis, and respiration mechanisms.',
    sourceType: 'topic',
    sourceName: 'Biology',
    difficulty: 'medium',
    questions: [
      {
        id: generateQuestionId(0),
        question: 'Which cellular organelle is responsible for generating most of the chemical energy needed by the cell?',
        options: ['Mitochondria', 'Endoplasmic Reticulum', 'Golgi Apparatus', 'Lysosome'],
        correctIndex: 0,
        explanation: 'Mitochondria are often referred to as the powerhouses of the cell because they generate most of the cell supply of adenosine triphosphate (ATP) through oxidative phosphorylation.',
      },
      {
        id: generateQuestionId(1),
        question: 'During photosynthesis, where do the light-dependent reactions take place within plant cells?',
        options: ['Stroma', 'Thylakoid Membrane', 'Outer Chloroplast Membrane', 'Cytosol'],
        correctIndex: 1,
        explanation: 'The light-dependent reactions of photosynthesis occur in the thylakoid membranes of chloroplasts, where chlorophyll absorbs sunlight to produce ATP and NADPH.',
      },
      {
        id: generateQuestionId(2),
        question: 'Which molecule acts as the primary immediate energy currency in biological systems?',
        options: ['Glucose', 'NADH', 'Adenosine Triphosphate (ATP)', 'Ribose'],
        correctIndex: 2,
        explanation: 'ATP transports chemical energy within cells for metabolism, muscle contraction, and active transport.',
      },
      {
        id: generateQuestionId(3),
        question: 'What is the net gain of ATP molecules produced per glucose molecule during glycolysis alone?',
        options: ['2 ATP', '4 ATP', '32 ATP', '36 ATP'],
        correctIndex: 0,
        explanation: 'Glycolysis consumes 2 ATP molecules and generates 4 ATP molecules, resulting in a net gain of 2 ATP per glucose molecule.',
      },
      {
        id: generateQuestionId(4),
        question: 'Which process allows cells to produce ATP in the absence of oxygen?',
        options: ['Citric Acid Cycle', 'Electron Transport Chain', 'Fermentation', 'Calvin Cycle'],
        correctIndex: 2,
        explanation: 'Fermentation is an anaerobic pathway that regenerates NAD+ from NADH so that glycolysis can continue producing ATP in the absence of oxygen.',
      },
    ],
  },
  {
    title: 'Computer Science: Data Structures Essentials',
    description: 'Test your understanding of arrays, stacks, queues, hash tables, and big-O complexities.',
    sourceType: 'topic',
    sourceName: 'Computer Science',
    difficulty: 'medium',
    questions: [
      {
        id: generateQuestionId(0),
        question: 'What is the average-case time complexity for lookups in a well-distributed Hash Table?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctIndex: 0,
        explanation: 'With a uniform hash function and minimal collisions, average lookup time in a hash table is constant time O(1).',
      },
      {
        id: generateQuestionId(1),
        question: 'Which principle governs the order of operations in a standard Stack data structure?',
        options: ['FIFO (First In, First Out)', 'LIFO (Last In, First Out)', 'Priority-based', 'Random Access'],
        correctIndex: 1,
        explanation: 'A stack operates on the Last In, First Out (LIFO) principle, where the most recently added item is the first one removed.',
      },
      {
        id: generateQuestionId(2),
        question: 'In a balanced Binary Search Tree (AVL or Red-Black), what is the worst-case search time complexity?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
        correctIndex: 1,
        explanation: 'Because balanced BSTs maintain height approximately log₂(n), search, insert, and delete operations take O(log n) time in the worst case.',
      },
      {
        id: generateQuestionId(3),
        question: 'Which data structure is most appropriate for implementing a Breadth-First Search (BFS) graph traversal?',
        options: ['Stack', 'Queue', 'Priority Queue', 'Set'],
        correctIndex: 1,
        explanation: 'BFS explores graph vertices level by level using a First-In-First-Out Queue to keep track of discovered neighbors.',
      },
      {
        id: generateQuestionId(4),
        question: 'What is the main disadvantage of a contiguous Array compared to a singly Linked List?',
        options: [
          'Arrays do not allow O(1) random index access',
          'Arrays require contiguous memory and resizing can be O(n)',
          'Arrays use more pointer memory overhead per element',
          'Arrays cannot store primitive datatypes',
        ],
        correctIndex: 1,
        explanation: 'Arrays require contiguous memory blocks. When capacity is exceeded, resizing requires allocating a larger block and copying all elements, taking O(n) time.',
      },
    ],
  },
];
