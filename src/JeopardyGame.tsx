import React, { useState, useEffect, useRef } from 'react';

// Define types for our game
interface Question {
  text: string;
  answer: string;
  value: number;
  revealed: boolean;
  answered: boolean;
  dailyDouble?: boolean;
  ruleViolation?: string | null;
}

interface Category {
  title: string;
  questions: Question[];
}

interface GameState {
  categories: Category[];
  players: Player[];
  currentPlayer: number;
  finalJeopardyActive: boolean;
}

interface Player {
  name: string;
  score: number;
  active: boolean;
}

interface IncorrectPlayers {
  [key: number]: boolean;
}

// API keys should be provided by users at runtime
const TEST_KEYS = {
  claude: '',
  openai: '',
  mistral: '',
  deepseek: '',
  meta: '',
  gemini: ''
};

// Default categories and questions
const defaultCategories = [
  "World History",
  "Science",
  "Pop Culture",
  "Literature",
  "Sports",
  "Geography"
];

const defaultValues = [200, 400, 600, 800, 1000];

// Generate placeholder questions
const createDefaultQuestions = (value: number): Question => ({
  text: "This clue worth $" + value + " needs to be filled in",
  answer: "What is the answer?",
  value: value,
  revealed: false,
  answered: false,
  dailyDouble: false,
  ruleViolation: null
});

// Initialize default categories with questions
const initializeCategories = (): Category[] => {
  return defaultCategories.map(title => ({
    title,
    questions: defaultValues.map(createDefaultQuestions)
  }));
};

// Initialize players with default player count
const initializePlayers = (playerCount: number = 3): Player[] => {
  const players: Player[] = [];
  for (let i = 1; i <= playerCount; i++) {
    players.push({ 
      name: `Player ${i}`, 
      score: 0, 
      active: i === 1 // First player is active by default
    });
  }
  return players;
};

export default function JeopardyGame() {
  // Game state
  // Player count state
  const [playerCount, setPlayerCount] = useState<number>(3);
  
  const [gameState, setGameState] = useState<GameState>({
    categories: initializeCategories(),
    players: initializePlayers(playerCount),
    currentPlayer: 0,
    finalJeopardyActive: false
  });
  
  // UI state
  const [selectedQuestion, setSelectedQuestion] = useState<{categoryIndex: number, questionIndex: number} | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [systemMessage, setSystemMessage] = useState('You are a Jeopardy! game creator tasked with generating well-structured, diverse Jeopardy! boards that follow the conventions and expectations of the game show. Your goal is to create categories, clues, and correct question-answer pairs that align with Jeopardy! standards. \n\nThe key principles are as follows:\n* Clarity & Precision: Ensure that all clues and question-answer pairs are clear, precise, and avoid ambiguity. There should be no room for misinterpretation of the clue\'s intent.\n* Specificity: Clues must lead to ONE unambiguous answer. Avoid vague clues that could reasonably accept multiple answers. Bad example: "This East Asian country is known for its unique blend of traditional and modern culture" - too vague, could be Japan, South Korea, China, etc. Good example: "Home to Samsung and Hyundai, this East Asian country has Seoul as its capital" - clearly points to South Korea only.\n* Variety & Creativity: Strive for a high level of variance in categories and clues. Avoid predictable, overused references, and ensure diversity across subject areas, from literature to science, pop culture, history, and beyond.\n* No Repetition: Each clue-question pair should be unique within the board. No duplication of answers or subjects should occur across categories.\n* Ground Truth Only: All clues must reflect accurate, verifiable information. Double-check facts to ensure correctness, and do not leave any opportunity for controversial interpretations of the clues.\n* Jeopardy! Rhetoric: Maintain the distinct Jeopardy! style in phrasing. Clues should be framed as statements, with the contestants providing the correct response in the form of a question.\n* Progressive Difficulty: The difficulty of questions should gradually increase corresponding to their dollar values. $200 questions should be easier, while $1000 questions should be more challenging, with a smooth gradient of difficulty for $400, $600, and $800 questions.\n* Avoid Redundancy in Themes: While categories may overlap in general topics (e.g., animals or countries), ensure the content within those categories does not repeat.\n* Maintain Clue Integrity: Do not reveal the answer to the clue in its explicit language. Category titles should NOT contain the answer or give away the solution to any clue.\n* STRICT WORD EXCLUSION RULE: The correct response/answer MUST NOT contain any words that appear in the clue or category. For example, if the clue mentions \"Greenwich Village\" then \"Greenwich Village\" cannot be part of the correct response. Ensure each answer refers to a specific, historically accurate entity or concept related to but not mentioned in the clue. Bad example: Category \"Neighborhoods\" with clue \"This Greenwich Village area was the epicenter of the Stonewall Riots\" and answer \"What is Greenwich Village?\" - this is incorrect because the answer repeats words from the clue. Good example: Category \"LGBTQ+ History\" with clue \"This 1969 uprising in Greenwich Village marked a turning point in the fight for gay rights\" and answer \"What are the Stonewall Riots?\" - this is correct because the answer doesn\'t repeat words from the clue.');
  const [referenceText, setReferenceText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gameTheme, setGameTheme] = useState('standard');
  const [incorrectPlayers, setIncorrectPlayers] = useState<IncorrectPlayers>({});
  const [dailyDoubleWager, setDailyDoubleWager] = useState<number | null>(null);
  const [showDailyDoubleWager, setShowDailyDoubleWager] = useState(false);
  
  // Save/Load functionality
  const [savedBoards, setSavedBoards] = useState<{name: string, date: string, data: GameState}[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveBoardName, setSaveBoardName] = useState('');
  
  // Board editing state
  const [showEditor, setShowEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{index: number, title: string} | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<{
    categoryIndex: number,
    questionIndex: number,
    text: string,
    answer: string,
    value: number,
    dailyDouble?: boolean
  } | null>(null);
  
  // Player management state
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const [editingPlayers, setEditingPlayers] = useState<Player[]>([]);
  const [tempPlayerCount, setTempPlayerCount] = useState(playerCount);
  
  // Initialize settings and load saved data
  useEffect(() => {
    // Check if we're running in the browser
    if (typeof window === 'undefined') return;
    
    try {
      // Load saved settings from localStorage
      const savedKey = localStorage.getItem('jeopardy_api_key');
      if (savedKey) setApiKey(savedKey);
      
      const savedProvider = localStorage.getItem('jeopardy_ai_provider');
      if (savedProvider) setAiProvider(savedProvider);
      
      const savedSystemMessage = localStorage.getItem('jeopardy_system_message');
      if (savedSystemMessage) setSystemMessage(savedSystemMessage);
      
      // Load saved boards from localStorage
      const savedBoardsData = localStorage.getItem('jeopardy_saved_boards');
      if (savedBoardsData) {
        try {
          const parsedBoards = JSON.parse(savedBoardsData);
          setSavedBoards(parsedBoards);
        } catch (e) {
          // Silent error handling for saved board parsing
        }
      }
      
      // Load theme preference
      const savedTheme = localStorage.getItem('jeopardy_theme');
      if (savedTheme) {
        setGameTheme(savedTheme);
      }
    } catch (error) {
      // Silent error handling for settings initialization
    }
  }, []);

  
  // Save theme preference to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jeopardy_theme', gameTheme);
    }
  }, [gameTheme]);
  
  // Save boards to localStorage whenever savedBoards changes
  useEffect(() => {
    if (typeof window !== 'undefined' && savedBoards.length > 0) {
      localStorage.setItem('jeopardy_saved_boards', JSON.stringify(savedBoards));
    }
  }, [savedBoards]);
  
  // Theme music functions have been temporarily removed

  // Handle category and question selection
  const handleQuestionSelect = (categoryIndex: number, questionIndex: number) => {
    const question = gameState.categories[categoryIndex].questions[questionIndex];
    
    if (question.answered) return;
    
    // Update the selected question
    setSelectedQuestion({ categoryIndex, questionIndex });
    setShowAnswer(false);
    
    // Reset incorrect players when selecting a new question
    setIncorrectPlayers({});
    
    // Mark question as revealed
    const updatedCategories = [...gameState.categories];
    updatedCategories[categoryIndex].questions[questionIndex].revealed = true;
    
    setGameState({
      ...gameState,
      categories: updatedCategories
    });
    
    // Ensure mobile scroll position is reset when opening a new question
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling on mobile
    }, 100);
    
    // Handle Daily Double differently
    if (question.dailyDouble) {
      // Show wager screen instead of question immediately
      setDailyDoubleWager(null);
      setShowDailyDoubleWager(true);
      
      // For Daily Double handling
    } else {
      // For regular questions, show question directly
      setShowDailyDoubleWager(false);
    }
  };
  
  // Handle Daily Double wager submission
  const handleDailyDoubleWager = (wager: number) => {
    if (!selectedQuestion) return;
    
    // Validate wager
    const { categoryIndex, questionIndex } = selectedQuestion;
    const question = gameState.categories[categoryIndex].questions[questionIndex];
    const playerScore = gameState.players[gameState.currentPlayer].score;
    
    // Maximum wager is either player's score or 1000, whichever is greater
    const maxWager = Math.max(playerScore, 1000);
    
    // Ensure wager is valid
    let finalWager = wager;
    if (wager < 100) finalWager = 100; // Minimum wager is $100
    if (wager > maxWager) finalWager = maxWager; // Maximum wager
    
    // Round to nearest $100 increment
    finalWager = Math.round(finalWager / 100) * 100;
    
    // Set the wager and show the question
    setDailyDoubleWager(finalWager);
    setShowDailyDoubleWager(false);
  };

  // Toggle incorrect player selection
  const toggleIncorrectPlayer = (playerIdx: number) => {
    setIncorrectPlayers(prev => ({
      ...prev,
      [playerIdx]: !prev[playerIdx]
    }));
  };

  // Handle answering questions
  const handleAnswer = (correct: boolean, playerIndex?: number) => {
    if (!selectedQuestion) return;
    
    
    const { categoryIndex, questionIndex } = selectedQuestion;
    let questionValue = gameState.categories[categoryIndex].questions[questionIndex].value;
    
    // If this is a Daily Double, use the wager instead of the standard value
    if (gameState.categories[categoryIndex].questions[questionIndex].dailyDouble && dailyDoubleWager !== null) {
      questionValue = dailyDoubleWager;
    }
    
    // Update player score - use provided playerIndex or current player if not specified
    const updatedPlayers = [...gameState.players];
    const scorePlayerIndex = playerIndex !== undefined ? playerIndex : gameState.currentPlayer;
    
    updatedPlayers[scorePlayerIndex].score += correct 
      ? questionValue 
      : -questionValue;
    
    // Mark question as answered
    const updatedCategories = [...gameState.categories];
    updatedCategories[categoryIndex].questions[questionIndex].answered = true;
    
    // If player who answered was correct, make them the current player, 
    // otherwise move to the next player
    let nextPlayerIndex;
    if (correct && playerIndex !== undefined) {
      nextPlayerIndex = playerIndex; // If correct, the player who answered gets control
    } else {
      nextPlayerIndex = (gameState.currentPlayer + 1) % gameState.players.length;
    }
    
    setGameState({
      ...gameState,
      categories: updatedCategories,
      players: updatedPlayers,
      currentPlayer: nextPlayerIndex
    });
    
    // Restore body scrolling
    document.body.style.overflow = '';
    
    // Close the question view and reset Daily Double state
    setSelectedQuestion(null);
    setShowAnswer(false);
    setDailyDoubleWager(null);
    setShowDailyDoubleWager(false);
  };
  
  // Handle deducting points from multiple players
  const handleMultipleIncorrect = () => {
    if (!selectedQuestion) return;
    
    const { categoryIndex, questionIndex } = selectedQuestion;
    let questionValue = gameState.categories[categoryIndex].questions[questionIndex].value;
    
    // If this is a Daily Double, use the wager instead of the standard value
    if (gameState.categories[categoryIndex].questions[questionIndex].dailyDouble && dailyDoubleWager !== null) {
      questionValue = dailyDoubleWager;
    }
    
    
    // Update player scores for all selected incorrect players
    const updatedPlayers = [...gameState.players];
    
    Object.keys(incorrectPlayers).forEach(playerIdxStr => {
      const playerIdx = parseInt(playerIdxStr, 10);
      if (incorrectPlayers[playerIdx]) {
        updatedPlayers[playerIdx].score -= questionValue;
      }
    });
    
    // Mark question as answered
    const updatedCategories = [...gameState.categories];
    updatedCategories[categoryIndex].questions[questionIndex].answered = true;
    
    // Move to the next player
    const nextPlayerIndex = (gameState.currentPlayer + 1) % gameState.players.length;
    
    setGameState({
      ...gameState,
      categories: updatedCategories,
      players: updatedPlayers,
      currentPlayer: nextPlayerIndex
    });
    
    // Reset incorrect players state
    setIncorrectPlayers({});
    
    // Restore body scrolling
    document.body.style.overflow = '';
    
    // Close the question view and reset Daily Double state
    setSelectedQuestion(null);
    setShowAnswer(false);
    setDailyDoubleWager(null);
    setShowDailyDoubleWager(false);
  };
  
  // Handle editing a category title
  const handleEditCategory = (index: number) => {
    if (!showEditor) return;
    setEditingCategory({
      index,
      title: gameState.categories[index].title
    });
  };
  
  // Save edited category title
  const saveCategory = () => {
    if (!editingCategory) return;
    
    const updatedCategories = [...gameState.categories];
    updatedCategories[editingCategory.index].title = editingCategory.title;
    
    setGameState({
      ...gameState,
      categories: updatedCategories
    });
    
    setEditingCategory(null);
  };
  
  // Handle editing a question
  const handleEditQuestion = (categoryIndex: number, questionIndex: number) => {
    if (!showEditor) return;
    
    const question = gameState.categories[categoryIndex].questions[questionIndex];
    setEditingQuestion({
      categoryIndex,
      questionIndex,
      text: question.text,
      answer: question.answer,
      value: question.value,
      dailyDouble: question.dailyDouble
    });
  };
  
  // Check if question follows the word exclusion rule and if it is specific enough
  const validateQuestionRule = (categoryTitle: string, questionText: string, answerText: string): { valid: boolean, reason?: string } => {
    // Normalize text for comparison (lowercase and remove punctuation)
    const normalizeText = (text: string) => {
      return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    };
    
    const normalizedCategory = normalizeText(categoryTitle);
    const normalizedQuestion = normalizeText(questionText);
    const normalizedAnswer = normalizeText(answerText);
    
    // Extract all words from category and question
    const categoryWords = normalizedCategory.split(/\s+/).filter(word => word.length > 2); // Filter out short words
    const questionWords = normalizedQuestion.split(/\s+/).filter(word => word.length > 2); // Filter out short words
    const answerWords = normalizedAnswer.split(/\s+/);
    
    // Combined words from category and question
    const allClueWords = [...categoryWords, ...questionWords];
    
    // Check if any words from clue appear in answer
    const overlappingWords = allClueWords.filter(word => 
      answerWords.some(answerWord => answerWord === word)
    );
    
    if (overlappingWords.length > 0) {
      return { 
        valid: false, 
        reason: `Answer contains words from the clue or category: ${overlappingWords.join(", ")}` 
      };
    }
    
    // Check if the question is too vague (could have multiple valid answers)
    // Look for certain patterns that might indicate a vague question
    const vaguePhrases = [
      "known for", "famous for", "renowned for", "recognized for", "celebrated for",
      "this country", "this nation", "this place", "this region", "this area", "this city",
      "this culture", "this tradition",
      "unique blend", "rich history", "diverse landscape"
    ];
    
    // Check if question contains vague phrases without specific distinguishing details
    const hasVaguePhrases = vaguePhrases.some(phrase => 
      normalizedQuestion.includes(normalizeText(phrase))
    );
    
    // If the question contains vague phrases, add a warning
    if (hasVaguePhrases) {
      return {
        valid: false,
        reason: "Question may be too vague and could accept multiple answers. Consider adding more specific, distinguishing details."
      };
    }
    
    return { valid: true };
  };
  
  // Log format issues for data collection
  const logBadResponse = (categoryTitle: string, questionText: string, answerText: string, reason: string) => {
    // Track formatting issues silently for future improvement
    try {
      const existingLogs = JSON.parse(localStorage.getItem('jeopardy_format_issues') || '[]');
      existingLogs.push({
        category: categoryTitle,
        clue: questionText,
        answer: answerText,
        issue: reason,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('jeopardy_format_issues', JSON.stringify(existingLogs));
    } catch (e) {
      // Silent error handling for logging
    }
  };

  // Save edited question
  const saveQuestion = () => {
    if (!editingQuestion) return;
    
    const { categoryIndex, questionIndex, text, answer, value, dailyDouble } = editingQuestion;
    const categoryTitle = gameState.categories[categoryIndex].title;
    
    // Validate that the question follows both word exclusion rule and specificity requirement
    const validation = validateQuestionRule(categoryTitle, text, answer);
    
    // If validation fails, show warning and ask for confirmation
    if (!validation.valid) {
      // Log format issue for data collection
      logBadResponse(categoryTitle, text, answer, validation.reason || "Format issue");
      
      // For vague questions, show a warning dialog to the user
      if (validation.reason?.includes("too vague")) {
        const confirmSave = window.confirm(
          `Warning: This clue may be problematic.\n\n${validation.reason}\n\nFor example, a clue like "This East Asian country is known for its unique blend of traditional and modern culture" could accept multiple answers like Japan, South Korea, China, etc.\n\nDo you want to save anyway?`
        );
        
        if (!confirmSave) {
          return; // Don't save if the user cancels
        }
      }
    }
    
    const updatedCategories = [...gameState.categories];
    updatedCategories[categoryIndex].questions[questionIndex] = {
      ...updatedCategories[categoryIndex].questions[questionIndex],
      text,
      answer,
      value,
      dailyDouble,
      ruleViolation: validation.valid ? null : validation.reason
    };
    
    setGameState({
      ...gameState,
      categories: updatedCategories
    });
    
    setEditingQuestion(null);
  };

  // Check if all questions have been answered
  const allQuestionsAnswered = (): boolean => {
    return gameState.categories.every(category => 
      category.questions.every(question => question.answered)
    );
  };

  // Toggle answer visibility
  const toggleShowAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  // Generate questions with AI
  const generateQuestions = async () => {
    if (!apiKey) {
      alert("Please enter an API key");
      return;
    }
    
    // Validate that API key exists
    if (!apiKey.trim()) {
      alert("Please enter a valid API key");
      return;
    }
    
    // Save settings to localStorage
    localStorage.setItem('jeopardy_api_key', apiKey);
    localStorage.setItem('jeopardy_ai_provider', aiProvider);
    localStorage.setItem('jeopardy_system_message', systemMessage);
    
    setIsGenerating(true);
    
    try {
      // Option to use mock response or real API
      // Set to false to use the actual AI API for generating questions
      const useMockResponse = false;
      
      if (useMockResponse) {
        // Use a timeout to simulate network request
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock response data with sample questions
        const mockData = {
          categories: [
            {
              title: "World History",
              questions: [
                { text: "This emperor built a famous wall in northern China to keep out invaders", answer: "Who is Qin Shi Huang?", value: 200 },
                { text: "This 'Great' ruler modernized Russia in the early 18th century", answer: "Who is Peter the Great?", value: 400 },
                { text: "In 1453, this city fell to Ottoman forces led by Mehmed II", answer: "What is Constantinople?", value: 600 },
                { text: "This Mongol leader's empire stretched from the Pacific Ocean to Eastern Europe", answer: "Who is Genghis Khan?", value: 800 },
                { text: "The 1648 Treaty of Westphalia ended this European conflict", answer: "What is the Thirty Years' War?", value: 1000 }
              ]
            },
            {
              title: "Science",
              questions: [
                { text: "The chemical formula H2O represents this common substance", answer: "What is water?", value: 200 },
                { text: "This element with symbol Fe is the most common on Earth by mass", answer: "What is iron?", value: 400 },
                { text: "This scientist published the theory of general relativity in 1915", answer: "Who is Albert Einstein?", value: 600 },
                { text: "This subatomic particle carries a positive charge", answer: "What is a proton?", value: 800 },
                { text: "CRISPR-Cas9 is a technology used to edit this molecule", answer: "What is DNA?", value: 1000 }
              ]
            },
            {
              title: "Pop Culture",
              questions: [
                { text: "This 1997 film featured Leonardo DiCaprio and Kate Winslet on a doomed ocean liner", answer: "What is Titanic?", value: 200 },
                { text: "This Swedish group's hits include 'Dancing Queen' and 'Mamma Mia'", answer: "Who is ABBA?", value: 400 },
                { text: "This streaming service produced 'Stranger Things' and 'The Crown'", answer: "What is Netflix?", value: 600 },
                { text: "This superhero film franchise has grossed over $25 billion worldwide", answer: "What is the Marvel Cinematic Universe?", value: 800 },
                { text: "This British band's concept album 'The Dark Side of the Moon' stayed on charts for 15 years", answer: "Who is Pink Floyd?", value: 1000 }
              ]
            },
            {
              title: "Literature",
              questions: [
                { text: "This Shakespeare play features the character Juliet Capulet", answer: "What is Romeo and Juliet?", value: 200 },
                { text: "This author wrote 'Pride and Prejudice' and 'Emma'", answer: "Who is Jane Austen?", value: 400 },
                { text: "This dystopian novel by George Orwell introduced the concept of 'Big Brother'", answer: "What is 1984?", value: 600 },
                { text: "This Colombian author wrote 'One Hundred Years of Solitude'", answer: "Who is Gabriel García Márquez?", value: 800 },
                { text: "This James Joyce novel follows Leopold Bloom through a single day in Dublin", answer: "What is Ulysses?", value: 1000 }
              ]
            },
            {
              title: "Sports",
              questions: [
                { text: "This sport uses a shuttlecock", answer: "What is badminton?", value: 200 },
                { text: "Wayne Gretzky is considered the greatest player in the history of this sport", answer: "What is hockey?", value: 400 },
                { text: "This golfer has won 15 major championships", answer: "Who is Tiger Woods?", value: 600 },
                { text: "In tennis, this term refers to a tied score of 40-40", answer: "What is deuce?", value: 800 },
                { text: "This swimming stroke is performed on one's back", answer: "What is backstroke?", value: 1000 }
              ]
            },
            {
              title: "Geography",
              questions: [
                { text: "This is the largest ocean on Earth", answer: "What is the Pacific Ocean?", value: 200 },
                { text: "This African country is home to the Pyramids of Giza", answer: "What is Egypt?", value: 400 },
                { text: "The Amazon River flows through this rainforest", answer: "What is the Amazon Rainforest?", value: 600 },
                { text: "This mountain range separates Europe from Asia", answer: "What are the Ural Mountains?", value: 800 },
                { text: "This capital city sits at the mouth of the Chao Phraya River", answer: "What is Bangkok?", value: 1000 }
              ]
            }
          ]
        };
        
        // Format questions to match game state
        const formattedCategories = mockData.categories.map(cat => ({
          title: cat.title,
          questions: cat.questions.map(q => ({
            text: q.text,
            answer: q.answer,
            value: q.value,
            revealed: false,
            answered: false
          }))
        }));
        
        // Update game state with new questions
        setGameState({
          ...gameState,
          categories: formattedCategories
        });
        
        setShowSettings(false);
        return;
      }
      
      // If not using mock data, proceed with real API calls
      const categories = gameState.categories.map(cat => cat.title);
      
      // Create a simpler prompt for debugging API connectivity
      const isDebugMode = false;
      
      // Combine system message into reference text if it exists
      const combinedReferenceText = referenceText ? 
        `${systemMessage}\n\n${referenceText}` : 
        systemMessage;
      
      const prompt = isDebugMode ? 
        // Simple prompt for debugging
        `Return a simple Jeopardy question in JSON format like this: {"categories":[{"title":"Test","questions":[{"text":"Test question","answer":"What is test?","value":200}]}]}` :
        // Regular full prompt
        `Create a new Jeopardy game board with EXACTLY 6 creative categories.
        ${combinedReferenceText ? `Use the following reference content for creating specialized categories and questions: ${combinedReferenceText}` : ''}
        
        For each category, create 5 clues with values from $200 to $1000, ensuring they increase in difficulty.
        
        Important:
        - YOU MUST CREATE EXACTLY 6 CATEGORIES, no more and no less
        - Create entirely new category titles that are clever and engaging
        - Clues should be statements or facts, NOT questions
        - Responses should always start with "What is" or "Who is" etc.
        - Do not include the answer within the clue text
        - Make sure clues don't give away the answer directly
        - Include a balanced mix of topics and difficulty levels
        - Mark EXACTLY 2 clues total as "dailyDouble: true" (these are special high-value clues)
        - Do not add more than 2 Daily Doubles in total across all categories
        
        Format your response as JSON with this exact structure:
        {
          "categories": [
            {
              "title": "Category Name",
              "questions": [
                {
                  "text": "The clue text that would be shown to contestants",
                  "answer": "What is the correct response?",
                  "value": 200,
                  "dailyDouble": false
                },
                ... and so on for values 400, 600, 800, 1000
              ]
            },
            ... repeat for exactly 6 categories, numbered from 0 to 5
          ]
        }
        
        IMPORTANT REQUIREMENTS:
        1. The response MUST include EXACTLY 6 categories in the "categories" array.
        2. There MUST be EXACTLY 2 questions total marked as dailyDouble: true across all categories.`;
      
      // API endpoints
      const apiEndpoints = {
        // API providers
        openai: 'https://api.openai.com/v1/chat/completions',
        mistral: 'https://api.mistral.ai/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/v1/chat/completions',
        meta: 'https://api.together.xyz/v1/chat/completions',
        gemini: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent'
      };
      
      // Set up enhanced retry mechanism with multiple proxy attempts
      const maxRetries = 4; // Increased to allow trying multiple proxy services
      let retries = 0;
      let success = false;
      let lastError = null;
      
      // API request configurations
      const apiConfigs = {
        openai: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              { role: 'user', content: prompt }
            ],
            max_tokens: 4000
          })
        },
        mistral: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              { role: 'user', content: prompt }
            ]
          })
        },
        deepseek: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'user', content: prompt }
            ]
          })
        },
        meta: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'meta-llama-3-70b-instruct',
            messages: [
              { role: 'user', content: prompt }
            ]
          })
        },
        gemini: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4000
            }
          })
        }
      };
      
      // Make the API request with retry logic
      while (retries <= maxRetries && !success) {
        try {
          // Show retry attempt if this isn't the first try
          if (retries > 0) {
            console.log(`Retrying API request (attempt ${retries} of ${maxRetries})...`);
          }
          
          // For retries, we'll use the base endpoint
          let endpointKey = aiProvider;
          
          // Log API request details for debugging
          console.log(`Making request to ${aiProvider} API${endpointKey !== aiProvider ? ' (via CORS proxy)' : ''}:`, {
            endpoint: apiEndpoints[endpointKey as keyof typeof apiEndpoints],
            method: apiConfigs[aiProvider as keyof typeof apiConfigs].method,
            headers: { ...apiConfigs[aiProvider as keyof typeof apiConfigs].headers, 'x-api-key': '***REDACTED***' }
          });
          
          // Prepare fetch config with special handling for Claude API
          // Use type assertion to handle the complex type safely
          let fetchConfig = {
            ...(apiConfigs[aiProvider as keyof typeof apiConfigs] as any),
            mode: 'cors',
            credentials: 'omit'
          };
          
          // For proxies, we need to adjust the headers to work with the proxy service
          if (endpointKey.includes('Proxy')) {
            // For certain proxies, we may need to adjust the headers
            if (endpointKey === 'claudeProxy2' && fetchConfig.headers) {
              // Create a new headers object with the additional header
              const headers = { ...fetchConfig.headers };
              
              // Add the header in a type-safe way
              (headers as any)['X-Requested-With'] = 'XMLHttpRequest';
              
              // Update the headers in the config
              fetchConfig.headers = headers;
            }
          }
          
          const response = await fetch(apiEndpoints[endpointKey as keyof typeof apiEndpoints], fetchConfig);
          
          if (!response.ok) {
            // Handle specific error codes with more helpful messages
            let errorMessage = "";
            
            if (response.status === 429) {
              errorMessage = "Rate limit exceeded. Waiting and retrying...";
              // Wait longer with each retry
              await new Promise(resolve => setTimeout(resolve, 2000 * (retries + 1)));
            } else if (response.status === 401 || response.status === 403) {
              const responseText = await response.text();
              console.error("Auth error details:", responseText);
              throw new Error(`Authentication failed: ${response.status} ${response.statusText}. Please check that your API key is valid, has not expired, and has the correct format.`);
            } else if (response.status === 0) {
              // This is typically a CORS error (status 0 with no response)
              console.error("Likely CORS error - no response from server");
              
              // Network error handling for all providers
              throw new Error("Network error connecting to the API. Please try using a different AI provider.");
            } else if (response.status >= 500) {
              errorMessage = "The AI service is currently experiencing issues. Retrying...";
              await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
              const responseText = await response.text();
              console.error("API error details:", responseText);
              throw new Error(`API request failed: ${response.status} ${response.statusText}. ${responseText ? `Details: ${responseText}` : ''}`);
            }
            
            // Save error for retry logic
            lastError = new Error(errorMessage);
            
            // Only retry for certain status codes
            if (response.status === 429 || response.status >= 500) {
              retries++;
              continue;
            } else {
              throw lastError;
            }
          }
          
          // If we get here, the request was successful
          success = true;
          
          // Process successful response
          const data = await response.json();
          
          // Extract the JSON from different API responses
          let jsonContent = '';
          
          switch(aiProvider) {
            case 'openai':
            case 'mistral':
            case 'deepseek':
            case 'meta':
              jsonContent = data.choices[0].message.content;
              break;
            case 'gemini':
              jsonContent = data.candidates[0].content.parts[0].text;
              break;
          }
          
          // Extract the JSON object from the response text
          // Using more robust JSON extraction techniques
          let jsonMatch;
          
          try {
            // First try: look for content between triple backticks (code blocks)
            const codeBlockMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
              jsonMatch = [codeBlockMatch[1]];
              console.log("Found JSON in code block");
            } else {
              // Second try: use a more sophisticated regex to find balanced JSON objects
              // This helps with nested braces by counting opening and closing braces
              const jsonRegex = /(\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}))*\})/g;
              const balancedMatches = jsonContent.match(jsonRegex);
              
              if (balancedMatches && balancedMatches.length > 0) {
                // Sort by length and take the longest, which is likely the full response
                jsonMatch = [balancedMatches.sort((a, b) => b.length - a.length)[0]];
                console.log("Found JSON with balanced brace matching");
              } else {
                // Third try: find all JSON-like structures
                const braceMatches = jsonContent.match(/\{[\s\S]*?\}/g);
                if (braceMatches) {
                  // Sort by length and take the longest, which is likely the full response
                  jsonMatch = [braceMatches.sort((a, b) => b.length - a.length)[0]];
                  console.log("Found JSON by simple brace matching");
                } else {
                  // Last resort: try to find any JSON-like structure
                  jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
                  console.log("Using fallback JSON extraction");
                }
              }
            }
          } catch (error) {
            console.error("Error in JSON extraction:", error);
            // Fallback to simplest approach
            jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
          }
          
          if (!jsonMatch) {
            console.error("Failed to extract JSON from:", jsonContent.substring(0, 500) + "...");
            throw new Error("Could not find valid JSON in the response");
          }
          
          // Enhanced JSON sanitization
          let sanitizedJson = jsonMatch[0];
          
          // Multi-stage sanitization process
          try {
            // Stage 1: Remove control characters that break JSON parsing
            sanitizedJson = sanitizedJson.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
            
            // Stage 2: Fix escape sequences inside string literals
            sanitizedJson = sanitizedJson.replace(/"(?:[^"\\]|\\.)*"/g, function(match) {
              return match
                .replace(/\\(?!["\\/bfnrt])/g, "\\\\") // Escape backslashes
                .replace(/\n/g, "\\n")               // Escape newlines
                .replace(/\r/g, "\\r")               // Escape carriage returns
                .replace(/\t/g, "\\t")               // Escape tabs
                .replace(/\f/g, "\\f");              // Escape form feeds
            });
            
            // Stage 3: Fix common JSON structure issues
            sanitizedJson = sanitizedJson
              .replace(/,\s*}/g, '}')                // Remove trailing commas in objects
              .replace(/,\s*\]/g, ']')               // Remove trailing commas in arrays
              .replace(/"\s+"/g, '" "')              // Fix spaces between quotes
              .replace(/"\{/g, '{')                  // Fix issues with "{" patterns
              .replace(/\}"/g, '}')                  // Fix issues with "}" patterns
              .replace(/"\[/g, '[')                  // Fix issues with "[" patterns
              .replace(/\]"/g, ']');                 // Fix issues with "]" patterns
            
            // Stage 4: Special handling for line 13 which was mentioned in the error
            const jsonLines = sanitizedJson.split('\n');
            if (jsonLines.length >= 13) {
              jsonLines[12] = jsonLines[12].replace(/(".*?)([\u0000-\u001F])(.+?")/g, '$1\\$2$3');
              sanitizedJson = jsonLines.join('\n');
            }
            
            // Stage 5: Ensure valid JSON escaping in string values
            // This regex finds string literals and ensures they don't contain invalid escapes
            sanitizedJson = sanitizedJson.replace(/"(?:[^"\\]|\\["\\bfnrt])*"/g, function(match) {
              // Replace any invalid escape sequences
              return match.replace(/\\([^"\\bfnrt/])/g, '\\\\$1');
            });
            
          } catch (e) {
            console.error("Error during JSON sanitization:", e);
          }
          
          // Attempt to parse with progressively more aggressive sanitization
          let parsedData;
          let parsingSuccess = false;
          
          // First attempt: Try parsing the sanitized JSON
          try {
            parsedData = JSON.parse(sanitizedJson);
            parsingSuccess = true;
            console.log("Successfully parsed JSON on first attempt");
          } catch (jsonError) {
            console.error("Initial JSON parsing error:", jsonError);
            console.log("Attempting more aggressive JSON cleaning...");
            
            // Second attempt: More aggressive cleaning
            try {
              // Use a string parser approach that manually reconstructs the JSON
              const aggressive1 = sanitizedJson
                .replace(/\\(?!["\\/bfnrt])/g, "\\\\") // Escape backslashes
                .replace(/[\n\r\t\f]/g, " ")          // Replace whitespace with spaces
                .replace(/"\s+"/g, '" "')             // Fix spaces between quotes
                .replace(/([^\\])"/g, '$1\\"')        // Escape unescaped quotes
                .replace(/\\\\"/g, '\\"')             // Fix double escaped quotes
                .replace(/\\"/g, '\\"');              // Ensure quote escaping
              
              // Try to parse again
              parsedData = JSON.parse(aggressive1);
              parsingSuccess = true;
              console.log("Successfully parsed JSON on second attempt");
            } catch (secondError) {
              console.error("Second parsing attempt failed:", secondError);
              
              // Third attempt: Try to extract valid partial JSON
              try {
                // Extract only the categories array which is the essential part
                const categoryMatch = sanitizedJson.match(/"categories"\s*:\s*(\[[\s\S]*?\])/);
                if (categoryMatch) {
                  const categoriesJson = `{"categories":${categoryMatch[1]}}`;
                  parsedData = JSON.parse(categoriesJson);
                  parsingSuccess = true;
                  console.log("Successfully parsed partial JSON (categories only)");
                } else {
                  throw new Error("Couldn't find categories array");
                }
              } catch (thirdError) {
                console.error("Third parsing attempt failed:", thirdError);
                
                // Fourth attempt: Last resort with hand-crafted JSON fix
                try {
                  // This replaces all problematic quotes within string values
                  const fixedJson = sanitizedJson
                    .replace(/("[^"]*)(")([^"]*")/g, '$1\\"$3') // Fix quotes inside strings
                    .replace(/([\[\{,]\s*)([^,\{\[\]\"\d-])/g, '$1"$2') // Add quotes around keys
                    .replace(/([^\s\]\}"])(\s*[\]\},])/g, '$1"$2'); // Close quoted values
                  
                  parsedData = JSON.parse(fixedJson);
                  parsingSuccess = true;
                  console.log("Successfully parsed JSON on fourth attempt");
                } catch (finalError) {
                  console.error("Final parsing attempt failed:", finalError);
                }
              }
            }
          }
          
          // If all parsing attempts failed, use fallback data
          if (!parsingSuccess) {
            console.log("Creating mock data as fallback");
            parsedData = {
              categories: defaultCategories.map((title, i) => ({
                title: `${title} (AI Error)`,
                questions: defaultValues.map((value, j) => ({
                  text: `JSON parse error occurred. This is a fallback question ${j+1} for ${value} points.`,
                  answer: "What is a JSON parsing error?",
                  value: value,
                  revealed: false,
                  answered: false,
                  dailyDouble: false
                }))
              }))
            };
          }
          
          // Format the generated content to match our game state structure
          // Also validate each question against our word exclusion rule
          let formattedCategories = parsedData.categories.map((cat: any) => {
            // Validate each question in this category
            const validatedQuestions = cat.questions.map((q: any) => {
              // Check if this question violates our rules
              const validation = validateQuestionRule(cat.title, q.text, q.answer);
              
              // If invalid, log it for ML training
              if (!validation.valid) {
                logBadResponse(cat.title, q.text, q.answer, validation.reason || "Unknown rule violation");
                console.warn(`Rule violation in generated question: ${validation.reason}`);
              }
              
              return {
                text: q.text,
                answer: q.answer,
                value: q.value,
                revealed: false,
                answered: false,
                dailyDouble: q.dailyDouble === true,
                // Flag questions that violate our rules
                ruleViolation: !validation.valid ? validation.reason : null
              };
            });
            
            return {
              title: cat.title,
              questions: validatedQuestions
            };
          });
          
          // Ensure we always have exactly 6 categories
          if (formattedCategories.length < 6) {
            console.log(`API returned only ${formattedCategories.length} categories instead of 6. Adding missing categories.`);
            
            // Calculate how many categories we need to add
            const missingCategoriesCount = 6 - formattedCategories.length;
            
            // Generate placeholder categories for the missing ones
            const placeholderCategories = defaultCategories
              .slice(0, missingCategoriesCount)
              .map(title => ({
                title: `${title} (Generated)`,
                questions: defaultValues.map(createDefaultQuestions)
              }));
            
            // Append the placeholder categories
            formattedCategories = [...formattedCategories, ...placeholderCategories];
          } else if (formattedCategories.length > 6) {
            console.log(`API returned ${formattedCategories.length} categories instead of 6. Trimming to 6 categories.`);
            // Trim to exactly 6 categories if we got more
            formattedCategories = formattedCategories.slice(0, 6);
          }
          
          // Ensure we have EXACTLY 2 Daily Doubles on the board
          // First, count how many Daily Doubles we currently have
          let dailyDoubleCount = 0;
          const allQuestions: {categoryIndex: number, questionIndex: number}[] = [];
          
          formattedCategories.forEach((category: any, categoryIndex: number) => {
            category.questions.forEach((question: any, questionIndex: number) => {
              if (question.dailyDouble) {
                dailyDoubleCount++;
              }
              allQuestions.push({categoryIndex, questionIndex});
            });
          });
          
          console.log(`Board has ${dailyDoubleCount} Daily Doubles (target: 2)`);
          
          // If we have too many Daily Doubles, remove some randomly
          if (dailyDoubleCount > 2) {
            console.log(`Removing ${dailyDoubleCount - 2} excess Daily Doubles`);
            
            // Get all Daily Double positions
            const dailyDoublePositions: {categoryIndex: number, questionIndex: number}[] = [];
            formattedCategories.forEach((category: any, categoryIndex: number) => {
              category.questions.forEach((question: any, questionIndex: number) => {
                if (question.dailyDouble) {
                  dailyDoublePositions.push({categoryIndex, questionIndex});
                }
              });
            });
            
            // Shuffle array to randomize which ones to remove
            dailyDoublePositions.sort(() => Math.random() - 0.5);
            
            // Remove excess Daily Doubles (keep only 2)
            for (let i = 0; i < dailyDoublePositions.length - 2; i++) {
              const {categoryIndex, questionIndex} = dailyDoublePositions[i];
              formattedCategories[categoryIndex].questions[questionIndex].dailyDouble = false;
            }
          } 
          // If we don't have enough Daily Doubles, add some randomly
          else if (dailyDoubleCount < 2) {
            console.log(`Adding ${2 - dailyDoubleCount} missing Daily Doubles`);
            
            // Shuffle all questions to randomize candidates
            allQuestions.sort(() => Math.random() - 0.5);
            
            // Get non-Daily Double questions to potentially convert
            const regularQuestions = allQuestions.filter(({categoryIndex, questionIndex}) => 
              !formattedCategories[categoryIndex].questions[questionIndex].dailyDouble
            );
            
            // Add missing Daily Doubles
            for (let i = 0; i < 2 - dailyDoubleCount && i < regularQuestions.length; i++) {
              const {categoryIndex, questionIndex} = regularQuestions[i];
              formattedCategories[categoryIndex].questions[questionIndex].dailyDouble = true;
            }
          }
          
          // Update game state with new questions
          setGameState({
            ...gameState,
            categories: formattedCategories
          });
          
          setShowSettings(false);
          return; // Exit the function on success
          
        } catch (error: any) {
          lastError = error;
          console.error('API request error:', error);
          
          // Handle network errors more explicitly
          if (error.name === 'TypeError') {
            console.log('Network error detected - this is often a CORS issue or network connectivity problem');
            
            // Create a more detailed and helpful error message
            let errorSuggestion;
            
            errorSuggestion = 'Consider trying a different API provider or check your network connection.';
            
            const enhancedError = new Error(
              'Network error when trying to connect to the API. This might be due to:\n' +
              '1. CORS restrictions (browser security preventing direct API access)\n' +
              '2. Network connectivity issues\n' +
              '3. Ad blockers or privacy extensions blocking the request\n' +
              '4. VPN or proxy issues\n\n' +
              `${errorSuggestion}\n\n` +
              'Try these solutions:\n' +
              '- Try using a different AI provider (like OpenAI or Mistral)\n' +
              '- Check your ad blockers and disable them for this site\n' +
              '- Make sure your API key format is correct (Claude API keys start with "sk-ant-")\n' +
              '- Try using a different browser (Chrome tends to work best)\n' +
              '- Verify your internet connection is stable\n' +
              '- Try temporarily disabling any VPN services'
            );
            throw enhancedError;
          }
          
          // Only retry for network errors or specific API errors
          if (error instanceof TypeError || 
              (typeof error.message === 'string' && 
               (error.message.includes("Rate limit exceeded") || 
                error.message.includes("experiencing issues")))) {
            retries++;
            if (retries <= maxRetries) {
              console.log(`Request failed, retrying (${retries}/${maxRetries}):`, error);
              // Wait between retries with exponential backoff
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
              continue;
            }
          }
          // For other errors or if we're out of retries, rethrow the error
          throw error;
        }
      }
      
      // If we exhausted retries, throw the last error
      if (!success && lastError) {
        throw lastError;
      }
      
      setShowSettings(false);
      
    } catch (error) {
      console.error("Error generating questions:", error);
      
      // Create a more user-friendly error display
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Use modal instead of alert for better UX
      const errorElement = document.createElement('div');
      errorElement.className = 'error-notification';
      errorElement.innerHTML = `
        <div class="error-content">
          <h3>Question Generation Failed</h3>
          <p>${errorMessage}</p>
          <button>Close</button>
        </div>
      `;
      
      // Handle closing the error message
      const closeButton = errorElement.querySelector('button');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          document.body.removeChild(errorElement);
        });
      }
      
      // Display the error modal
      document.body.appendChild(errorElement);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Reset the game
  const resetGame = () => {
    if (window.confirm("Are you sure you want to reset the game? All progress will be lost.")) {
      setGameState({
        categories: initializeCategories(),
        players: initializePlayers(playerCount),
        currentPlayer: 0,
        finalJeopardyActive: false
      });
      setSelectedQuestion(null);
      setShowAnswer(false);
    }
  };
  
  // Save current game state
  const saveCurrentGame = () => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString();
    
    if (!saveBoardName) {
      setSaveBoardName(`Jeopardy Board ${formattedDate}`);
    }
    
    const newSavedGame = {
      name: saveBoardName || `Jeopardy Board ${formattedDate}`,
      date: formattedDate,
      data: { ...gameState }
    };
    
    setSavedBoards(prev => [...prev, newSavedGame]);
    setShowSaveModal(false);
    setSaveBoardName('');
    
    // Show notification
    alert(`Game saved as "${newSavedGame.name}"`);
  };
  
  // Load a saved game
  const loadGame = (index: number) => {
    if (index >= 0 && index < savedBoards.length) {
      const savedGame = savedBoards[index];
      
      if (window.confirm(`Load "${savedGame.name}"? Current game progress will be lost.`)) {
        setGameState(savedGame.data);
        setSelectedQuestion(null);
        setShowAnswer(false);
        setShowLoadModal(false);
      }
    }
  };
  
  // Delete a saved game
  const deleteSavedGame = (index: number, event: React.MouseEvent) => {
    // Stop the click from bubbling up to the parent (which would load the game)
    event.stopPropagation();
    
    if (window.confirm(`Delete "${savedBoards[index].name}"? This cannot be undone.`)) {
      setSavedBoards(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  // Open player settings
  const openPlayerSettings = () => {
    setEditingPlayers([...gameState.players]); // Copy current players for editing
    setTempPlayerCount(gameState.players.length);
    setShowPlayerSettings(true);
  };
  
  // Save player settings
  const savePlayerSettings = () => {
    // Create new player array with updated count
    let updatedPlayers: Player[];
    
    if (tempPlayerCount === editingPlayers.length) {
      // Just update names of existing players
      updatedPlayers = [...editingPlayers];
    } else if (tempPlayerCount > editingPlayers.length) {
      // Add new players
      updatedPlayers = [...editingPlayers];
      for (let i = editingPlayers.length + 1; i <= tempPlayerCount; i++) {
        updatedPlayers.push({
          name: `Player ${i}`,
          score: 0,
          active: false
        });
      }
    } else {
      // Remove players (keep only the first tempPlayerCount players)
      updatedPlayers = editingPlayers.slice(0, tempPlayerCount);
    }
    
    // Update game state with new players
    setGameState({
      ...gameState,
      players: updatedPlayers,
      // If current player is now out of bounds, reset to player 0
      currentPlayer: gameState.currentPlayer >= tempPlayerCount ? 0 : gameState.currentPlayer
    });
    
    // Update the player count
    setPlayerCount(tempPlayerCount);
    
    // Close the modal
    setShowPlayerSettings(false);
  };
  
  // Toggle Final Jeopardy mode
  const activateFinalJeopardy = () => {
    if (!allQuestionsAnswered()) {
      if (!window.confirm("Not all questions have been answered. Are you sure you want to proceed to Final Jeopardy?")) {
        return;
      }
    }
    
    setGameState({
      ...gameState,
      finalJeopardyActive: true
    });
  };
  
  // Handle Final Jeopardy wagers and answers
  const handleFinalJeopardy = () => {
    // Simplified implementation - would need more UI components
    alert("Final Jeopardy functionality will be implemented in a future update.");
  };

  // Full game render
  return (
    <div className={`jeopardy-game ${gameTheme}`}>
      {/* Game Board */}
      <div className="game-board">
        <h1 className="game-title">Jeopardy!</h1>
        
        {/* Settings and controls */}
        <div className="game-controls">
          <button onClick={() => setShowSettings(!showSettings)}>
            AI Settings & Generate
          </button>
          <button onClick={() => setShowEditor(!showEditor)}>
            {showEditor ? 'Close Editor' : 'Edit Board'}
          </button>
          <button onClick={openPlayerSettings}>
            Players ({gameState.players.length})
          </button>
          <button onClick={resetGame}>Reset Game</button>
          <button onClick={activateFinalJeopardy} disabled={gameState.finalJeopardyActive}>
            Final Jeopardy
          </button>
          
          {/* Save/Load Controls */}
          <div className="save-load-controls">
            <button className="save-button" onClick={() => setShowSaveModal(true)}>
              💾 Save Board
            </button>
            <button className="load-button" onClick={() => setShowLoadModal(true)}>
              📂 Load Board ({savedBoards.length})
            </button>
          </div>
          
          <select 
            value={gameTheme} 
            onChange={(e) => setGameTheme(e.target.value)}
            className="theme-selector"
          >
            <option value="standard">Standard Theme</option>
            <option value="dark">Dark Theme</option>
            <option value="retro">Retro Theme</option>
          </select>
        </div>
        
        
        {/* AI Settings Modal */}
        {showSettings && (
          <div className="settings-modal">
            <div className="settings-content">
              <h2>AI Settings</h2>
              <div className="form-group">
                <label>AI Provider:</label>
                <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
                  <option value="openai">GPT-4 (OpenAI)</option>
                  <option value="gemini">Gemini 1.5 Pro (Google)</option>
                  <option value="mistral">Mistral AI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="meta">Llama (Meta)</option>
                </select>
              </div>
              <div className="form-group">
                <label>API Key:</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="Enter your API key"
                />
              </div>
              <div className="form-group system-message-group">
                <label>
                  <span className="label-text">System Message:</span>
                  <span className="label-hint">Instructions for how the AI should generate questions</span>
                </label>
                <textarea 
                  value={systemMessage} 
                  onChange={(e) => setSystemMessage(e.target.value)} 
                  placeholder="Instructions for the AI (e.g., 'Create challenging academic questions suitable for high school students')"
                  rows={3}
                  className="system-message-input"
                />
              </div>
              <div className="form-group reference-text-group">
                <label>
                  <span className="label-text">Reference Text (Optional):</span>
                  <span className="label-hint">Add content to generate subject-specific questions. System prompt instructions will be prepended to this text.</span>
                </label>
                <textarea 
                  value={referenceText} 
                  onChange={(e) => setReferenceText(e.target.value)} 
                  placeholder="Paste text, articles, or lesson material that should be used as the basis for questions. The system prompt will be automatically included."
                  rows={5}
                  className="reference-text-input"
                />
              </div>
              <div className="button-group">
                <button onClick={generateQuestions} disabled={isGenerating}>
                  {isGenerating ? 'Generating...' : 'Save & Generate'}
                </button>
                <button onClick={() => setShowSettings(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Final Jeopardy UI */}
        {gameState.finalJeopardyActive ? (
          <div className="final-jeopardy">
            <h2>Final Jeopardy</h2>
            {/* Final Jeopardy implementation would go here */}
            <p>Coming soon!</p>
            <button onClick={handleFinalJeopardy}>Continue</button>
          </div>
        ) : (
          <>
            {/* Categories Header */}
            <div className="categories-row">
              {gameState.categories.map((category, categoryIndex) => (
                <div 
                  key={categoryIndex} 
                  className={`category-header ${showEditor ? 'editable' : ''}`}
                  onClick={() => handleEditCategory(categoryIndex)}
                >
                  {category.title}
                  {showEditor && (
                    <div className="edit-icon">✏️</div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Questions Grid */}
            {[0, 1, 2, 3, 4].map(questionIndex => (
              <div key={questionIndex} className="questions-row">
                {gameState.categories.map((category, categoryIndex) => {
                  const question = category.questions[questionIndex];
                  return (
                    <div 
                      key={`${categoryIndex}-${questionIndex}`} 
                      className={`question-cell ${question.answered ? 'answered' : ''} ${showEditor ? 'editable' : ''} ${question.dailyDouble && question.revealed ? 'daily-double' : ''}`}
                      onClick={() => {
                        if (showEditor) {
                          handleEditQuestion(categoryIndex, questionIndex);
                        } else {
                          handleQuestionSelect(categoryIndex, questionIndex);
                        }
                      }}
                    >
                      <div className="question-value-container">
                        {question.answered && !showEditor ? '' : (
                          <>
                            {`$${question.value}`}
                            {/* Daily Double indicator only shown in editor mode or after it's been revealed */}
                            {question.dailyDouble && !question.answered && showEditor && (
                              <div className="daily-double-indicator">DD</div>
                            )}
                            {/* Rule violation indicator completely removed */}
                          </>
                        )}
                        {showEditor && (
                          <div className="edit-icon">✏️</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
        
        {/* Selected Question View */}
        {selectedQuestion && (
          <div className="question-view">
            <div className="question-content">
              {/* Daily Double Wager Screen */}
              {gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].dailyDouble && showDailyDoubleWager ? (
                <div className="daily-double-reveal">
                  <h2>Daily Double!</h2>
                  <div className="daily-double-animation"></div>
                  
                  <div className="daily-double-wager">
                    <p className="wager-instructions">
                      {gameState.players[gameState.currentPlayer].name}, enter your wager:
                    </p>
                    
                    <div className="wager-info">
                      <p>Current score: ${gameState.players[gameState.currentPlayer].score}</p>
                      <p>Maximum wager: ${Math.max(gameState.players[gameState.currentPlayer].score, 1000)}</p>
                      <p className="wager-note">Wagers must be in $100 increments</p>
                    </div>
                    
                    <div className="wager-input-container">
                      <input 
                        type="number" 
                        className="wager-input"
                        placeholder="Enter wager"
                        min={100}
                        max={Math.max(gameState.players[gameState.currentPlayer].score, 1000)}
                        step={100}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          // Round to nearest $100
                          const roundedValue = Math.round(value / 100) * 100;
                          setDailyDoubleWager(roundedValue);
                        }}
                      />
                      <button 
                        className="wager-button"
                        onClick={() => handleDailyDoubleWager(dailyDoubleWager || gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].value)}
                      >
                        Confirm Wager
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Daily Double Question Display (after wager is made) */}
                  {gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].dailyDouble && !showDailyDoubleWager ? (
                    <div className="daily-double-question">
                      <div className="daily-double-header">
                        <h2>Daily Double</h2>
                        <p className="wager-display">Wager: ${dailyDoubleWager}</p>
                      </div>
                      <p className="question-text">
                        {gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].text}
                      </p>
                    </div>
                  ) : (
                    // Regular Question Display
                    <>
                      <h2>${gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].value}</h2>
                      <p className="question-text">
                        {gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].text}
                      </p>
                    </>
                  )}
                  
                  {/* Answer Display (for both regular and daily double) */}
                  {showAnswer && (
                    <div className="answer">
                      <h3>Correct Response:</h3>
                      <p className="correct-response">{gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].answer}</p>
                    </div>
                  )}
                  
                  <div className="question-controls">
                    <div className="button-row">
                      <button onClick={toggleShowAnswer}>
                        {showAnswer ? 'Hide Response' : 'Show Response'}
                      </button>
                      
                      {showAnswer && (
                        <button 
                          className="back-button"
                          onClick={() => {
                            // Mark the question as answered even with no points
                            if (selectedQuestion) {
                              const { categoryIndex, questionIndex } = selectedQuestion;
                              const updatedCategories = [...gameState.categories];
                              updatedCategories[categoryIndex].questions[questionIndex].answered = true;
                              
                              setGameState({
                                ...gameState,
                                categories: updatedCategories
                              });
                            }
                            
                            // Restore body scrolling
                            document.body.style.overflow = '';
                            
                            // Close the question view
                            setSelectedQuestion(null);
                            setShowAnswer(false);
                            setDailyDoubleWager(null);
                            setShowDailyDoubleWager(false);
                          }}
                        >
                          Return to Board (No Points)
                        </button>
                      )}
                    </div>
                    
                    {showAnswer ? (
                      <div className="player-selection">
                        <h4>Award Points To:</h4>
                        <div className="player-answer-buttons">
                          {gameState.players.map((player, idx) => (
                            <div key={idx} className="player-answer-option">
                              <div className="player-name">{player.name}</div>
                              <div className="answer-buttons">
                                <button 
                                  className="correct-button" 
                                  onClick={() => handleAnswer(true, idx)}
                                >
                                  Correct
                                </button>
                                <button 
                                  className="incorrect-button" 
                                  onClick={() => handleAnswer(false, idx)}
                                >
                                  Incorrect
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="multi-deduction">
                          <h4>Deduct From Multiple Players</h4>
                          <div className="player-checkboxes">
                            {gameState.players.map((player, idx) => (
                              <div 
                                key={idx} 
                                className="player-checkbox"
                                onClick={() => toggleIncorrectPlayer(idx)}
                              >
                                <input
                                  type="checkbox"
                                  id={`incorrect-${idx}`}
                                  checked={!!incorrectPlayers[idx]}
                                  onChange={() => {}} // Handler moved to parent div for better UX
                                />
                                <label htmlFor={`incorrect-${idx}`}>{player.name}</label>
                              </div>
                            ))}
                          </div>
                          <button
                            className="deduct-multiple-button"
                            onClick={handleMultipleIncorrect}
                            disabled={Object.keys(incorrectPlayers).length === 0}
                          >
                            {Object.keys(incorrectPlayers).length > 0 
                              ? `Deduct Points from ${Object.keys(incorrectPlayers).length} Player${Object.keys(incorrectPlayers).length > 1 ? 's' : ''}`
                              : 'Select Players to Deduct Points'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Scoreboard */}
      <div className="scoreboard">
        {gameState.players.map((player, index) => (
          <div 
            key={index} 
            className={`player ${index === gameState.currentPlayer ? 'active' : ''}`}
          >
            <h3>{player.name}</h3>
            <p className="score">${player.score}</p>
          </div>
        ))}
      </div>
      
      {/* Save Game Modal */}
      {showSaveModal && (
        <div className="settings-modal">
          <div className="settings-content">
            <h2>Save Game Board</h2>
            <div className="form-group">
              <label>Save Name:</label>
              <input 
                type="text" 
                value={saveBoardName} 
                onChange={(e) => setSaveBoardName(e.target.value)} 
                placeholder="My Custom Jeopardy Board"
                autoFocus
              />
            </div>
            <div className="button-group">
              <button onClick={saveCurrentGame}>Save</button>
              <button onClick={() => setShowSaveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Load Game Modal */}
      {showLoadModal && (
        <div className="settings-modal">
          <div className="settings-content">
            <h2>Load Saved Game</h2>
            {savedBoards.length > 0 ? (
              <div className="saved-boards-list">
                {savedBoards.map((board, index) => (
                  <div 
                    key={index} 
                    className="saved-board-item"
                    onClick={() => loadGame(index)}
                  >
                    <div className="saved-board-info">
                      <h3>{board.name}</h3>
                      <p className="saved-date">Saved on: {board.date}</p>
                    </div>
                    <button 
                      className="delete-board-button"
                      onClick={(e) => deleteSavedGame(index, e)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-saved-boards">No saved boards found.</p>
            )}
            <div className="button-group">
              <button onClick={() => setShowLoadModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Category Editor Modal */}
      {editingCategory && (
        <div className="editor-modal">
          <div className="editor-content">
            <h2>Edit Category</h2>
            <div className="form-group">
              <label>Category Title:</label>
              <input 
                type="text" 
                value={editingCategory.title} 
                onChange={(e) => setEditingCategory({...editingCategory, title: e.target.value})}
                autoFocus
              />
            </div>
            <div className="button-group">
              <button onClick={saveCategory}>Save</button>
              <button onClick={() => setEditingCategory(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Question Editor Modal */}
      {editingQuestion && (
        <div className="editor-modal">
          <div className="editor-content">
            <h2>Edit Clue</h2>
            
            {/* Live validation logic runs silently */}
            
            <div className="form-group">
              <label>Clue Text:</label>
              <textarea 
                value={editingQuestion.text} 
                onChange={(e) => setEditingQuestion({...editingQuestion, text: e.target.value})}
                rows={4}
                autoFocus
                placeholder="Enter the clue text here"
              />
            </div>
            <div className="form-group">
              <label>Correct Response:</label>
              <input 
                type="text" 
                value={editingQuestion.answer} 
                onChange={(e) => setEditingQuestion({...editingQuestion, answer: e.target.value})}
                placeholder="Enter the correct response"
              />
            </div>
            <div className="form-group">
              <label>Value:</label>
              <select 
                value={editingQuestion.value}
                onChange={(e) => setEditingQuestion({...editingQuestion, value: parseInt(e.target.value, 10)})}
              >
                <option value="200">$200</option>
                <option value="400">$400</option>
                <option value="600">$600</option>
                <option value="800">$800</option>
                <option value="1000">$1000</option>
              </select>
            </div>
            <div className="form-group">
              <div className="daily-double-toggle">
                <input
                  type="checkbox"
                  id="dailyDoubleToggle"
                  checked={editingQuestion.dailyDouble === true}
                  onChange={(e) => setEditingQuestion({...editingQuestion, dailyDouble: e.target.checked})}
                />
                <label htmlFor="dailyDoubleToggle">Mark as Daily Double</label>
              </div>
            </div>
            <div className="button-group">
              <button onClick={saveQuestion}>Save</button>
              <button onClick={() => setEditingQuestion(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Player Settings Modal */}
      {showPlayerSettings && (
        <div className="editor-modal">
          <div className="editor-content">
            <h2>Player Settings</h2>
            <div className="form-group">
              <label>Number of Players:</label>
              <select 
                value={tempPlayerCount} 
                onChange={(e) => {
                  const newCount = parseInt(e.target.value, 10);
                  setTempPlayerCount(newCount);
                  
                  // Adjust editing players array based on new count
                  if (newCount > editingPlayers.length) {
                    // Add new players
                    const newPlayers = [...editingPlayers];
                    for (let i = editingPlayers.length + 1; i <= newCount; i++) {
                      newPlayers.push({
                        name: `Player ${i}`,
                        score: 0,
                        active: false
                      });
                    }
                    setEditingPlayers(newPlayers);
                  } else if (newCount < editingPlayers.length) {
                    // Remove excess players
                    setEditingPlayers(editingPlayers.slice(0, newCount));
                  }
                }}
              >
                <option value="2">2 Players</option>
                <option value="3">3 Players</option>
                <option value="4">4 Players</option>
              </select>
            </div>
            
            {/* Player name editor */}
            {editingPlayers.map((player, index) => (
              <div className="form-group" key={index}>
                <label>Player {index + 1} Name:</label>
                <input 
                  type="text" 
                  value={player.name} 
                  onChange={(e) => {
                    const updatedPlayers = [...editingPlayers];
                    updatedPlayers[index].name = e.target.value;
                    setEditingPlayers(updatedPlayers);
                  }}
                />
              </div>
            ))}
            
            <div className="button-group">
              <button onClick={savePlayerSettings}>Save Players</button>
              <button onClick={() => setShowPlayerSettings(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}