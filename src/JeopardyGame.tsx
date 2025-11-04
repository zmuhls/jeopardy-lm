import React, { useState, useEffect, useRef } from 'react';

// Define types for our game
interface Rating {
  rating: 'good' | 'bad';
  timestamp: string;
}

interface Question {
  text: string;
  answer: string;
  value: number;
  revealed: boolean;
  answered: boolean;
  dailyDouble?: boolean;
  ruleViolation?: string | null;
  ratings?: Rating[];
}

interface DifficultyAdjustments {
  [key: number]: number; // Maps value tiers (200, 400, etc.) to difficulty adjustments (-2 to +2)
}

interface Category {
  title: string;
  questions: Question[];
  difficultyAdjustments?: DifficultyAdjustments;
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
  openrouter: '',
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
  ruleViolation: null,
  ratings: []
});

// Initialize default categories with questions
const initializeCategories = (): Category[] => {
  return defaultCategories.map(title => ({
    title,
    questions: defaultValues.map(createDefaultQuestions),
    difficultyAdjustments: {
      200: 0,
      400: 0,
      600: 0,
      800: 0,
      1000: 0
    }
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
  const [aiProvider, setAiProvider] = useState<'openrouter' | 'ollama'>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('google/gemini-2.5-flash-lite');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [temperature, setTemperature] = useState(0.7);
  const [systemMessage, setSystemMessage] = useState('Create a high-quality Jeopardy! game board with diverse, challenging, and well-structured categories and questions. Follow these key principles:\n\n- Make clues SPECIFIC with ONE unambiguous answer (e.g., NOT "This East Asian country has a unique blend of traditional culture" - too vague)\n- Use clever, engaging category titles\n- Ensure gradual difficulty increase from $200 to $1000 questions\n- Make clues factually accurate and verifiable\n- Format answers as questions ("Who is/What is...")\n- Do not repeat concepts across categories\n- NEVER include answer words in the clue text');
  const [referenceText, setReferenceText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [gameTheme, setGameTheme] = useState('standard');
  const [incorrectPlayers, setIncorrectPlayers] = useState<IncorrectPlayers>({});
  const [dailyDoubleWager, setDailyDoubleWager] = useState<number | null>(null);
  const [showDailyDoubleWager, setShowDailyDoubleWager] = useState(false);
  
  
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
      if (savedProvider && (savedProvider === 'openrouter' || savedProvider === 'ollama')) {
        setAiProvider(savedProvider);
      }
      
      const savedModelId = localStorage.getItem('jeopardy_model_id');
      if (savedModelId) setModelId(savedModelId);
      
      const savedOllamaModel = localStorage.getItem('jeopardy_ollama_model');
      if (savedOllamaModel) setOllamaModel(savedOllamaModel);
      
      const savedOllamaUrl = localStorage.getItem('jeopardy_ollama_url');
      if (savedOllamaUrl) setOllamaUrl(savedOllamaUrl);
      
      const savedSystemMessage = localStorage.getItem('jeopardy_system_message');
      if (savedSystemMessage) setSystemMessage(savedSystemMessage);
      
      const savedTemperature = localStorage.getItem('jeopardy_temperature');
      if (savedTemperature) setTemperature(parseFloat(savedTemperature));
      
      
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

  // Function to adjust category difficulty based on player performance
  const adjustCategoryDifficulty = (categories: Category[], categoryIndex: number): void => {
    const category = categories[categoryIndex];
    
    // Ensure difficultyAdjustments is initialized
    if (!category.difficultyAdjustments) {
      category.difficultyAdjustments = {
        200: 0,
        400: 0,
        600: 0,
        800: 0,
        1000: 0
      };
    }
    
    // Group ratings by value tier
    const valueRatings: {[key: number]: Rating[]} = {};
    
    // Collect all ratings for each value tier
    category.questions.forEach(question => {
      if (question.ratings && question.ratings.length > 0) {
        const value = question.value;
        if (!valueRatings[value]) {
          valueRatings[value] = [];
        }
        valueRatings[value] = [...valueRatings[value], ...question.ratings];
      }
    });
    
    // Calculate adjustments for each value tier
    Object.keys(valueRatings).forEach(valueStr => {
      const value = parseInt(valueStr, 10);
      const ratings = valueRatings[value];
      
      // Only adjust if we have enough data (at least 3 ratings)
      if (ratings && ratings.length >= 3) {
        const goodCount = ratings.filter(r => r.rating === 'good').length;
        const successRate = goodCount / ratings.length;
        
        // Use more gradual adjustments with a wider "normal" range
        if (successRate > 0.65) {
          // If success rate is high but not extreme, make questions slightly harder
          category.difficultyAdjustments![value] = Math.min(
            (category.difficultyAdjustments![value] || 0) + 1, 2
          );
        } else if (successRate > 0.85) {
          // If success rate is very high, make questions significantly harder
          category.difficultyAdjustments![value] = 2;
        } else if (successRate < 0.35) {
          // If success rate is low but not extreme, make questions slightly easier
          category.difficultyAdjustments![value] = Math.max(
            (category.difficultyAdjustments![value] || 0) - 1, -2
          );
        } else if (successRate < 0.15) {
          // If success rate is very low, make questions significantly easier
          category.difficultyAdjustments![value] = -2;
        }
        // For success rates between 35-65%, maintain current difficulty
      }
    });
    
    // Save adjustments to localStorage for persistence
    try {
      const adjustmentsKey = 'jeopardy_difficulty_adjustments';
      const savedAdjustments = localStorage.getItem(adjustmentsKey);
      const allAdjustments = savedAdjustments ? JSON.parse(savedAdjustments) : {};
      
      // Update with the latest adjustments
      allAdjustments[category.title] = category.difficultyAdjustments;
      localStorage.setItem(adjustmentsKey, JSON.stringify(allAdjustments));
      
      // Also save ratings for analytics
      const ratingsKey = 'jeopardy_question_difficulty_ratings';
      const allRatings = localStorage.getItem(ratingsKey) ? 
        JSON.parse(localStorage.getItem(ratingsKey) || '[]') : [];
      
      // Add new ratings to the stored collection
      category.questions.forEach(question => {
        if (question.ratings && question.ratings.length > 0) {
          question.ratings.forEach(rating => {
            allRatings.push({
              category: category.title,
              value: question.value,
              clue: question.text,
              answer: question.answer,
              rating: rating.rating,
              timestamp: rating.timestamp
            });
          });
        }
      });
      
      localStorage.setItem(ratingsKey, JSON.stringify(allRatings));
    } catch (e) {
      console.error('Error saving difficulty adjustments:', e);
    }
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
    
    // Mark question as answered and add rating
    const updatedCategories = [...gameState.categories];
    
    // Add rating to the question
    const rating: Rating = {
      rating: correct ? 'good' : 'bad',
      timestamp: new Date().toISOString()
    };
    
    // Ensure ratings array exists
    if (!updatedCategories[categoryIndex].questions[questionIndex].ratings) {
      updatedCategories[categoryIndex].questions[questionIndex].ratings = [];
    }
    
    // Add the new rating
    updatedCategories[categoryIndex].questions[questionIndex].ratings!.push(rating);
    updatedCategories[categoryIndex].questions[questionIndex].answered = true;
    
    // Update difficulty adjustments based on this answer
    adjustCategoryDifficulty(updatedCategories, categoryIndex);
    
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
    
    // Mark question as answered and add rating
    const updatedCategories = [...gameState.categories];
    
    // Add "bad" rating to the question if at least one player got it wrong
    if (Object.keys(incorrectPlayers).length > 0) {
      const rating: Rating = {
        rating: 'bad',
        timestamp: new Date().toISOString()
      };
      
      // Ensure ratings array exists
      if (!updatedCategories[categoryIndex].questions[questionIndex].ratings) {
        updatedCategories[categoryIndex].questions[questionIndex].ratings = [];
      }
      
      // Add the new rating
      updatedCategories[categoryIndex].questions[questionIndex].ratings!.push(rating);
    }
    
    updatedCategories[categoryIndex].questions[questionIndex].answered = true;
    
    // Update difficulty adjustments based on this answer
    adjustCategoryDifficulty(updatedCategories, categoryIndex);
    
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

  // Test API Key functionality
  const testApiKey = async () => {
    // Clear previous test results
    setTestResult(null);
    
    // Provider-specific validation
    if (aiProvider === 'openrouter') {
      if (!apiKey || !apiKey.trim()) {
        setTestResult({ success: false, message: 'Please enter an API key' });
        return;
      }
      
      if (!modelId || !modelId.trim()) {
        setTestResult({ success: false, message: 'Please enter a Model ID' });
        return;
      }
    } else if (aiProvider === 'ollama') {
      if (!ollamaModel || !ollamaModel.trim()) {
        setTestResult({ success: false, message: 'Please enter an Ollama model name' });
        return;
      }
    }
    
    setIsTesting(true);
    
    try {
      const testPrompt = 'Respond with exactly: "API connection successful"';
      
      let response;
      
      if (aiProvider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'Jeopardy Game - API Test'
          },
          body: JSON.stringify({
            model: modelId || 'gpt-oss-120b',
            messages: [
              { role: 'user', content: testPrompt }
            ],
            max_tokens: 50,
            temperature: 0.1
          })
        });
      } else {
        // Ollama API call
        response = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: 'user', content: testPrompt }
            ],
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 50
            }
          })
        });
      }
      
      if (!response.ok) {
        let errorMessage = `Error ${response.status}: `;
        
        if (aiProvider === 'openrouter') {
          if (response.status === 400) {
            const errorText = await response.text();
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage += errorJson.error?.message || 'Bad request. Please check your API key and model ID format';
            } catch {
              errorMessage += 'Bad request. Please check your API key and model ID format';
            }
          } else if (response.status === 401) {
            errorMessage += 'Invalid API key';
          } else if (response.status === 404) {
            errorMessage += 'Model not found. Please check your Model ID';
          } else if (response.status === 429) {
            errorMessage += 'Rate limit exceeded. Please wait and try again';
          } else if (response.status === 402) {
            errorMessage += 'Insufficient credits on your OpenRouter account';
          } else {
            const errorText = await response.text();
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage += errorJson.error?.message || response.statusText;
            } catch {
              errorMessage += response.statusText;
            }
          }
        } else {
          // Ollama-specific error handling
          if (response.status === 404) {
            errorMessage += `Model "${ollamaModel}" not found. Pull it with: ollama pull ${ollamaModel}`;
          } else if (response.status === 0 || !response.status) {
            errorMessage = 'Cannot connect to Ollama. Make sure Ollama is running with: ollama serve';
          } else {
            const errorText = await response.text();
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage += errorJson.error || response.statusText;
            } catch {
              errorMessage += response.statusText;
            }
          }
        }
        
        setTestResult({ success: false, message: errorMessage });
        return;
      }
      
      const data = await response.json();
      
      // Verify we got a response based on provider
      if (aiProvider === 'openrouter') {
        if (data.choices && data.choices[0]?.message?.content) {
          setTestResult({ 
            success: true, 
            message: `✓ Connection successful! Model "${modelId}" is working.` 
          });
        } else {
          setTestResult({ 
            success: false, 
            message: 'Unexpected response format from API' 
          });
        }
      } else {
        // Ollama response format
        if (data.message?.content || (data.response && typeof data.response === 'string')) {
          setTestResult({ 
            success: true, 
            message: `✓ Ollama connection successful! Model "${ollamaModel}" is working.` 
          });
        } else {
          setTestResult({ 
            success: false, 
            message: 'Unexpected response format from Ollama. Make sure Ollama is running and the model is installed.' 
          });
        }
      }
      
    } catch (error) {
      console.error('API test error:', error);
      
      let errorMessage = 'Connection failed: ';
      if (aiProvider === 'ollama') {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          errorMessage = 'Cannot connect to Ollama. Please ensure:\n1. Ollama is installed and running (ollama serve)\n2. The URL is correct (default: http://localhost:11434)\n3. No firewall is blocking the connection';
        } else {
          errorMessage += error instanceof Error ? error.message : 'Unknown error';
        }
      } else {
        errorMessage += error instanceof Error ? error.message : 'Unknown error';
      }
      
      setTestResult({ 
        success: false, 
        message: errorMessage
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Generate questions with AI
  const generateQuestions = async () => {
    // Provider-specific validation
    if (aiProvider === 'openrouter') {
      if (!apiKey || !apiKey.trim()) {
        alert("Please enter an OpenRouter API key");
        return;
      }
      
      if (!modelId || !modelId.trim()) {
        alert("Please enter a Model ID (e.g., openai/gpt-4.1-mini, google/gemini-2.0-flash-001)");
        return;
      }
    } else if (aiProvider === 'ollama') {
      if (!ollamaModel || !ollamaModel.trim()) {
        alert("Please enter an Ollama model name (e.g., llama2, mistral)");
        return;
      }
    }
    
    // Save settings to localStorage
    localStorage.setItem('jeopardy_api_key', apiKey);
    localStorage.setItem('jeopardy_ai_provider', aiProvider);
    localStorage.setItem('jeopardy_model_id', modelId);
    localStorage.setItem('jeopardy_ollama_model', ollamaModel);
    localStorage.setItem('jeopardy_ollama_url', ollamaUrl);
    localStorage.setItem('jeopardy_system_message', systemMessage);
    localStorage.setItem('jeopardy_temperature', temperature.toString());
    
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
      
      // Create a simpler prompt for debugging API connectivity
      const isDebugMode = false;
      
      // Load existing difficulty adjustments for guidance
      let difficultyGuidance = '';
      try {
        const adjustmentsKey = 'jeopardy_difficulty_adjustments';
        const savedAdjustmentsStr = localStorage.getItem(adjustmentsKey);
        
        // Load ratings data to provide concrete examples
        const ratingsKey = 'jeopardy_question_difficulty_ratings';
        const ratingsStr = localStorage.getItem(ratingsKey);
        const ratingsData = ratingsStr ? JSON.parse(ratingsStr) : [];
        
        if (savedAdjustmentsStr) {
          const savedAdjustments = JSON.parse(savedAdjustmentsStr);
          
          // Build difficulty guidance based on stored adjustments
          Object.keys(savedAdjustments).forEach(categoryTitle => {
            const adjustments = savedAdjustments[categoryTitle];
            
            // Only include categories with actual adjustments
            const hasAdjustments = Object.values(adjustments).some(adj => adj !== 0);
            if (hasAdjustments) {
              difficultyGuidance += `For category similar to "${categoryTitle}", adjust difficulty as follows:\n`;
              
              // Add specific examples from rating data when available
              const categoryRatings = ratingsData.filter((r: any) => 
                r.category.toLowerCase() === categoryTitle.toLowerCase() || 
                r.category.toLowerCase().includes(categoryTitle.toLowerCase()) ||
                categoryTitle.toLowerCase().includes(r.category.toLowerCase())
              );
              
              Object.keys(adjustments).forEach(valueStr => {
                const value = parseInt(valueStr, 10);
                const adjustment = adjustments[value];
                
                if (adjustment !== 0) {
                  // Provide specific guidance for each value tier
                  if (adjustment > 0) {
                    difficultyGuidance += `- For $${value} questions: Make them ${adjustment > 1 ? 'significantly' : 'somewhat'} HARDER with more specific details and specialized knowledge\n`;
                    
                    // Find examples of questions that were too easy (rated "good")
                    const easyExamples = categoryRatings.filter((r: any) => 
                      r.value === value && r.rating === 'good'
                    ).slice(0, 2); // Limit to 2 examples
                    
                    if (easyExamples.length > 0) {
                      difficultyGuidance += `  Examples of questions that were too easy:\n`;
                      easyExamples.forEach((ex: any) => {
                        difficultyGuidance += `  * "${ex.clue}" → "${ex.answer}"\n`;
                      });
                    }
                    
                  } else if (adjustment < 0) {
                    difficultyGuidance += `- For $${value} questions: Make them ${adjustment < -1 ? 'significantly' : 'somewhat'} EASIER with more common knowledge and simpler concepts\n`;
                    
                    // Find examples of questions that were too difficult (rated "bad")
                    const hardExamples = categoryRatings.filter((r: any) => 
                      r.value === value && r.rating === 'bad'
                    ).slice(0, 2); // Limit to 2 examples
                    
                    if (hardExamples.length > 0) {
                      difficultyGuidance += `  Examples of questions that were too difficult:\n`;
                      hardExamples.forEach((ex: any) => {
                        difficultyGuidance += `  * "${ex.clue}" → "${ex.answer}"\n`;
                      });
                    }
                  }
                }
              });
              
              difficultyGuidance += '\n';
            }
          });
        }
      } catch (e) {
        console.error('Error loading difficulty adjustments for AI prompt:', e);
      }
      
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
        ${difficultyGuidance ? `\n\nDIFFICULTY ADJUSTMENT GUIDANCE based on player performance:\n${difficultyGuidance}` : ''}
        
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
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        ollama: `${ollamaUrl}/api/chat`
      };
      
      // Set up enhanced retry mechanism with multiple proxy attempts
      const maxRetries = 4; // Increased to allow trying multiple proxy services
      let retries = 0;
      let success = false;
      let lastError = null;
      
      // API request configurations
      const apiConfigs = {
        openrouter: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'Jeopardy Game'
          },
          body: JSON.stringify({
            model: modelId || 'gpt-oss-120b',
            messages: [
              { role: 'user', content: prompt }
            ],
            max_tokens: 4000,
            temperature: temperature
          })
        },
        ollama: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: prompt }
            ],
            stream: false,
            options: {
              temperature: temperature,
              num_predict: 4000
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
          
          
          const response = await fetch(apiEndpoints[endpointKey as keyof typeof apiEndpoints], fetchConfig);
          
          if (!response.ok) {
            // Handle specific error codes with more helpful messages
            let errorMessage = "";
            
            if (response.status === 400) {
              const responseText = await response.text();
              console.error("Bad request error details:", responseText);
              let parsedError = "";
              try {
                const errorJson = JSON.parse(responseText);
                parsedError = errorJson.error?.message || errorJson.message || "";
              } catch {
                parsedError = responseText;
              }
              throw new Error(`Bad request (400): ${parsedError || 'Please check your API key and model ID format. For OpenRouter, use format like "openai/gpt-4o-mini" or "anthropic/claude-3-haiku"'}`);
            } else if (response.status === 429) {
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
            case 'openrouter':
              jsonContent = data.choices[0].message.content;
              break;
            case 'ollama':
              // Ollama can return content in different formats
              jsonContent = data.message?.content || data.response || '';
              break;
            default:
              jsonContent = data.choices?.[0]?.message?.content || data.message?.content || '';
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
            // Initialize default difficulty adjustments
            let categoryAdjustments = {
              200: 0,
              400: 0,
              600: 0,
              800: 0,
              1000: 0
            };
            
            // Check if we have saved adjustments for similar categories
            try {
              const adjustmentsKey = 'jeopardy_difficulty_adjustments';
              const savedAdjustmentsStr = localStorage.getItem(adjustmentsKey);
              
              if (savedAdjustmentsStr) {
                const savedAdjustments = JSON.parse(savedAdjustmentsStr);
                
                // Find if we have adjustments for a similar category
                const similarCategory = Object.keys(savedAdjustments).find(existingCat => 
                  existingCat.toLowerCase().includes(cat.title.toLowerCase()) || 
                  cat.title.toLowerCase().includes(existingCat.toLowerCase())
                );
                
                if (similarCategory) {
                  // Use adjustments from the similar category
                  categoryAdjustments = savedAdjustments[similarCategory];
                  console.log(`Applied difficulty adjustments from similar category "${similarCategory}" to "${cat.title}"`);
                }
              }
            } catch (e) {
              console.error('Error loading difficulty adjustments:', e);
            }
            
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
                ruleViolation: !validation.valid ? validation.reason : null,
                // Initialize ratings array
                ratings: []
              };
            });
            
            return {
              title: cat.title,
              questions: validatedQuestions,
              difficultyAdjustments: categoryAdjustments
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
  
  
  // Export game board to JSON file
  const exportGameBoard = () => {
    try {
      const exportData = {
        name: `Jeopardy Board Export - ${new Date().toLocaleString()}`,
        date: new Date().toISOString(),
        gameState: gameState,
        version: "1.0"
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      
      // Check if data is too large (>10MB)
      if (dataStr.length > 10 * 1024 * 1024) {
        alert('Game board is too large to export. Please reduce the number of categories or questions.');
        return;
      }
      
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Use modern download approach
      if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        // Safari fallback
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`<pre>${dataStr}</pre>`);
          newWindow.document.title = 'Jeopardy Board Export - Copy and Save as .json file';
        }
      } else {
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `jeopardy-board-${Date.now()}.json`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Clean up immediately
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }
      
      console.log('Game board exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export game board. Please try again.');
    }
  };
  
  // Import game board from JSON file
  const importGameBoard = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large. Please select a file smaller than 10MB.');
      event.target.value = '';
      return;
    }
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please select a valid JSON file.');
      event.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      event.target.value = '';
    };
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        if (!content || content.trim() === '') {
          throw new Error('File is empty');
        }
        
        const importedData = JSON.parse(content);
        
        // Validate the imported data structure
        if (!importedData || typeof importedData !== 'object') {
          throw new Error('Invalid file format - not a valid JSON object');
        }
        
        if (!importedData.gameState || !importedData.gameState.categories || !importedData.gameState.players) {
          throw new Error('Invalid file format - missing required game data');
        }
        
        // Additional validation
        if (!Array.isArray(importedData.gameState.categories) || !Array.isArray(importedData.gameState.players)) {
          throw new Error('Invalid file format - categories and players must be arrays');
        }
        
        if (importedData.gameState.categories.length !== 6) {
          throw new Error('Invalid file format - must have exactly 6 categories');
        }
        
        const confirmMessage = `Import "${importedData.name || 'Unnamed Board'}"?\n\nThis will replace your current game board and all progress will be lost.`;
        
        if (window.confirm(confirmMessage)) {
          setGameState(importedData.gameState);
          setSelectedQuestion(null);
          setShowAnswer(false);
          setIncorrectPlayers({});
          setDailyDoubleWager(null);
          setShowDailyDoubleWager(false);
          console.log('Game board imported successfully');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Error importing file: ${errorMessage}`);
        console.error('Import error:', error);
      } finally {
        // Always clear the input
        event.target.value = '';
      }
    };
    
    reader.readAsText(file);
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
          
          {/* Export/Import Controls */}
          <div className="export-import-controls">
            <button className="export-button" onClick={exportGameBoard}>
              Export Board
            </button>
            <label className="import-button">
              Import Board
              <input 
                type="file" 
                accept=".json"
                onChange={importGameBoard}
                style={{ display: 'none' }}
              />
            </label>
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
              
              {/* Provider Selection */}
              <div className="form-group">
                <label>
                  <span className="label-text">AI Provider:</span>
                </label>
                <select 
                  value={aiProvider} 
                  onChange={(e) => {
                    setAiProvider(e.target.value as 'openrouter' | 'ollama');
                    setTestResult(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#001a4d',
                    color: 'white',
                    border: '2px solid #4a90e2',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="openrouter">OpenRouter (Cloud API)</option>
                  <option value="ollama">Ollama (Local Models)</option>
                </select>
              </div>
              
              {/* Test API Key Section */}
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <button 
                  onClick={testApiKey}
                  disabled={isTesting || (aiProvider === 'openrouter' ? (!apiKey || !modelId) : !ollamaModel)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: isTesting ? '#666' : '#2e7d32',
                    color: 'white',
                    border: '2px solid #81c784',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: isTesting || (aiProvider === 'openrouter' ? (!apiKey || !modelId) : !ollamaModel) ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isTesting ? 'Testing...' : 'Test API Connection'}
                </button>
                
                {testResult && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: testResult.success ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                    border: `1px solid ${testResult.success ? '#4caf50' : '#f44336'}`,
                    borderRadius: '4px',
                    color: testResult.success ? '#81c784' : '#ef9a9a',
                    fontSize: '0.9rem',
                    fontWeight: testResult.success ? 'bold' : 'normal'
                  }}>
                    {testResult.message}
                  </div>
                )}
                
                <p style={{
                  marginTop: '10px',
                  marginBottom: '0',
                  fontSize: '0.85rem',
                  color: '#b3d9ff',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  Test your API key and model before generating questions
                </p>
              </div>
              
              {/* OpenRouter-specific fields */}
              {aiProvider === 'openrouter' && (
                <>
                  <div className="form-group">
                    <label>API Key:</label>
                    <input 
                      type="password" 
                      value={apiKey} 
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setTestResult(null); // Clear test result when API key changes
                      }} 
                      placeholder="Enter your OpenRouter API key"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <span className="label-text">Model ID:</span>
                      <span className="label-hint" style={{ fontSize: '0.85em', color: '#888', display: 'block', marginTop: '4px' }}>
                        Suggested: google/gemini-2.5-flash-lite, google/gemini-2.0-flash-001, google/gemma-3-27b,
                        openai/gpt-5-nano, openai/gpt-4.1-mini, openai/gpt-oss-120b,
                        qwen/qwen3-235b-a22b-2507, qwen/qwen3-30b-a3b-thinking-2507,
                        deepseek/deepseek-chat-v3.1, anthropic/claude-3.5-haiku
                      </span>
                    </label>
                    <input 
                      type="text" 
                      value={modelId} 
                      onChange={(e) => {
                        setModelId(e.target.value);
                        setTestResult(null); // Clear test result when model ID changes
                      }} 
                      placeholder="e.g. openai/gpt-4.1-mini, google/gemini-2.0-flash-001, deepseek/deepseek-chat-v3.1"
                    />
                  </div>
                </>
              )}
              
              {/* Ollama-specific fields */}
              {aiProvider === 'ollama' && (
                <>
                  <div className="form-group">
                    <label>
                      <span className="label-text">Ollama URL:</span>
                      <span className="label-hint">Local Ollama server endpoint</span>
                    </label>
                    <input 
                      type="text" 
                      value={ollamaUrl} 
                      onChange={(e) => {
                        setOllamaUrl(e.target.value);
                        setTestResult(null);
                      }} 
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <span className="label-text">Model Name:</span>
                      <span className="label-hint">e.g. llama2, mistral, gemma, mixtral</span>
                    </label>
                    <input 
                      type="text" 
                      value={ollamaModel} 
                      onChange={(e) => {
                        setOllamaModel(e.target.value);
                        setTestResult(null);
                      }} 
                      placeholder="e.g. llama2, mistral"
                    />
                  </div>
                  <div style={{
                    padding: '10px',
                    backgroundColor: 'rgba(102, 179, 255, 0.1)',
                    border: '1px solid #4a90e2',
                    borderRadius: '4px',
                    marginBottom: '15px',
                    fontSize: '0.9rem',
                    color: '#b3d9ff'
                  }}>
                    <strong>📝 Note:</strong> Make sure Ollama is running locally with: <code style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px'}}>ollama serve</code>
                    <br />
                    Pull models with: <code style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px'}}>ollama pull llama2</code>
                  </div>
                </>
              )}
              <div className="form-group">
                <label>
                  <span className="label-text">Temperature:</span>
                  <span className="label-hint">Higher values = more creative/varied results (0.0-1.0)</span>
                </label>
                <div className="temperature-control">
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="temperature-slider"
                  />
                  <span className="temperature-value">{temperature}</span>
                </div>
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
                  rows={5}
                  className="system-message-input"
                />
              </div>
              <div className="form-group reference-text-group">
                <label>
                  <span className="label-text">Reference Text (Optional):</span>
                  <span className="label-hint">Add content to generate subject-specific questions</span>
                </label>
                <textarea 
                  value={referenceText} 
                  onChange={(e) => setReferenceText(e.target.value)} 
                  placeholder="Paste text, articles, or lesson material that should be used as the basis for questions"
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
                            {/* Difficulty adjustment indicator - only shown in editor mode */}
                            {showEditor && category.difficultyAdjustments && category.difficultyAdjustments[question.value] !== 0 && (
                              <div className={`difficulty-indicator ${category.difficultyAdjustments[question.value] > 0 ? 'harder' : 'easier'}`}>
                                {category.difficultyAdjustments[question.value] > 0 ? '↑' : '↓'}
                                {Math.abs(category.difficultyAdjustments[question.value])}
                              </div>
                            )}
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