import React, { useState, useEffect, useRef } from 'react';

// Define types for our game
interface Question {
  text: string;
  answer: string;
  value: number;
  revealed: boolean;
  answered: boolean;
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

// API keys should be provided by users at runtime
const TEST_KEYS = {
  claude: '',
  openai: '',
  mistral: '',
  deepseek: '',
  meta: ''
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
  text: "This question worth $" + value + " needs to be filled in",
  answer: "What is the answer?",
  value: value,
  revealed: false,
  answered: false
});

// Initialize default categories with questions
const initializeCategories = (): Category[] => {
  return defaultCategories.map(title => ({
    title,
    questions: defaultValues.map(createDefaultQuestions)
  }));
};

// Initialize players
const initializePlayers = (): Player[] => {
  return [
    { name: "Player 1", score: 0, active: true },
    { name: "Player 2", score: 0, active: false },
    { name: "Player 3", score: 0, active: false }
  ];
};

export default function JeopardyGame() {
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    categories: initializeCategories(),
    players: initializePlayers(),
    currentPlayer: 0,
    finalJeopardyActive: false
  });
  
  // UI state
  const [selectedQuestion, setSelectedQuestion] = useState<{categoryIndex: number, questionIndex: number} | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [aiProvider, setAiProvider] = useState('claude');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gameTheme, setGameTheme] = useState('standard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Audio refs
  const correctSound = useRef<HTMLAudioElement | null>(null);
  const incorrectSound = useRef<HTMLAudioElement | null>(null);
  const themeMusic = useRef<HTMLAudioElement | null>(null);
  const revealSound = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    correctSound.current = new Audio('/sounds/correct.mp3');
    incorrectSound.current = new Audio('/sounds/incorrect.mp3');
    themeMusic.current = new Audio('/sounds/jeopardy-theme.mp3');
    revealSound.current = new Audio('/sounds/reveal.mp3');
    
    // Optional: Load saved API key from localStorage
    const savedKey = localStorage.getItem('jeopardy_api_key');
    if (savedKey) setApiKey(savedKey);
    
    const savedProvider = localStorage.getItem('jeopardy_ai_provider');
    if (savedProvider) setAiProvider(savedProvider);
    
    return () => {
      if (themeMusic.current) {
        themeMusic.current.pause();
        themeMusic.current.currentTime = 0;
      }
    };
  }, []);

  // Play sounds function
  const playSound = (type: 'correct' | 'incorrect' | 'theme' | 'reveal') => {
    if (!soundEnabled) return;
    
    try {
      switch (type) {
        case 'correct':
          if (correctSound.current) {
            correctSound.current.currentTime = 0;
            correctSound.current.play();
          }
          break;
        case 'incorrect':
          if (incorrectSound.current) {
            incorrectSound.current.currentTime = 0;
            incorrectSound.current.play();
          }
          break;
        case 'theme':
          if (themeMusic.current) {
            themeMusic.current.currentTime = 0;
            themeMusic.current.play();
          }
          break;
        case 'reveal':
          if (revealSound.current) {
            revealSound.current.currentTime = 0;
            revealSound.current.play();
          }
          break;
      }
    } catch (err) {
      console.error("Error playing sound:", err);
    }
  };

  // Handle category and question selection
  const handleQuestionSelect = (categoryIndex: number, questionIndex: number) => {
    const question = gameState.categories[categoryIndex].questions[questionIndex];
    
    if (question.answered) return;
    
    // Update the selected question
    setSelectedQuestion({ categoryIndex, questionIndex });
    setShowAnswer(false);
    
    // Mark question as revealed
    const updatedCategories = [...gameState.categories];
    updatedCategories[categoryIndex].questions[questionIndex].revealed = true;
    
    setGameState({
      ...gameState,
      categories: updatedCategories
    });
    
    // Play theme music when question is selected
    playSound('theme');
  };

  // Handle answering questions
  const handleAnswer = (correct: boolean) => {
    if (!selectedQuestion) return;
    
    // Stop theme music
    if (themeMusic.current) {
      themeMusic.current.pause();
      themeMusic.current.currentTime = 0;
    }
    
    const { categoryIndex, questionIndex } = selectedQuestion;
    const questionValue = gameState.categories[categoryIndex].questions[questionIndex].value;
    
    // Play sound based on answer
    playSound(correct ? 'correct' : 'incorrect');
    
    // Update player score
    const updatedPlayers = [...gameState.players];
    const currentPlayerIndex = gameState.currentPlayer;
    
    updatedPlayers[currentPlayerIndex].score += correct 
      ? questionValue 
      : -questionValue;
    
    // Mark question as answered
    const updatedCategories = [...gameState.categories];
    updatedCategories[categoryIndex].questions[questionIndex].answered = true;
    
    // Move to next player
    const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
    
    setGameState({
      ...gameState,
      categories: updatedCategories,
      players: updatedPlayers,
      currentPlayer: nextPlayerIndex
    });
    
    // Close the question view
    setSelectedQuestion(null);
    setShowAnswer(false);
  };

  // Check if all questions have been answered
  const allQuestionsAnswered = (): boolean => {
    return gameState.categories.every(category => 
      category.questions.every(question => question.answered)
    );
  };

  // Toggle answer visibility
  const toggleShowAnswer = () => {
    // Play reveal sound
    if (!showAnswer) {
      playSound('reveal');
    }
    setShowAnswer(!showAnswer);
  };

  // Generate questions with AI
  const generateQuestions = async () => {
    if (!apiKey) {
      alert("Please enter an API key");
      return;
    }
    
    // Save API key and provider to localStorage
    localStorage.setItem('jeopardy_api_key', apiKey);
    localStorage.setItem('jeopardy_ai_provider', aiProvider);
    
    setIsGenerating(true);
    
    try {
      // Create categories and questions structure to generate
      const categories = gameState.categories.map(cat => cat.title);
      
      // Format the prompt for the AI
      const prompt = `Generate a Jeopardy game with these categories: ${categories.join(', ')}. 
      For each category, create 5 questions with increasing difficulty and their answers.
      Format your response as JSON with this exact structure:
      {
        "categories": [
          {
            "title": "Category Name",
            "questions": [
              {
                "text": "The clue text that would be shown to contestants",
                "answer": "What is the correct response?",
                "value": 200
              },
              ... and so on for values 400, 600, 800, 1000
            ]
          },
          ... repeat for all ${categories.length} categories
        ]
      }`;
      
      // API endpoints for different providers
      const apiEndpoints = {
        claude: 'https://api.anthropic.com/v1/messages',
        openai: 'https://api.openai.com/v1/chat/completions',
        mistral: 'https://api.mistral.ai/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/v1/chat/completions',
        meta: 'https://api.together.xyz/v1/chat/completions'
      };
      
      // API request configurations
      const apiConfigs = {
        claude: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-opus-20240229',
            max_tokens: 4000,
            messages: [
              { role: 'user', content: prompt }
            ]
          })
        },
        openai: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are a Jeopardy game creator.' },
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
        }
      };
      
      // Make the API request
      const response = await fetch(apiEndpoints[aiProvider as keyof typeof apiEndpoints], 
                                  apiConfigs[aiProvider as keyof typeof apiConfigs]);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract the JSON from different API responses
      let jsonContent = '';
      
      switch(aiProvider) {
        case 'claude':
          jsonContent = data.content[0].text;
          break;
        case 'openai':
        case 'mistral':
        case 'deepseek':
        case 'meta':
          jsonContent = data.choices[0].message.content;
          break;
      }
      
      // Extract the JSON object from the response text
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("Could not find valid JSON in the response");
      }
      
      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Format the generated content to match our game state structure
      const formattedCategories = parsedData.categories.map((cat: any) => ({
        title: cat.title,
        questions: cat.questions.map((q: any) => ({
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
      
    } catch (error) {
      console.error("Error generating questions:", error);
      alert(`Error generating questions: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Reset the game
  const resetGame = () => {
    if (window.confirm("Are you sure you want to reset the game? All progress will be lost.")) {
      setGameState({
        categories: initializeCategories(),
        players: initializePlayers(),
        currentPlayer: 0,
        finalJeopardyActive: false
      });
      setSelectedQuestion(null);
      setShowAnswer(false);
    }
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
          <button onClick={resetGame}>Reset Game</button>
          <button onClick={activateFinalJeopardy} disabled={gameState.finalJeopardyActive}>
            Final Jeopardy
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </button>
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
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="openai">GPT-4 (OpenAI)</option>
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
                <div key={categoryIndex} className="category-header">
                  {category.title}
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
                      className={`question-cell ${question.answered ? 'answered' : ''}`}
                      onClick={() => handleQuestionSelect(categoryIndex, questionIndex)}
                    >
                      {question.answered ? '' : `$${question.value}`}
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
              <h2>${gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].value}</h2>
              <p className="question-text">
                {gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].text}
              </p>
              
              {showAnswer && (
                <div className="answer">
                  <h3>Answer:</h3>
                  <p>{gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].answer}</p>
                </div>
              )}
              
              <div className="question-controls">
                <button onClick={toggleShowAnswer}>
                  {showAnswer ? 'Hide Answer' : 'Show Answer'}
                </button>
                <div className="answer-buttons">
                  <button 
                    className="correct-button" 
                    onClick={() => handleAnswer(true)}
                  >
                    Correct
                  </button>
                  <button 
                    className="incorrect-button" 
                    onClick={() => handleAnswer(false)}
                  >
                    Incorrect
                  </button>
                </div>
              </div>
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
    </div>
  );
}