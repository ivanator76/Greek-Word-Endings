import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEndingComparison } from '../src/endingComparison.js';
import { corpus } from '../src/data/corpus.js';
import { getPassage } from '../src/passageEngine.js';
import { passages } from '../src/data/passages.js';

test('ending comparison uses noun declension rules for noun prompts', () => {
  const johnOneOne = getPassage(passages, { book: '約翰福音', chapter: 1, verse: 1 });
  const prompt = johnOneOne.words.find((word) => word.form === 'λόγος');
  const comparison = buildEndingComparison(prompt);

  assert.equal(comparison.title, '名詞詞尾對照');
  assert.equal(comparison.sectionId, 'noun-second');
  assert.ok(comparison.rows.find((row) => row.ending === '-ος/-ον').active);
  assert.match(comparison.note, /同一變化/);
});

test('ending comparison infers first declension for feminine singular nouns without declension metadata', () => {
  const johnOneOne = getPassage(passages, { book: '約翰福音', chapter: 1, verse: 1 });
  const prompt = johnOneOne.words.find((word) => word.form === 'ἀρχῇ');
  const comparison = buildEndingComparison(prompt);

  assert.equal(prompt.tag, 'NDFS');
  assert.equal(comparison.sectionId, 'noun-first');
  assert.equal(comparison.subtitle, '名詞第一變化 -α / -η');
  assert.ok(comparison.rows.find((row) => row.tag === 'NDFS').active);
});

test('ending comparison uses mood-specific verb rules for verb prompts', () => {
  const prompt = corpus.find((word) => word.reference === '羅馬書 6:4' && word.form === 'περιπατήσωμεν');
  const comparison = buildEndingComparison(prompt);

  assert.equal(comparison.title, '動詞詞尾對照');
  assert.equal(comparison.sectionId, 'subjunctive');
  assert.ok(comparison.rows.find((row) => row.ending === '-ωμεν').active);
  assert.match(comparison.note, /人稱/);
});

test('ending comparison uses participle rules for participle prompts', () => {
  const prompt = corpus.find((word) => word.reference === '約翰福音 3:16' && word.form === 'πιστεύων');
  const comparison = buildEndingComparison(prompt);

  assert.equal(comparison.title, '分詞詞尾對照');
  assert.equal(comparison.sectionId, 'participle');
  assert.ok(comparison.rows.find((row) => row.tag.includes('VPPA-NMS')).active);
  assert.match(comparison.note, /格、性、數/);
});

test('ending comparison adds the current ending when a verb form is not covered by the rule section yet', () => {
  const prompt = {
    id: 'synthetic-aorist-passive-gap',
    form: 'ἐλύην',
    lemma: 'λύω',
    partOfSpeech: 'verb',
    tag: 'VIAP1S-GAP',
    ending: 'ἐ-...-ην',
    parse: {
      mood: 'indicative',
      tense: 'aorist',
      voice: 'passive',
      person: '1',
      number: 'singular',
    },
  };
  const comparison = buildEndingComparison(prompt);

  assert.equal(comparison.sectionId, 'verb-aorist');
  assert.equal(comparison.marker, 'θη');
  assert.ok(comparison.rows.find((row) => row.ending === prompt.ending && row.active && row.current));
});
