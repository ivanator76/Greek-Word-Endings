import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPassageQuestion,
  choosePracticePart,
  getAvailableBooks,
  getAvailableChapters,
  getAvailableVerses,
  getPassage,
  getPracticePartOptions,
  getPracticeWordDisplay,
} from '../src/passageEngine.js';
import { passages } from '../src/data/passages.js';

test('passage selectors expose books, chapters, and verses from local tagged passages', () => {
  assert.deepEqual(getAvailableBooks(passages).slice(0, 5), ['馬太福音', '馬可福音', '路加福音', '約翰福音', '使徒行傳']);
  assert.equal(getAvailableBooks(passages).length, 27);
  assert.deepEqual(getAvailableChapters(passages, '希伯來書').slice(0, 3), [1, 2, 3]);
  assert.ok(getAvailableVerses(passages, '希伯來書', 11).includes(13));
});

test('getPassage returns the selected passage with tagged words', () => {
  const passage = getPassage(passages, { book: '約翰福音', chapter: 1, verse: 1 });

  assert.equal(passage.reference, '約翰福音 1:1');
  assert.ok(passage.words.some((word) => word.form === 'λόγος'));
  assert.ok(passage.words.every((word) => word.reference === passage.reference));
  assert.equal(passage.translation, '太初有道，道與神同在，道就是神。');
  assert.match(passage.greekText, /Ἐν ἀρχῇ/);
});

test('buildPassageQuestion only selects quiz words from the selected passage', () => {
  const question = buildPassageQuestion(passages, {
    book: '羅馬書',
    chapter: 5,
    verse: 1,
    partOfSpeech: 'verb',
    seed: 1,
  });

  assert.equal(question.prompt.reference, '羅馬書 5:1');
  assert.equal(question.prompt.form, 'ἔχωμεν');
  assert.equal(question.correctAnswer, 'VSPA1P');
});

test('buildPassageQuestion can exclude the current word when moving next', () => {
  const current = buildPassageQuestion(passages, {
    book: '約翰福音',
    chapter: 1,
    verse: 1,
    partOfSpeech: 'noun',
    seed: 1,
  });
  const next = buildPassageQuestion(passages, {
    book: '約翰福音',
    chapter: 1,
    verse: 1,
    partOfSpeech: 'noun',
    excludeIds: [current.prompt.id],
    excludeForms: [current.prompt.form],
    seed: 1,
  });

  assert.notEqual(next.prompt.id, current.prompt.id);
  assert.notEqual(next.prompt.form, current.prompt.form);
});

test('generated article tags use D instead of T', () => {
  const johnOneOne = getPassage(passages, { book: '約翰福音', chapter: 1, verse: 1 });
  const article = johnOneOne.words.find((word) => word.partOfSpeech === 'article');

  assert.equal(article.form, 'ὁ');
  assert.equal(article.tag, 'DNMS');
  assert.ok(
    passages
      .flatMap((passage) => passage.words)
      .filter((word) => word.partOfSpeech === 'article')
      .every((word) => word.tag.startsWith('D')),
  );
});

test('practice part options report availability and choose only available parts', () => {
  const matthewOneOne = getPassage(passages, { book: '馬太福音', chapter: 1, verse: 1 });
  const hebrewsElevenThirteen = getPassage(passages, { book: '希伯來書', chapter: 11, verse: 13 });

  assert.deepEqual(
    getPracticePartOptions(matthewOneOne).map((option) => [option.id, option.count, option.available]),
    [
      ['noun', 8, true],
      ['verb', 0, false],
      ['participle', 0, false],
    ],
  );
  assert.equal(choosePracticePart(matthewOneOne, 'verb'), 'noun');
  assert.equal(choosePracticePart(hebrewsElevenThirteen, 'participle'), 'participle');
});

test('practice word display can filter quiz words and flag the active part', () => {
  const johnOneOne = getPassage(passages, { book: '約翰福音', chapter: 1, verse: 1 });

  const allWords = getPracticeWordDisplay(johnOneOne, {
    selectedWordId: 'joh-1-1-1',
    selectedPracticePart: 'noun',
    settings: {
      quizWordsOnly: false,
      highlightCurrentPart: true,
      showParse: true,
    },
  });

  assert.ok(allWords.some((word) => word.partOfSpeech === 'preposition'));
  assert.ok(allWords.some((word) => word.partOfSpeech === 'article'));
  assert.ok(allWords.find((word) => word.form === 'λόγος').highlighted);
  assert.ok(allWords.find((word) => word.id === 'joh-1-1-1').active);
  assert.ok(allWords.every((word) => word.showParse));

  const quizWords = getPracticeWordDisplay(johnOneOne, {
    selectedPracticePart: 'verb',
    settings: {
      quizWordsOnly: true,
      highlightCurrentPart: true,
      showParse: false,
    },
  });

  assert.deepEqual([...new Set(quizWords.map((word) => word.partOfSpeech))].sort(), ['noun', 'verb']);
  assert.ok(quizWords.find((word) => word.form === 'ἦν').highlighted);
  assert.ok(quizWords.every((word) => !word.showParse));
});
