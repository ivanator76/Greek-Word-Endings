import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWordSplit } from '../src/wordSplit.js';

test('formatWordSplit avoids duplicated full-form stem and ending for subjunctive verbs', () => {
  const split = formatWordSplit({
    form: 'ἔχῃ',
    stem: 'ἔχῃ',
    ending: 'ἔχῃ',
    tag: 'VSPA3S',
  });

  assert.deepEqual(split, { stem: 'ἔχ', ending: '-ῃ' });
});

test('formatWordSplit infers first-declension endings when imported data stores the full form twice', () => {
  const split = formatWordSplit({
    form: 'ἀρχῇ',
    stem: 'ἀρχῇ',
    ending: 'ἀρχῇ',
    tag: 'NDFS',
  });

  assert.deepEqual(split, { stem: 'ἀρχ', ending: '-ῃ' });
});

test('formatWordSplit uses zero ending when the imported ending is the whole form with a hyphen', () => {
  const split = formatWordSplit({
    form: 'φρέαρ',
    stem: 'φρέαρ',
    ending: '-φρέαρ',
    tag: 'NANS',
  });

  assert.deepEqual(split, { stem: 'φρέαρ', ending: '∅' });
});

test('formatWordSplit uses zero ending for proper names with no parseable ending rule', () => {
  const split = formatWordSplit({
    form: 'Δαυεὶδ',
    stem: 'Δ',
    ending: '-αυεὶδ',
    tag: 'NPIR',
  });

  assert.deepEqual(split, { stem: 'Δαυεὶδ', ending: '∅' });
});

test('formatWordSplit repairs one-letter hard splits by using known noun endings', () => {
  assert.deepEqual(
    formatWordSplit({
      form: 'Βίβλος',
      stem: 'Β',
      ending: '-ίβλος',
      tag: 'NNFS',
    }),
    { stem: 'Βίβλ', ending: '-ος' },
  );

  assert.deepEqual(
    formatWordSplit({
      form: 'Οὐρίου',
      stem: 'Ο',
      ending: '-ὐρίου',
      tag: 'NGMS',
    }),
    { stem: 'Οὐρί', ending: '-ου' },
  );

  assert.deepEqual(
    formatWordSplit({
      form: 'υἱὸν',
      stem: 'υ',
      ending: '-ἱὸν',
      tag: 'NAMS',
    }),
    { stem: 'υἱ', ending: '-ον' },
  );
});

test('formatWordSplit repairs imported endings that include part of the stem', () => {
  assert.deepEqual(
    formatWordSplit({
      form: 'βιβλίου',
      stem: 'βι',
      ending: '-βλίου',
      tag: 'NGNS',
    }),
    { stem: 'βιβλί', ending: '-ου' },
  );

  assert.deepEqual(
    formatWordSplit({
      form: 'λόγων',
      stem: 'λόγων',
      ending: '-λόγων',
      tag: 'NGMP',
    }),
    { stem: 'λόγ', ending: '-ων' },
  );
});

test('formatWordSplit keeps useful imported splits when the exact tag is not in the rule table yet', () => {
  assert.deepEqual(
    formatWordSplit({
      form: 'συμβεβηκότων',
      stem: 'συμβεβη',
      ending: '-κότων',
      tag: 'VPRA-GNP',
    }),
    { stem: 'συμβεβη', ending: '-κότων' },
  );
});

test('formatWordSplit avoids unhelpful very short stems after repair', () => {
  assert.deepEqual(
    formatWordSplit({
      form: 'παῖς',
      stem: 'π',
      ending: '-αῖς',
      tag: 'NNMS',
    }),
    { stem: 'παῖς', ending: '∅' },
  );

  assert.deepEqual(
    formatWordSplit({
      form: 'οὖς',
      stem: '',
      ending: '-οὖς',
      tag: 'NANS',
    }),
    { stem: 'οὖς', ending: '∅' },
  );

  assert.deepEqual(
    formatWordSplit({
      form: 'ὄντος',
      stem: 'ὄντος',
      ending: 'ὄντος',
      tag: 'VPPA-GMS',
    }),
    { stem: 'ὄντος', ending: '∅' },
  );

  assert.deepEqual(
    formatWordSplit({
      form: 'δῶμεν',
      stem: 'δ',
      ending: '-ῶμεν',
      tag: 'VSAA1P',
    }),
    { stem: 'δῶμεν', ending: '∅' },
  );
});

test('formatWordSplit keeps existing clean splits unchanged', () => {
  const split = formatWordSplit({
    form: 'πεπιστευκότες',
    stem: 'πεπιστευ-',
    ending: '-κότες',
    tag: 'VPRA-NMP',
  });

  assert.deepEqual(split, { stem: 'πεπιστευ-', ending: '-κότες' });
});
