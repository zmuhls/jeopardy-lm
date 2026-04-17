import dynamic from 'next/dynamic';
import React, { useCallback, memo, useEffect, useState } from 'react';

import { initializeCategories, initializePlayers } from './jeopardyDefaults';
import { logBadResponse, validateQuestionRule } from './questionValidation';
import type { Category, GameState, IncorrectPlayers, Player, Question, Rating } from './jeopardyTypes';

const AISettingsModal = dynamic(() => import('./AISettingsModal'));

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score === 2) return { score, label: 'Fair', color: '#f97316' };
  if (score === 3) return { score, label: 'Good', color: '#eab308' };
  if (score === 4) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Very Strong', color: '#00e5ff' };
}

const QuestionCell = memo(function QuestionCell({
  question,
  category,
  categoryIndex,
  questionIndex,
  showEditor,
  onSelect,
  onEdit,
}: {
  question: Question;
  category: Category;
  categoryIndex: number;
  questionIndex: number;
  showEditor: boolean;
  onSelect: (ci: number, qi: number) => void;
  onEdit: (ci: number, qi: number) => void;
}) {
  return (
    <div
      className={`question-cell ${question.answered ? 'answered' : ''} ${showEditor ? 'editable' : ''} ${question.dailyDouble && question.revealed ? 'daily-double' : ''}`}
      onClick={() => showEditor ? onEdit(categoryIndex, questionIndex) : onSelect(categoryIndex, questionIndex)}
    >
      <div className="question-value-container">
        {question.answered && !showEditor ? '' : (
          <>
            {`$${question.value}`}
            {question.dailyDouble && !question.answered && showEditor && (
              <div className="daily-double-indicator">DD</div>
            )}
            {showEditor && category.difficultyAdjustments && category.difficultyAdjustments[question.value] !== 0 && (
              <div className={`difficulty-indicator ${category.difficultyAdjustments[question.value] > 0 ? 'harder' : 'easier'}`}>
                {category.difficultyAdjustments[question.value] > 0 ? '↑' : '↓'}
                {Math.abs(category.difficultyAdjustments[question.value])}
              </div>
            )}
          </>
        )}
        {showEditor && <div className="edit-icon">✏️</div>}
      </div>
    </div>
  );
});

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
  const [showSettings, setShowSettings] = useState(false);
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
  
  // Auth + boards state
  const [authUser, setAuthUser] = useState<{userId: number; username: string} | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showBoards, setShowBoards] = useState(false);
  const [boards, setBoards] = useState<{id: number; name: string; updated_at: string}[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [saveBoardName, setSaveBoardName] = useState('');
  const [showSaveBoard, setShowSaveBoard] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Player management state
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const [editingPlayers, setEditingPlayers] = useState<Player[]>([]);
  const [tempPlayerCount, setTempPlayerCount] = useState(playerCount);
  
  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      if (data) setAuthUser(data);
    }).catch(() => {});
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'register') {
      if (authPassword !== authPasswordConfirm) {
        setAuthError('Passwords do not match');
        return;
      }
      const strength = getPasswordStrength(authPassword);
      if (strength.score < 2) {
        setAuthError('Password is too weak — add uppercase letters, numbers, or symbols');
        return;
      }
    }

    setAuthLoading(true);
    try {
      const body = authMode === 'login'
        ? { login: authUsername, password: authPassword }
        : { username: authUsername, email: authEmail, password: authPassword };

      const res = await fetch(`/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Error'); return; }
      setAuthUser(data);
      setShowAuth(false);
      setAuthUsername('');
      setAuthEmail('');
      setAuthPassword('');
      setAuthPasswordConfirm('');
    } catch {
      setAuthError('Network error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthUser(null);
    setShowBoards(false);
  };

  const loadBoards = async () => {
    setBoardsLoading(true);
    try {
      const res = await fetch('/api/boards');
      if (res.ok) setBoards(await res.json());
    } finally {
      setBoardsLoading(false);
    }
  };

  const openBoards = () => {
    setShowBoards(true);
    loadBoards();
  };

  const loadBoard = async (id: number) => {
    const res = await fetch(`/api/boards/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const gs = data.board_data?.gameState;
    if (gs) {
      setGameState(gs);
      setSelectedQuestion(null);
      setShowAnswer(false);
      setShowBoards(false);
    }
  };

  const deleteBoard = async (id: number) => {
    await fetch(`/api/boards/${id}`, { method: 'DELETE' });
    setBoards(prev => prev.filter(b => b.id !== id));
  };

  const saveBoard = async () => {
    if (!saveBoardName.trim()) return;
    setSaveStatus(null);
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: saveBoardName.trim(),
        board_data: {
          gameState,
          version: '1.0',
          date: new Date().toISOString(),
        },
      }),
    });
    if (res.ok) {
      setSaveStatus('Saved!');
      setSaveBoardName('');
      setTimeout(() => { setShowSaveBoard(false); setSaveStatus(null); }, 1200);
    } else {
      setSaveStatus('Failed to save');
    }
  };

  // Initialize persisted view state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedTheme = localStorage.getItem('jeopardy_theme');
      if (savedTheme) {
        setGameTheme(savedTheme);
      }
    } catch {
      // Ignore malformed saved preferences.
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
  
  // Stable callbacks for memoized QuestionCell — skip re-renders during auth/UI state changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleQuestionSelectCb = useCallback(handleQuestionSelect, [gameState]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleEditQuestionCb = useCallback(handleEditQuestion, [gameState, showEditor]);

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
          {/* Board group: editing tools */}
          <div className="ctrl-group">
            <button onClick={() => setShowEditor(!showEditor)}>
              {showEditor ? 'Close Editor' : 'Edit Board'}
            </button>
            <button onClick={openPlayerSettings}>
              Players ({gameState.players.length})
            </button>
          </div>

          {/* Settings group: AI config + theme */}
          <div className="ctrl-group">
            <button onClick={() => setShowSettings(!showSettings)}>
              AI Config
            </button>
            <select
              value={gameTheme}
              onChange={(e) => setGameTheme(e.target.value)}
              className="theme-selector"
              aria-label="Theme"
            >
              <option value="standard">Standard</option>
              <option value="dark">Dark</option>
              <option value="retro">Retro</option>
            </select>
          </div>

          {/* Data group: export / import / cloud */}
          <div className="ctrl-group">
            <button className="export-button" onClick={exportGameBoard}>
              Export
            </button>
            <label className="import-button">
              Import
              <input
                type="file"
                accept=".json"
                onChange={importGameBoard}
                style={{ display: 'none' }}
              />
            </label>
            {authUser ? (
              <>
                <button className="cloud-btn" onClick={openBoards}>My Boards</button>
                <button className="cloud-btn" onClick={() => setShowSaveBoard(true)}>Save</button>
                <span className="cloud-username">{authUser.username}</span>
                <button className="cloud-btn cloud-btn-logout" onClick={handleLogout}>Sign Out</button>
              </>
            ) : (
              <button className="cloud-btn cloud-btn-signin" onClick={() => { setShowAuth(true); setAuthMode('login'); }}>
                Sign In
              </button>
            )}
          </div>

          {/* Game flow group: main actions */}
          <div className="ctrl-group">
            <button className="btn-primary" onClick={activateFinalJeopardy} disabled={gameState.finalJeopardyActive}>
              Final Jeopardy
            </button>
            <button className="btn-danger" onClick={resetGame}>Reset</button>
          </div>
        </div>
        
        
        {/* AI Settings Modal */}
        {showSettings && (
          <AISettingsModal
            onClose={() => setShowSettings(false)}
            onGeneratedCategories={(categories) => {
              setGameState((currentState) => ({
                ...currentState,
                categories,
              }));
            }}
          />
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
                {gameState.categories.map((category, categoryIndex) => (
                  <QuestionCell
                    key={`${categoryIndex}-${questionIndex}`}
                    question={category.questions[questionIndex]}
                    category={category}
                    categoryIndex={categoryIndex}
                    questionIndex={questionIndex}
                    showEditor={showEditor}
                    onSelect={handleQuestionSelectCb}
                    onEdit={handleEditQuestionCb}
                  />
                ))}
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
                      <button className={showAnswer ? 'btn-ghost' : 'btn-primary'} onClick={toggleShowAnswer}>
                        {showAnswer ? 'Hide Response' : 'Reveal Response'}
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
            <p className="player-name">{player.name}</p>
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
              <button className="btn-ghost" onClick={() => setEditingCategory(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveCategory}>Save</button>
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
              <button className="btn-ghost" onClick={() => setEditingQuestion(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveQuestion}>Save</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Auth Modal */}
      {showAuth && (
        <div className="cloud-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}>
          <div className="cloud-modal">
            <button className="cloud-modal-close" onClick={() => setShowAuth(false)}>&#x2715;</button>
            <h2 className="cloud-modal-title">{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <div className="cloud-modal-tabs">
              <button className={`cloud-modal-tab${authMode === 'login' ? ' active' : ''}`} onClick={() => { setAuthMode('login'); setAuthError(''); setAuthEmail(''); setAuthPasswordConfirm(''); }}>Sign In</button>
              <button className={`cloud-modal-tab${authMode === 'register' ? ' active' : ''}`} onClick={() => { setAuthMode('register'); setAuthError(''); }}>Register</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="cloud-modal-form">
              <input
                className="cloud-modal-input"
                type="text"
                placeholder={authMode === 'login' ? 'Username or email' : 'Username'}
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                autoComplete="username"
                required
              />

              {authMode === 'register' && (
                <input
                  className="cloud-modal-input"
                  type="email"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              )}

              <div className="cloud-pw-wrap">
                <input
                  className="cloud-modal-input"
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                {authMode === 'register' && authPassword.length > 0 && (() => {
                  const s = getPasswordStrength(authPassword);
                  return (
                    <div className="pw-strength">
                      <div className="pw-strength-bar">
                        {[1,2,3,4,5].map(i => (
                          <div
                            key={i}
                            className="pw-strength-seg"
                            style={{ background: i <= s.score ? s.color : '#1a3a6a' }}
                          />
                        ))}
                      </div>
                      <span className="pw-strength-label" style={{ color: s.color }}>{s.label}</span>
                    </div>
                  );
                })()}
              </div>

              {authMode === 'register' && (
                <>
                  <input
                    className="cloud-modal-input"
                    type="password"
                    placeholder="Confirm password"
                    value={authPasswordConfirm}
                    onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <ul className="pw-requirements">
                    <li className={authPassword.length >= 8 ? 'met' : ''}>At least 8 characters</li>
                    <li className={/[A-Z]/.test(authPassword) ? 'met' : ''}>One uppercase letter</li>
                    <li className={/[0-9]/.test(authPassword) ? 'met' : ''}>One number</li>
                    <li className={authPassword === authPasswordConfirm && authPasswordConfirm.length > 0 ? 'met' : ''}>Passwords match</li>
                  </ul>
                </>
              )}

              {authError && <p className="cloud-modal-error">{authError}</p>}
              <button className="cloud-modal-submit" type="submit" disabled={authLoading}>
                {authLoading ? 'Please wait…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <p className="cloud-modal-note">Your boards are saved to the server and accessible from any device.</p>
          </div>
        </div>
      )}

      {/* My Boards Modal */}
      {showBoards && (
        <div className="cloud-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowBoards(false); }}>
          <div className="cloud-modal cloud-modal--wide">
            <button className="cloud-modal-close" onClick={() => setShowBoards(false)}>&#x2715;</button>
            <h2 className="cloud-modal-title">My Boards</h2>
            {boardsLoading ? (
              <p className="cloud-modal-note">Loading…</p>
            ) : boards.length === 0 ? (
              <p className="cloud-modal-note">No saved boards yet. Use &ldquo;Save Board&rdquo; to save your current board.</p>
            ) : (
              <ul className="boards-list">
                {boards.map(b => (
                  <li key={b.id} className="boards-list-item">
                    <div className="boards-item-info">
                      <span className="boards-item-name">{b.name}</span>
                      <span className="boards-item-date">{new Date(b.updated_at).toLocaleDateString()}</span>
                    </div>
                    <div className="boards-item-actions">
                      <button className="boards-btn boards-btn-load" onClick={() => loadBoard(b.id)}>Load</button>
                      <button className="boards-btn boards-btn-delete" onClick={() => deleteBoard(b.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Save Board Dialog */}
      {showSaveBoard && (
        <div className="cloud-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveBoard(false); }}>
          <div className="cloud-modal">
            <button className="cloud-modal-close" onClick={() => setShowSaveBoard(false)}>&#x2715;</button>
            <h2 className="cloud-modal-title">Save Board</h2>
            <div className="cloud-modal-form">
              <input
                className="cloud-modal-input"
                type="text"
                placeholder="Board name…"
                value={saveBoardName}
                onChange={(e) => setSaveBoardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveBoard()}
                autoFocus
              />
              {saveStatus && <p className={`cloud-modal-note${saveStatus === 'Saved!' ? ' cloud-modal-note--success' : ' cloud-modal-error'}`}>{saveStatus}</p>}
              <button className="cloud-modal-submit" onClick={saveBoard} disabled={!saveBoardName.trim()}>
                Save
              </button>
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
              <button className="btn-ghost" onClick={() => setShowPlayerSettings(false)}>Cancel</button>
              <button className="btn-primary" onClick={savePlayerSettings}>Save Players</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
