export const validateQuestionRule = (
  categoryTitle: string,
  questionText: string,
  answerText: string
): { valid: boolean; reason?: string } => {
  const normalizeText = (text: string) =>
    text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');

  const normalizedCategory = normalizeText(categoryTitle);
  const normalizedQuestion = normalizeText(questionText);
  const normalizedAnswer = normalizeText(answerText);

  const categoryWords = normalizedCategory.split(/\s+/).filter((word) => word.length > 2);
  const questionWords = normalizedQuestion.split(/\s+/).filter((word) => word.length > 2);
  const answerWords = normalizedAnswer.split(/\s+/);
  const allClueWords = [...categoryWords, ...questionWords];

  const overlappingWords = allClueWords.filter((word) =>
    answerWords.some((answerWord) => answerWord === word)
  );

  if (overlappingWords.length > 0) {
    return {
      valid: false,
      reason: `Answer contains words from the clue or category: ${overlappingWords.join(', ')}`,
    };
  }

  const vaguePhrases = [
    'known for',
    'famous for',
    'renowned for',
    'recognized for',
    'celebrated for',
    'this country',
    'this nation',
    'this place',
    'this region',
    'this area',
    'this city',
    'this culture',
    'this tradition',
    'unique blend',
    'rich history',
    'diverse landscape',
  ];

  const hasVaguePhrases = vaguePhrases.some((phrase) =>
    normalizedQuestion.includes(normalizeText(phrase))
  );

  if (hasVaguePhrases) {
    return {
      valid: false,
      reason:
        'Question may be too vague and could accept multiple answers. Consider adding more specific, distinguishing details.',
    };
  }

  return { valid: true };
};

export const logBadResponse = (
  categoryTitle: string,
  questionText: string,
  answerText: string,
  reason: string
) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const existingLogs = JSON.parse(localStorage.getItem('jeopardy_format_issues') || '[]');
    existingLogs.push({
      category: categoryTitle,
      clue: questionText,
      answer: answerText,
      issue: reason,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('jeopardy_format_issues', JSON.stringify(existingLogs));
  } catch {
    // Ignore analytics failures.
  }
};
