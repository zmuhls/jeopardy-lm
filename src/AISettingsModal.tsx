import React, { useEffect, useState } from 'react';

import {
  createDefaultQuestion,
  createDifficultyAdjustments,
  defaultCategories,
  defaultValues,
} from './jeopardyDefaults';
import { logBadResponse, validateQuestionRule } from './questionValidation';
import type { AIProvider, Category } from './jeopardyTypes';

const DEFAULT_SYSTEM_MESSAGE =
  'Create a high-quality Jeopardy! game board with diverse, challenging, and well-structured categories and questions. Follow these key principles:\n\n- Make clues SPECIFIC with ONE unambiguous answer (e.g., NOT "This East Asian country has a unique blend of traditional culture" - too vague)\n- Use clever, engaging category titles\n- Ensure gradual difficulty increase from $200 to $1000 questions\n- Make clues factually accurate and verifiable\n- Format answers as questions ("Who is/What is...")\n- Do not repeat concepts across categories\n- NEVER include answer words in the clue text';

interface AISettingsModalProps {
  onClose: () => void;
  onGeneratedCategories: (categories: Category[]) => void;
}

const buildMockCategories = (): Category[] => {
  const mockData = {
    categories: [
      {
        title: 'World History',
        questions: [
          { text: 'This emperor built a famous wall in northern China to keep out invaders', answer: 'Who is Qin Shi Huang?', value: 200 },
          { text: "This 'Great' ruler modernized Russia in the early 18th century", answer: 'Who is Peter the Great?', value: 400 },
          { text: 'In 1453, this city fell to Ottoman forces led by Mehmed II', answer: 'What is Constantinople?', value: 600 },
          { text: "This Mongol leader's empire stretched from the Pacific Ocean to Eastern Europe", answer: 'Who is Genghis Khan?', value: 800 },
          { text: 'The 1648 Treaty of Westphalia ended this European conflict', answer: 'What is the Thirty Years\' War?', value: 1000 },
        ],
      },
      {
        title: 'Science',
        questions: [
          { text: 'The chemical formula H2O represents this common substance', answer: 'What is water?', value: 200 },
          { text: 'This element with symbol Fe is the most common on Earth by mass', answer: 'What is iron?', value: 400 },
          { text: 'This scientist published the theory of general relativity in 1915', answer: 'Who is Albert Einstein?', value: 600 },
          { text: 'This subatomic particle carries a positive charge', answer: 'What is a proton?', value: 800 },
          { text: 'CRISPR-Cas9 is a technology used to edit this molecule', answer: 'What is DNA?', value: 1000 },
        ],
      },
      {
        title: 'Pop Culture',
        questions: [
          { text: 'This 1997 film featured Leonardo DiCaprio and Kate Winslet on a doomed ocean liner', answer: 'What is Titanic?', value: 200 },
          { text: "This Swedish group's hits include 'Dancing Queen' and 'Mamma Mia'", answer: 'Who is ABBA?', value: 400 },
          { text: "This streaming service produced 'Stranger Things' and 'The Crown'", answer: 'What is Netflix?', value: 600 },
          { text: 'This superhero film franchise has grossed over $25 billion worldwide', answer: 'What is the Marvel Cinematic Universe?', value: 800 },
          { text: "This British band's concept album 'The Dark Side of the Moon' stayed on charts for 15 years", answer: 'Who is Pink Floyd?', value: 1000 },
        ],
      },
      {
        title: 'Literature',
        questions: [
          { text: 'This Shakespeare play features the character Juliet Capulet', answer: 'What is Romeo and Juliet?', value: 200 },
          { text: "This author wrote 'Pride and Prejudice' and 'Emma'", answer: 'Who is Jane Austen?', value: 400 },
          { text: "This dystopian novel by George Orwell introduced the concept of 'Big Brother'", answer: 'What is 1984?', value: 600 },
          { text: "This Colombian author wrote 'One Hundred Years of Solitude'", answer: 'Who is Gabriel Garcia Marquez?', value: 800 },
          { text: 'This James Joyce novel follows Leopold Bloom through a single day in Dublin', answer: 'What is Ulysses?', value: 1000 },
        ],
      },
      {
        title: 'Sports',
        questions: [
          { text: 'This sport uses a shuttlecock', answer: 'What is badminton?', value: 200 },
          { text: 'Wayne Gretzky is considered the greatest player in the history of this sport', answer: 'What is hockey?', value: 400 },
          { text: 'This golfer has won 15 major championships', answer: 'Who is Tiger Woods?', value: 600 },
          { text: 'In tennis, this term refers to a tied score of 40-40', answer: 'What is deuce?', value: 800 },
          { text: "This swimming stroke is performed on one's back", answer: 'What is backstroke?', value: 1000 },
        ],
      },
      {
        title: 'Geography',
        questions: [
          { text: 'This is the largest ocean on Earth', answer: 'What is the Pacific Ocean?', value: 200 },
          { text: 'This African country is home to the Pyramids of Giza', answer: 'What is Egypt?', value: 400 },
          { text: 'The Amazon River flows through this rainforest', answer: 'What is the Amazon Rainforest?', value: 600 },
          { text: 'This mountain range separates Europe from Asia', answer: 'What are the Ural Mountains?', value: 800 },
          { text: 'This capital city sits at the mouth of the Chao Phraya River', answer: 'What is Bangkok?', value: 1000 },
        ],
      },
    ],
  };

  return mockData.categories.map((category) => ({
    title: category.title,
    questions: category.questions.map((question) => ({
      text: question.text,
      answer: question.answer,
      value: question.value,
      revealed: false,
      answered: false,
      dailyDouble: false,
      ruleViolation: null,
      ratings: [],
    })),
    difficultyAdjustments: createDifficultyAdjustments(),
  }));
};

const buildFallbackCategories = (): Category[] =>
  defaultCategories.map((title) => ({
    title: `${title} (AI Error)`,
    questions: defaultValues.map((value, index) => ({
      text: `JSON parse error occurred. This is a fallback question ${index + 1} for ${value} points.`,
      answer: 'What is a JSON parsing error?',
      value,
      revealed: false,
      answered: false,
      dailyDouble: false,
      ruleViolation: null,
      ratings: [],
    })),
    difficultyAdjustments: createDifficultyAdjustments(),
  }));

const extractJsonCandidate = (jsonContent: string) => {
  const codeBlockMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  const jsonRegex = /(\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}))*\})/g;
  const balancedMatches = jsonContent.match(jsonRegex);
  if (balancedMatches && balancedMatches.length > 0) {
    return balancedMatches.sort((a, b) => b.length - a.length)[0];
  }

  const braceMatches = jsonContent.match(/\{[\s\S]*?\}/g);
  if (braceMatches && braceMatches.length > 0) {
    return braceMatches.sort((a, b) => b.length - a.length)[0];
  }

  return jsonContent.match(/\{[\s\S]*\}/)?.[0] || null;
};

const sanitizeJsonCandidate = (candidate: string) => {
  let sanitizedJson = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');

  sanitizedJson = sanitizedJson.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match
      .replace(/\\(?!["\\/bfnrt])/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
  );

  sanitizedJson = sanitizedJson
    .replace(/,\s*}/g, '}')
    .replace(/,\s*\]/g, ']')
    .replace(/"\s+"/g, '" "')
    .replace(/"\{/g, '{')
    .replace(/\}"/g, '}')
    .replace(/"\[/g, '[')
    .replace(/\]"/g, ']');

  const jsonLines = sanitizedJson.split('\n');
  if (jsonLines.length >= 13) {
    jsonLines[12] = jsonLines[12].replace(/(".*?)([\u0000-\u001F])(.+?")/g, '$1\\$2$3');
    sanitizedJson = jsonLines.join('\n');
  }

  return sanitizedJson.replace(/"(?:[^"\\]|\\["\\bfnrt])*"/g, (match) =>
    match.replace(/\\([^"\\bfnrt/])/g, '\\\\$1')
  );
};

const parseJsonCandidate = (candidate: string) => {
  const sanitizedJson = sanitizeJsonCandidate(candidate);

  try {
    return JSON.parse(sanitizedJson);
  } catch {
    try {
      const aggressiveJson = sanitizedJson
        .replace(/\\(?!["\\/bfnrt])/g, '\\\\')
        .replace(/[\n\r\t\f]/g, ' ')
        .replace(/"\s+"/g, '" "')
        .replace(/([^\\])"/g, '$1\\"')
        .replace(/\\\\"/g, '\\"')
        .replace(/\\"/g, '\\"');

      return JSON.parse(aggressiveJson);
    } catch {
      try {
        const categoryMatch = sanitizedJson.match(/"categories"\s*:\s*(\[[\s\S]*?\])/);
        if (!categoryMatch) {
          throw new Error('Missing categories array');
        }
        return JSON.parse(`{"categories":${categoryMatch[1]}}`);
      } catch {
        const fixedJson = sanitizedJson
          .replace(/("[^"]*)(")([^"]*")/g, '$1\\"$3')
          .replace(/([\[\{,]\s*)([^,\{\[\]\"\d-])/g, '$1"$2')
          .replace(/([^\s\]\}"])(\s*[\]\},])/g, '$1"$2');

        return JSON.parse(fixedJson);
      }
    }
  }
};

const ensureBoardShape = (categories: Category[]) => {
  let normalized = categories;

  if (normalized.length < 6) {
    const placeholders = defaultCategories.slice(0, 6 - normalized.length).map((title) => ({
      title: `${title} (Generated)`,
      questions: defaultValues.map(createDefaultQuestion),
      difficultyAdjustments: createDifficultyAdjustments(),
    }));
    normalized = [...normalized, ...placeholders];
  } else if (normalized.length > 6) {
    normalized = normalized.slice(0, 6);
  }

  const positions: Array<{ categoryIndex: number; questionIndex: number }> = [];
  let dailyDoubleCount = 0;

  normalized.forEach((category, categoryIndex) => {
    category.questions.forEach((question, questionIndex) => {
      positions.push({ categoryIndex, questionIndex });
      if (question.dailyDouble) {
        dailyDoubleCount++;
      }
    });
  });

  if (dailyDoubleCount > 2) {
    const dailyDoublePositions = positions.filter(
      ({ categoryIndex, questionIndex }) => normalized[categoryIndex].questions[questionIndex].dailyDouble
    );

    dailyDoublePositions.sort(() => Math.random() - 0.5);
    dailyDoublePositions.slice(0, dailyDoublePositions.length - 2).forEach(({ categoryIndex, questionIndex }) => {
      normalized[categoryIndex].questions[questionIndex].dailyDouble = false;
    });
  } else if (dailyDoubleCount < 2) {
    positions
      .sort(() => Math.random() - 0.5)
      .filter(({ categoryIndex, questionIndex }) => !normalized[categoryIndex].questions[questionIndex].dailyDouble)
      .slice(0, 2 - dailyDoubleCount)
      .forEach(({ categoryIndex, questionIndex }) => {
        normalized[categoryIndex].questions[questionIndex].dailyDouble = true;
      });
  }

  return normalized;
};

export default function AISettingsModal({
  onClose,
  onGeneratedCategories,
}: AISettingsModalProps) {
  const [aiProvider, setAiProvider] = useState<AIProvider>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('google/gemini-2.5-flash-lite');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [temperature, setTemperature] = useState(0.7);
  const [systemMessage, setSystemMessage] = useState(DEFAULT_SYSTEM_MESSAGE);
  const [referenceText, setReferenceText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const savedKey = localStorage.getItem('jeopardy_api_key');
      if (savedKey) {
        setApiKey(savedKey);
      }

      const savedProvider = localStorage.getItem('jeopardy_ai_provider');
      if (savedProvider === 'openrouter' || savedProvider === 'ollama') {
        setAiProvider(savedProvider);
      }

      const savedModelId = localStorage.getItem('jeopardy_model_id');
      if (savedModelId) {
        setModelId(savedModelId);
      }

      const savedOllamaModel = localStorage.getItem('jeopardy_ollama_model');
      if (savedOllamaModel) {
        setOllamaModel(savedOllamaModel);
      }

      const savedOllamaUrl = localStorage.getItem('jeopardy_ollama_url');
      if (savedOllamaUrl) {
        setOllamaUrl(savedOllamaUrl);
      }

      const savedSystemMessage = localStorage.getItem('jeopardy_system_message');
      if (savedSystemMessage) {
        setSystemMessage(savedSystemMessage);
      }

      const savedTemperature = localStorage.getItem('jeopardy_temperature');
      if (savedTemperature) {
        setTemperature(parseFloat(savedTemperature));
      }
    } catch {
      // Ignore malformed saved settings.
    }
  }, []);

  const testApiKey = async () => {
    setTestResult(null);

    if (aiProvider === 'openrouter') {
      if (!apiKey.trim()) {
        setTestResult({ success: false, message: 'Please enter an API key' });
        return;
      }

      if (!modelId.trim()) {
        setTestResult({ success: false, message: 'Please enter a Model ID' });
        return;
      }
    } else if (!ollamaModel.trim()) {
      setTestResult({ success: false, message: 'Please enter an Ollama model name' });
      return;
    }

    setIsTesting(true);

    try {
      const testPrompt = 'Respond with exactly: "API connection successful"';

      const response =
        aiProvider === 'openrouter'
          ? await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Jeopardy Game - API Test',
              },
              body: JSON.stringify({
                model: modelId || 'gpt-oss-120b',
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 50,
                temperature: 0.1,
              }),
            })
          : await fetch(`${ollamaUrl}/api/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: ollamaModel,
                messages: [{ role: 'user', content: testPrompt }],
                stream: false,
                options: {
                  temperature: 0.1,
                  num_predict: 50,
                },
              }),
            });

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: `;

        if (aiProvider === 'openrouter') {
          if (response.status === 400) {
            try {
              const errorJson = JSON.parse(await response.text());
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
            try {
              const errorJson = JSON.parse(await response.text());
              errorMessage += errorJson.error?.message || response.statusText;
            } catch {
              errorMessage += response.statusText;
            }
          }
        } else if (response.status === 404) {
          errorMessage += `Model "${ollamaModel}" not found. Pull it with: ollama pull ${ollamaModel}`;
        } else if (response.status === 0 || !response.status) {
          errorMessage = 'Cannot connect to Ollama. Make sure Ollama is running with: ollama serve';
        } else {
          try {
            const errorJson = JSON.parse(await response.text());
            errorMessage += errorJson.error || response.statusText;
          } catch {
            errorMessage += response.statusText;
          }
        }

        setTestResult({ success: false, message: errorMessage });
        return;
      }

      const data = await response.json();

      if (aiProvider === 'openrouter') {
        setTestResult(
          data.choices?.[0]?.message?.content
            ? { success: true, message: `Connection successful. Model "${modelId}" is working.` }
            : { success: false, message: 'Unexpected response format from API' }
        );
      } else {
        setTestResult(
          data.message?.content || (data.response && typeof data.response === 'string')
            ? { success: true, message: `Ollama connection successful. Model "${ollamaModel}" is working.` }
            : {
                success: false,
                message: 'Unexpected response format from Ollama. Make sure Ollama is running and the model is installed.',
              }
        );
      }
    } catch (error) {
      let errorMessage = 'Connection failed: ';
      if (aiProvider === 'ollama' && error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage =
          'Cannot connect to Ollama. Please ensure:\n1. Ollama is installed and running (ollama serve)\n2. The URL is correct (default: http://localhost:11434)\n3. No firewall is blocking the connection';
      } else {
        errorMessage += error instanceof Error ? error.message : 'Unknown error';
      }

      setTestResult({ success: false, message: errorMessage });
    } finally {
      setIsTesting(false);
    }
  };

  const generateQuestions = async () => {
    setTestResult(null);

    if (aiProvider === 'openrouter') {
      if (!apiKey.trim()) {
        setTestResult({ success: false, message: 'Please enter an OpenRouter API key' });
        return;
      }
      if (!modelId.trim()) {
        setTestResult({
          success: false,
          message: 'Please enter a Model ID such as openai/gpt-4.1-mini or google/gemini-2.0-flash-001',
        });
        return;
      }
    } else if (!ollamaModel.trim()) {
      setTestResult({ success: false, message: 'Please enter an Ollama model name such as llama2 or mistral' });
      return;
    }

    localStorage.setItem('jeopardy_api_key', apiKey);
    localStorage.setItem('jeopardy_ai_provider', aiProvider);
    localStorage.setItem('jeopardy_model_id', modelId);
    localStorage.setItem('jeopardy_ollama_model', ollamaModel);
    localStorage.setItem('jeopardy_ollama_url', ollamaUrl);
    localStorage.setItem('jeopardy_system_message', systemMessage);
    localStorage.setItem('jeopardy_temperature', temperature.toString());

    setIsGenerating(true);

    try {
      const useMockResponse = false;

      if (useMockResponse) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        onGeneratedCategories(buildMockCategories());
        onClose();
        return;
      }

      let difficultyGuidance = '';
      try {
        const savedAdjustmentsStr = localStorage.getItem('jeopardy_difficulty_adjustments');
        const ratingsStr = localStorage.getItem('jeopardy_question_difficulty_ratings');
        const ratingsData = ratingsStr ? JSON.parse(ratingsStr) : [];

        if (savedAdjustmentsStr) {
          const savedAdjustments = JSON.parse(savedAdjustmentsStr);

          Object.keys(savedAdjustments).forEach((categoryTitle) => {
            const adjustments = savedAdjustments[categoryTitle];
            const hasAdjustments = Object.values(adjustments).some((adjustment) => adjustment !== 0);

            if (!hasAdjustments) {
              return;
            }

            difficultyGuidance += `For category similar to "${categoryTitle}", adjust difficulty as follows:\n`;

            const categoryRatings = ratingsData.filter((rating: any) =>
              rating.category.toLowerCase() === categoryTitle.toLowerCase() ||
              rating.category.toLowerCase().includes(categoryTitle.toLowerCase()) ||
              categoryTitle.toLowerCase().includes(rating.category.toLowerCase())
            );

            Object.keys(adjustments).forEach((valueStr) => {
              const value = parseInt(valueStr, 10);
              const adjustment = adjustments[value];

              if (adjustment > 0) {
                difficultyGuidance += `- For $${value} questions: Make them ${adjustment > 1 ? 'significantly' : 'somewhat'} HARDER with more specific details and specialized knowledge\n`;

                categoryRatings
                  .filter((rating: any) => rating.value === value && rating.rating === 'good')
                  .slice(0, 2)
                  .forEach((example: any) => {
                    difficultyGuidance += `  * "${example.clue}" -> "${example.answer}"\n`;
                  });
              } else if (adjustment < 0) {
                difficultyGuidance += `- For $${value} questions: Make them ${adjustment < -1 ? 'significantly' : 'somewhat'} EASIER with more common knowledge and simpler concepts\n`;

                categoryRatings
                  .filter((rating: any) => rating.value === value && rating.rating === 'bad')
                  .slice(0, 2)
                  .forEach((example: any) => {
                    difficultyGuidance += `  * "${example.clue}" -> "${example.answer}"\n`;
                  });
              }
            });

            difficultyGuidance += '\n';
          });
        }
      } catch (error) {
        console.error('Error loading difficulty adjustments for AI prompt:', error);
      }

      const combinedReferenceText = referenceText ? `${systemMessage}\n\n${referenceText}` : systemMessage;
      const prompt = `Create a new Jeopardy game board with EXACTLY 6 creative categories.
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
                }
              ]
            }
          ]
        }

        IMPORTANT REQUIREMENTS:
        1. The response MUST include EXACTLY 6 categories in the "categories" array.
        2. There MUST be EXACTLY 2 questions total marked as dailyDouble: true across all categories.`;

      const apiEndpoints = {
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        ollama: `${ollamaUrl}/api/chat`,
      };

      const apiConfigs = {
        openrouter: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'Jeopardy Game',
          },
          body: JSON.stringify({
            model: modelId || 'gpt-oss-120b',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4000,
            temperature,
          }),
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
              { role: 'user', content: prompt },
            ],
            stream: false,
            options: {
              temperature,
              num_predict: 4000,
            },
          }),
        },
      } as const;

      const maxRetries = 4;
      let retries = 0;
      let lastError: unknown = null;

      while (retries <= maxRetries) {
        try {
          const response = await fetch(apiEndpoints[aiProvider], {
            ...(apiConfigs[aiProvider] as RequestInit),
            mode: 'cors',
            credentials: 'omit',
          });

          if (!response.ok) {
            if (response.status === 400) {
              const responseText = await response.text();
              let parsedError = '';
              try {
                const errorJson = JSON.parse(responseText);
                parsedError = errorJson.error?.message || errorJson.message || '';
              } catch {
                parsedError = responseText;
              }
              throw new Error(
                `Bad request (400): ${parsedError || 'Please check your API key and model ID format. For OpenRouter, use format like "openai/gpt-4o-mini" or "anthropic/claude-3-haiku"'}`
              );
            }

            if (response.status === 429) {
              await new Promise((resolve) => setTimeout(resolve, 2000 * (retries + 1)));
              retries++;
              continue;
            }

            if (response.status === 401 || response.status === 403) {
              throw new Error(
                `Authentication failed: ${response.status} ${response.statusText}. Please check that your API key is valid, has not expired, and has the correct format.`
              );
            }

            if (response.status >= 500) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              retries++;
              continue;
            }

            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const jsonContent =
            aiProvider === 'openrouter'
              ? data.choices?.[0]?.message?.content || ''
              : data.message?.content || data.response || '';

          const candidate = extractJsonCandidate(jsonContent);
          const parsedData = candidate ? parseJsonCandidate(candidate) : { categories: buildFallbackCategories() };
          const savedAdjustmentsStr = localStorage.getItem('jeopardy_difficulty_adjustments');
          const savedAdjustments = savedAdjustmentsStr ? JSON.parse(savedAdjustmentsStr) : {};

          const parsedCategories = Array.isArray(parsedData?.categories)
            ? parsedData.categories
            : buildFallbackCategories();

          let formattedCategories: Category[] = parsedCategories.map((category: any) => {
            const similarCategory = Object.keys(savedAdjustments).find(
              (existingTitle) =>
                existingTitle.toLowerCase().includes(String(category.title || '').toLowerCase()) ||
                String(category.title || '').toLowerCase().includes(existingTitle.toLowerCase())
            );

            const difficultyAdjustments = similarCategory
              ? savedAdjustments[similarCategory]
              : createDifficultyAdjustments();

            const questions = Array.isArray(category.questions) ? category.questions : defaultValues.map(createDefaultQuestion);

            return {
              title: category.title || 'Generated Category',
              questions: questions.map((question: any) => {
                const validation = validateQuestionRule(
                  String(category.title || 'Generated Category'),
                  String(question.text || ''),
                  String(question.answer || '')
                );

                if (!validation.valid) {
                  logBadResponse(
                    String(category.title || 'Generated Category'),
                    String(question.text || ''),
                    String(question.answer || ''),
                    validation.reason || 'Unknown rule violation'
                  );
                }

                return {
                  text: String(question.text || 'Generated clue unavailable'),
                  answer: String(question.answer || 'What is unavailable?'),
                  value: Number(question.value) || 200,
                  revealed: false,
                  answered: false,
                  dailyDouble: question.dailyDouble === true,
                  ruleViolation: validation.valid ? null : validation.reason,
                  ratings: [],
                };
              }),
              difficultyAdjustments,
            };
          });

          formattedCategories = ensureBoardShape(formattedCategories);
          onGeneratedCategories(formattedCategories);
          onClose();
          return;
        } catch (error) {
          lastError = error;

          if (
            error instanceof TypeError ||
            (error instanceof Error &&
              (error.message.includes('Rate limit exceeded') || error.message.includes('experiencing issues')))
          ) {
            retries++;
            if (retries <= maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
              continue;
            }
          }

          throw error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Question generation failed.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Question generation failed.';
      setTestResult({ success: false, message: `Generation failed: ${errorMessage}` });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="ai-settings-modal" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ai-settings-panel">
        <div className="ai-settings-header">
          <div>
            <h2 className="ai-settings-title">AI Configuration</h2>
            <p className="ai-settings-subtitle">
              {aiProvider === 'openrouter' ? 'OpenRouter — Cloud API' : 'Ollama — Local Inference'}
            </p>
          </div>
          <button className="ai-settings-close" onClick={onClose} aria-label="Close">
            &#x2715;
          </button>
        </div>

        <div className="provider-tabs">
          <button
            className={`provider-tab${aiProvider === 'openrouter' ? ' active' : ''}`}
            onClick={() => { setAiProvider('openrouter'); setTestResult(null); }}
          >
            &#9729; OpenRouter
          </button>
          <button
            className={`provider-tab${aiProvider === 'ollama' ? ' active' : ''}`}
            onClick={() => { setAiProvider('ollama'); setTestResult(null); }}
          >
            &#x29c6; Ollama (Local)
          </button>
        </div>

        {aiProvider === 'openrouter' ? (
          <div className="ai-provider-panel">
            <div className="ai-field-group">
              <label className="ai-field-label">API Key</label>
              <div className="ai-input-row">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => { setApiKey(event.target.value); setTestResult(null); }}
                  placeholder="sk-or-..."
                  className="ai-input"
                />
                <button
                  className="ai-eye-toggle"
                  onClick={() => setShowApiKey((visible) => !visible)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  type="button"
                >
                  {showApiKey ? '&#x1F648;' : '&#x1F441;'}
                </button>
              </div>
              {apiKey && <span className="ai-field-saved">&#x2713; Key saved in session</span>}
            </div>

            <div className="ai-field-group">
              <label className="ai-field-label">Model</label>
              <input
                type="text"
                value={modelId}
                onChange={(event) => { setModelId(event.target.value); setTestResult(null); }}
                placeholder="provider/model-id"
                className="ai-input"
              />
              <div className="model-chip-section">
                <div className="model-chip-group-label">Google</div>
                <div className="model-chip-grid">
                  {['google/gemini-2.5-flash-lite', 'google/gemini-2.0-flash-001', 'google/gemma-3-27b'].map((model) => (
                    <button
                      key={model}
                      className={`model-chip${modelId === model ? ' selected' : ''}`}
                      onClick={() => { setModelId(model); setTestResult(null); }}
                    >
                      {model.split('/')[1]}
                    </button>
                  ))}
                </div>
                <div className="model-chip-group-label">OpenAI</div>
                <div className="model-chip-grid">
                  {['openai/gpt-4.1-mini', 'openai/gpt-5-nano', 'openai/gpt-oss-120b'].map((model) => (
                    <button
                      key={model}
                      className={`model-chip${modelId === model ? ' selected' : ''}`}
                      onClick={() => { setModelId(model); setTestResult(null); }}
                    >
                      {model.split('/')[1]}
                    </button>
                  ))}
                </div>
                <div className="model-chip-group-label">DeepSeek &amp; Others</div>
                <div className="model-chip-grid">
                  {['deepseek/deepseek-chat-v3.1', 'anthropic/claude-3.5-haiku', 'qwen/qwen3-235b-a22b-2507'].map((model) => (
                    <button
                      key={model}
                      className={`model-chip${modelId === model ? ' selected' : ''}`}
                      onClick={() => { setModelId(model); setTestResult(null); }}
                    >
                      {model.split('/')[1]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="ai-provider-panel">
            <div className="ai-field-group">
              <label className="ai-field-label">Server URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(event) => { setOllamaUrl(event.target.value); setTestResult(null); }}
                placeholder="http://localhost:11434"
                className="ai-input"
              />
            </div>
            <div className="ai-field-group">
              <label className="ai-field-label">Model Name</label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(event) => { setOllamaModel(event.target.value); setTestResult(null); }}
                placeholder="llama2, mistral, gemma, mixtral"
                className="ai-input"
              />
            </div>
            <div className="ai-ollama-note">
              Start server: <code>ollama serve</code> &nbsp;|&nbsp; Pull model: <code>ollama pull llama2</code>
            </div>
          </div>
        )}

        <div className="ai-field-group">
          <label className="ai-field-label">Temperature</label>
          <div className="temp-segmented">
            {([
              [0.0, 'Precise'],
              [0.3, 'Balanced'],
              [0.5, 'Standard'],
              [0.7, 'Creative'],
              [1.0, 'Wild'],
            ] as [number, string][]).map(([value, label]) => (
              <button
                key={value}
                className={`temp-seg-btn${temperature === value ? ' active' : ''}`}
                onClick={() => setTemperature(value)}
                type="button"
              >
                <span className="temp-seg-val">{value.toFixed(1)}</span>
                <span className="temp-seg-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ai-field-group">
          <div className="ai-textarea-header">
            <label className="ai-field-label">System Message</label>
            <span className="ai-char-count">{systemMessage.length} chars</span>
          </div>
          <textarea
            value={systemMessage}
            onChange={(event) => setSystemMessage(event.target.value)}
            placeholder="Instructions for how the AI should generate questions..."
            rows={4}
            className="ai-textarea system-msg"
          />
        </div>

        <div className="ai-field-group">
          <div className="ai-textarea-header">
            <label className="ai-field-label">
              Reference Text <span className="ai-optional">optional</span>
            </label>
            <span className="ai-char-count">{referenceText.length} chars</span>
          </div>
          <textarea
            value={referenceText}
            onChange={(event) => setReferenceText(event.target.value)}
            placeholder="Paste source material — articles, lesson notes, textbook excerpts — to ground question generation in your content."
            rows={4}
            className="ai-textarea reference-msg"
          />
        </div>

        {testResult && (
          <div className={`ai-test-result${testResult.success ? ' success' : ' error'}`}>
            <span className="ai-test-icon">{testResult.success ? '&#x2713;' : '&#x2717;'}</span>
            {testResult.message}
          </div>
        )}

        <div className="ai-action-footer">
          <button
            className="ai-btn-test"
            onClick={testApiKey}
            disabled={isTesting || (aiProvider === 'openrouter' ? (!apiKey || !modelId) : !ollamaModel)}
            type="button"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="ai-btn-generate" onClick={generateQuestions} disabled={isGenerating} type="button">
            {isGenerating ? 'Generating...' : 'Save & Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
