import { buildQuizQuestion } from './quizEngine.js';

export const practicePartLabels = {
  noun: '名詞',
  verb: '動詞',
  participle: '分詞',
};

export const practiceParts = Object.keys(practicePartLabels);

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'zh-Hant');
  });
}

export function getAvailableBooks(passages) {
  return [...new Set(passages.map((passage) => passage.book))];
}

export function getAvailableChapters(passages, book) {
  return uniqueSorted(
    passages.filter((passage) => passage.book === book).map((passage) => passage.chapter),
  );
}

export function getAvailableVerses(passages, book, chapter) {
  return uniqueSorted(
    passages
      .filter((passage) => passage.book === book && passage.chapter === Number(chapter))
      .map((passage) => passage.verse),
  );
}

export function getPassage(passages, selection) {
  const passage = passages.find(
    (item) =>
      item.book === selection.book &&
      item.chapter === Number(selection.chapter) &&
      item.verse === Number(selection.verse),
  );

  if (!passage) {
    throw new Error('Selected passage is not available.');
  }

  return passage;
}

export function getPracticePartOptions(passage) {
  return practiceParts.map((id) => {
    const count = passage.words.filter((word) => word.partOfSpeech === id).length;
    return {
      id,
      label: practicePartLabels[id],
      count,
      available: count > 0,
    };
  });
}

export function choosePracticePart(passage, desiredPart) {
  const options = getPracticePartOptions(passage);
  const desiredOption = options.find((option) => option.id === desiredPart);
  if (desiredOption?.available) return desiredPart;

  return options.find((option) => option.available)?.id ?? desiredPart;
}

export function getPracticeWordDisplay(
  passage,
  {
    selectedWordId,
    selectedPracticePart,
    settings = {},
  } = {},
) {
  const {
    quizWordsOnly = false,
    highlightCurrentPart = true,
    showParse = true,
  } = settings;

  return passage.words
    .filter((word) => !quizWordsOnly || practiceParts.includes(word.partOfSpeech))
    .map((word) => ({
      ...word,
      active: word.id === selectedWordId,
      highlighted: highlightCurrentPart && word.partOfSpeech === selectedPracticePart,
      showParse,
    }));
}

export function buildPassageQuestion(passages, selection) {
  const passage = getPassage(passages, selection);
  const quizWords = passage.words.filter(
    (word) =>
      word.partOfSpeech !== 'preposition' &&
      word.partOfSpeech !== 'particle' &&
      word.partOfSpeech !== 'pronoun',
  );

  return buildQuizQuestion(quizWords, {
    partOfSpeech: selection.partOfSpeech,
    excludeIds: selection.excludeIds,
    excludeForms: selection.excludeForms,
    requireAlternative: selection.requireAlternative,
    seed: selection.seed,
  });
}
