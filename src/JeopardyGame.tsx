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
  answered: false
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
  const [aiProvider, setAiProvider] = useState('claude');
  const [apiKey, setApiKey] = useState('');
  const [systemMessage, setSystemMessage] = useState('You are a Jeopardy game creator. Create interesting and challenging questions.');
  const [referenceText, setReferenceText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gameTheme, setGameTheme] = useState('standard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundNotification, setSoundNotification] = useState<string | null>(null);
  
  // Board editing state
  const [showEditor, setShowEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{index: number, title: string} | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<{
    categoryIndex: number,
    questionIndex: number,
    text: string,
    answer: string,
    value: number
  } | null>(null);
  
  // Player management state
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const [editingPlayers, setEditingPlayers] = useState<Player[]>([]);
  const [tempPlayerCount, setTempPlayerCount] = useState(playerCount);
  
  // Audio refs
  const correctSound = useRef<HTMLAudioElement | null>(null);
  const incorrectSound = useRef<HTMLAudioElement | null>(null);
  const themeMusic = useRef<HTMLAudioElement | null>(null);
  const revealSound = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    // Handle sound initialization in a try-catch to prevent errors
    try {
      // Check if we're running in the browser
      if (typeof window === 'undefined') return;
      
      // Initialize audio once on mount
      if (
        correctSound.current === null && 
        incorrectSound.current === null &&
        themeMusic.current === null &&
        revealSound.current === null
      ) {
        // Create dummy audio elements first to unlock audio API 
        const unlockAudio = document.createElement('audio');
        unlockAudio.setAttribute('src', 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
        unlockAudio.play().catch(() => {});
        
        // Create actual audio elements
        correctSound.current = new Audio();
        incorrectSound.current = new Audio();
        themeMusic.current = new Audio(); 
        revealSound.current = new Audio();
        
        // Set dummy sources to avoid errors - we're not actually playing sounds
        correctSound.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        incorrectSound.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'; 
        themeMusic.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        revealSound.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        
        // Preload
        [correctSound.current, incorrectSound.current, themeMusic.current, revealSound.current].forEach(audio => {
          if (audio) {
            audio.load();
            // Set volume to max
            audio.volume = 1.0;
            // Disable looping except for theme
            audio.loop = audio === themeMusic.current;
          }
        });
        
        // Silently try to play and pause to unlock audio in some browsers
        document.addEventListener('click', function initAudio() {
          if (correctSound.current) {
            correctSound.current.play()
              .then(() => {
                correctSound.current!.pause();
                correctSound.current!.currentTime = 0;
                console.log("Audio initialized successfully via user interaction");
              })
              .catch(e => console.log("Audio API still restricted:", e));
          }
          document.removeEventListener('click', initAudio);
        }, { once: true });
      }
      
      // Load saved settings from localStorage
      const savedKey = localStorage.getItem('jeopardy_api_key');
      if (savedKey) setApiKey(savedKey);
      
      const savedProvider = localStorage.getItem('jeopardy_ai_provider');
      if (savedProvider) setAiProvider(savedProvider);
      
      const savedSystemMessage = localStorage.getItem('jeopardy_system_message');
      if (savedSystemMessage) setSystemMessage(savedSystemMessage);
      
      const savedSoundSetting = localStorage.getItem('jeopardy_sound_enabled');
      if (savedSoundSetting !== null) {
        setSoundEnabled(savedSoundSetting === 'true');
      }
    } catch (error) {
      console.error("Error initializing audio:", error);
    }
    
    return () => {
      try {
        if (themeMusic.current) {
          themeMusic.current.pause();
          themeMusic.current.currentTime = 0;
        }
      } catch (error) {
        console.error("Error cleaning up audio:", error);
      }
    };
  }, []);

  // Save sound setting to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jeopardy_sound_enabled', soundEnabled.toString());
    }
  }, [soundEnabled]);
  
  // Dummy sound function that only logs - to prevent errors
  const playSound = (type: 'correct' | 'incorrect' | 'theme' | 'reveal') => {
    if (!soundEnabled) return;
    
    // Just log that we would play a sound, but don't actually try to play it
    console.log(`Sound effect (${type}) would play here if enabled`);
    
    // In a real implementation with working sound files, we would play them here
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
  const handleAnswer = (correct: boolean, playerIndex?: number) => {
    if (!selectedQuestion) return;
    
    // We would stop theme music here if it was playing
    console.log('Would stop theme music here');
    
    const { categoryIndex, questionIndex } = selectedQuestion;
    const questionValue = gameState.categories[categoryIndex].questions[questionIndex].value;
    
    // Play sound based on answer
    playSound(correct ? 'correct' : 'incorrect');
    
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
    
    // Close the question view
    setSelectedQuestion(null);
    setShowAnswer(false);
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
      value: question.value
    });
  };
  
  // Save edited question
  const saveQuestion = () => {
    if (!editingQuestion) return;
    
    const updatedCategories = [...gameState.categories];
    const { categoryIndex, questionIndex, text, answer, value } = editingQuestion;
    
    updatedCategories[categoryIndex].questions[questionIndex] = {
      ...updatedCategories[categoryIndex].questions[questionIndex],
      text,
      answer,
      value
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
    
    // Save settings to localStorage
    localStorage.setItem('jeopardy_api_key', apiKey);
    localStorage.setItem('jeopardy_ai_provider', aiProvider);
    localStorage.setItem('jeopardy_system_message', systemMessage);
    
    setIsGenerating(true);
    
    try {
      // Create categories and questions structure to generate
      const categories = gameState.categories.map(cat => cat.title);
      
      // Format the prompt for the AI
      const prompt = `Generate a Jeopardy game with these categories: ${categories.join(', ')}. 
      For each category, create 5 clues with increasing difficulty and their correct responses.
      ${referenceText ? `Use the following reference content for creating questions: ${referenceText}` : ''}
      
      Important:
      - Clues should be statements or facts, NOT questions
      - Responses should always start with "What is" or "Who is" etc.
      - Do not include the answer within the clue text
      - Make sure clues don't give away the answer directly
      
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
        meta: 'https://api.together.xyz/v1/chat/completions',
        gemini: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent'
      };
      
      // Set up retry mechanism
      const maxRetries = 2;
      let retries = 0;
      let success = false;
      let lastError = null;
      
      // API request configurations
      const apiConfigs = {
        claude: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'messages-2023-06-01-short-backlog'
          },
          body: JSON.stringify({
            model: 'claude-3-opus-20240229',
            max_tokens: 4000,
            messages: [
              { role: 'system', content: systemMessage },
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
              { role: 'system', content: systemMessage },
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
              { role: 'system', content: systemMessage },
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
              { role: 'system', content: systemMessage },
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
              { role: 'system', content: systemMessage },
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
                  { text: `${systemMessage}\n\n${prompt}` }
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
          
          const response = await fetch(apiEndpoints[aiProvider as keyof typeof apiEndpoints], 
                                      apiConfigs[aiProvider as keyof typeof apiConfigs]);
          
          if (!response.ok) {
            // Handle specific error codes with more helpful messages
            let errorMessage = "";
            
            if (response.status === 429) {
              errorMessage = "Rate limit exceeded. Waiting and retrying...";
              // Wait longer with each retry
              await new Promise(resolve => setTimeout(resolve, 2000 * (retries + 1)));
            } else if (response.status === 401 || response.status === 403) {
              throw new Error("Authentication failed. Please check that your API key is valid and has not expired.");
            } else if (response.status >= 500) {
              errorMessage = "The AI service is currently experiencing issues. Retrying...";
              await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
              throw new Error(`API request failed: ${response.status} ${response.statusText}`);
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
            case 'claude':
              jsonContent = data.content[0].text;
              break;
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
          return; // Exit the function on success
          
        } catch (error: any) {
          lastError = error;
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
          <button 
            onClick={() => {
              // Toggle sound state
              const newSoundState = !soundEnabled;
              setSoundEnabled(newSoundState);
              
              // Try to play a test sound if enabling sound
              if (newSoundState && correctSound.current) {
                // Just toggle sound state without trying to play anything
                console.log("Sound toggled:", newSoundState ? "on" : "off");
                // No need to attempt playing sounds immediately
              }
            }}
            className={soundEnabled ? 'sound-on' : 'sound-off'}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
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
                      className={`question-cell ${question.answered ? 'answered' : ''} ${showEditor ? 'editable' : ''}`}
                      onClick={() => {
                        if (showEditor) {
                          handleEditQuestion(categoryIndex, questionIndex);
                        } else {
                          handleQuestionSelect(categoryIndex, questionIndex);
                        }
                      }}
                    >
                      {question.answered && !showEditor ? '' : `$${question.value}`}
                      {showEditor && (
                        <div className="edit-icon">✏️</div>
                      )}
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
                  <h3>Correct Response:</h3>
                  <p className="correct-response">{gameState.categories[selectedQuestion.categoryIndex].questions[selectedQuestion.questionIndex].answer}</p>
                </div>
              )}
              
              <div className="question-controls">
                <button onClick={toggleShowAnswer}>
                  {showAnswer ? 'Hide Response' : 'Show Response'}
                </button>
                
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
                    
                    <div className="back-option">
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
                          
                          // Close the question view
                          setSelectedQuestion(null);
                          setShowAnswer(false);
                        }}
                      >
                        Return to Board (No Points)
                      </button>
                    </div>
                  </div>
                ) : null}
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
            <div className="form-group">
              <label>Clue Text:</label>
              <textarea 
                value={editingQuestion.text} 
                onChange={(e) => setEditingQuestion({...editingQuestion, text: e.target.value})}
                rows={4}
                autoFocus
                placeholder="Phrase as a statement, not a question"
              />
            </div>
            <div className="form-group">
              <label>Correct Response:</label>
              <input 
                type="text" 
                value={editingQuestion.answer} 
                onChange={(e) => setEditingQuestion({...editingQuestion, answer: e.target.value})}
                placeholder="Should start with 'What is' or 'Who is'"
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