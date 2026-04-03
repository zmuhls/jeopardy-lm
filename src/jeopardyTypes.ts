export interface Rating {
  rating: 'good' | 'bad';
  timestamp: string;
}

export interface Question {
  text: string;
  answer: string;
  value: number;
  revealed: boolean;
  answered: boolean;
  dailyDouble?: boolean;
  ruleViolation?: string | null;
  ratings?: Rating[];
}

export interface DifficultyAdjustments {
  [key: number]: number;
}

export interface Category {
  title: string;
  questions: Question[];
  difficultyAdjustments?: DifficultyAdjustments;
}

export interface Player {
  name: string;
  score: number;
  active: boolean;
}

export interface GameState {
  categories: Category[];
  players: Player[];
  currentPlayer: number;
  finalJeopardyActive: boolean;
}

export interface IncorrectPlayers {
  [key: number]: boolean;
}

export type AIProvider = 'openrouter' | 'ollama';
