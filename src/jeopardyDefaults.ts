import type { Category, DifficultyAdjustments, Player, Question } from './jeopardyTypes';

export const defaultCategories = [
  'World History',
  'Science',
  'Pop Culture',
  'Literature',
  'Sports',
  'Geography',
];

export const defaultValues = [200, 400, 600, 800, 1000];

export const createDifficultyAdjustments = (): DifficultyAdjustments => ({
  200: 0,
  400: 0,
  600: 0,
  800: 0,
  1000: 0,
});

export const createDefaultQuestion = (value: number): Question => ({
  text: `This clue worth $${value} needs to be filled in`,
  answer: 'What is the answer?',
  value,
  revealed: false,
  answered: false,
  dailyDouble: false,
  ruleViolation: null,
  ratings: [],
});

export const initializeCategories = (): Category[] =>
  defaultCategories.map((title) => ({
    title,
    questions: defaultValues.map(createDefaultQuestion),
    difficultyAdjustments: createDifficultyAdjustments(),
  }));

export const initializePlayers = (playerCount = 3): Player[] =>
  Array.from({ length: playerCount }, (_, index) => ({
    name: `Player ${index + 1}`,
    score: 0,
    active: index === 0,
  }));
