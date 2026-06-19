import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFocusedReviewQuestion,
  buildQuestionInfoItems,
  buildQuizQuestion,
  buildRandomEndingQuestion,
  buildReviewQueue,
  formatParseSummary,
  NoAlternativeFormError,
  selectRandomForm,
} from '../src/quizEngine.js';
import { corpus } from '../src/data/corpus.js';
import { passages } from '../src/data/passages.js';
import { endingRules, getRuleSection, ruleGroups, ruleSections } from '../src/data/rules.js';
import { allScopeId, buildScopedCorpus, createScopeGroup } from '../src/quizScopes.js';

const sampleCorpus = [
  {
    id: 'heb-11-13-pepisteukotes',
    reference: '希伯來書 11:13',
    form: 'πεπιστευκότες',
    lemma: 'πιστεύω',
    gloss: '存著信心',
    partOfSpeech: 'participle',
    ending: '-κότες',
    stem: 'πεπιστευ-',
    parse: {
      tense: 'perfect',
      voice: 'active',
      case: 'nominative',
      gender: 'masculine',
      number: 'plural',
    },
    tag: 'VPRA-NMP',
    difficulty: 3,
  },
  {
    id: 'john-1-1-logou',
    reference: '約翰福音 1:1',
    form: 'λόγου',
    lemma: 'λόγος',
    gloss: '道',
    partOfSpeech: 'noun',
    ending: '-ου',
    stem: 'λόγ-',
    parse: {
      case: 'genitive',
      gender: 'masculine',
      number: 'singular',
      declension: 'second',
    },
    tag: 'N-GMS',
    difficulty: 1,
  },
  {
    id: 'matt-5-8-kardias',
    reference: '馬太福音 5:8',
    form: 'καρδίας',
    lemma: 'καρδία',
    gloss: '心',
    partOfSpeech: 'noun',
    ending: '-ας',
    stem: 'καρδί-',
    parse: {
      case: 'genitive',
      gender: 'feminine',
      number: 'singular',
      declension: 'first',
    },
    tag: 'N-GFS',
    difficulty: 1,
  },
  {
    id: 'john-3-16-pisteuon',
    reference: '約翰福音 3:16',
    form: 'πιστεύων',
    lemma: 'πιστεύω',
    gloss: '信的',
    partOfSpeech: 'participle',
    ending: '-ων',
    stem: 'πιστεύ-',
    parse: {
      tense: 'present',
      voice: 'active',
      case: 'nominative',
      gender: 'masculine',
      number: 'singular',
    },
    tag: 'VPPA-NMS',
    difficulty: 2,
  },
];

test('selectRandomForm filters corpus by part of speech and parse fields', () => {
  const result = selectRandomForm(sampleCorpus, {
    partOfSpeech: 'noun',
    parse: { case: 'genitive', number: 'singular' },
    seed: 7,
  });

  assert.equal(result.partOfSpeech, 'noun');
  assert.equal(result.parse.case, 'genitive');
  assert.equal(result.parse.number, 'singular');
});

test('selectRandomForm can exclude the current prompt when selecting the next word', () => {
  const result = selectRandomForm(sampleCorpus, {
    partOfSpeech: 'noun',
    excludeIds: ['john-1-1-logou'],
    seed: 1,
  });

  assert.equal(result.id, 'matt-5-8-kardias');
});

test('selectRandomForm can exclude the current visible form when selecting the next word', () => {
  const result = selectRandomForm(sampleCorpus, {
    partOfSpeech: 'noun',
    excludeForms: ['λόγου'],
    seed: 3,
  });

  assert.equal(result.form, 'καρδίας');
});

test('selectRandomForm can require an alternative instead of falling back to the same word', () => {
  assert.throws(
    () =>
      selectRandomForm(sampleCorpus, {
        partOfSpeech: 'participle',
        parse: { tense: 'perfect' },
        excludeIds: ['heb-11-13-pepisteukotes'],
        excludeForms: ['πεπιστευκότες'],
        requireAlternative: true,
        seed: 1,
      }),
    NoAlternativeFormError,
  );
});

test('buildQuizQuestion creates deterministic answer options with one correct tag', () => {
  const question = buildQuizQuestion(sampleCorpus, {
    partOfSpeech: 'participle',
    seed: 3,
  });

  assert.equal(question.prompt.form, 'πεπιστευκότες');
  assert.equal(question.correctAnswer, 'VPRA-NMP');
  assert.equal(question.options.length, 4);
  assert.equal(question.options.filter((option) => option === question.correctAnswer).length, 1);
  assert.ok(question.options.includes('VPPA-NMS'));
});

test('buildQuizQuestion varies the correct answer position across seeds', () => {
  const positions = new Set(
    Array.from({ length: 24 }, (_, index) => {
      const question = buildRandomEndingQuestion(sampleCorpus, {
        partOfSpeech: 'all',
        seed: index + 1,
      });
      return question.options.indexOf(question.correctAnswer);
    }),
  );

  assert.ok(positions.size >= 4);
});

test('buildRandomEndingQuestion can focus on one practice part', () => {
  const question = buildRandomEndingQuestion(sampleCorpus, {
    partOfSpeech: 'noun',
    seed: 1,
  });

  assert.equal(question.prompt.partOfSpeech, 'noun');
});

test('buildRandomEndingQuestion mixed mode only uses noun verb and participle forms', () => {
  const mixedCorpus = [
    ...sampleCorpus,
    {
      id: 'john-1-1-ho',
      reference: '約翰福音 1:1',
      form: 'ὁ',
      lemma: 'ὁ',
      gloss: '這',
      partOfSpeech: 'article',
      ending: 'ὁ',
      stem: '',
      parse: { case: 'nominative', gender: 'masculine', number: 'singular' },
      tag: 'DNMS',
      difficulty: 1,
    },
  ];

  const question = buildRandomEndingQuestion(mixedCorpus, {
    partOfSpeech: 'all',
    seed: 5,
  });

  assert.ok(['noun', 'verb', 'participle'].includes(question.prompt.partOfSpeech));
  assert.notEqual(question.prompt.partOfSpeech, 'article');
});

test('buildQuizQuestion avoids noun distractors that are also plausible from the visible ending', () => {
  const ambiguousNounCorpus = [
    {
      id: 'john-19-8-logon',
      reference: '約翰福音 19:8',
      form: 'λόγον',
      lemma: 'λόγος',
      gloss: '話',
      partOfSpeech: 'noun',
      ending: '-λόγον',
      stem: 'λόγ',
      parse: { case: 'accusative', gender: 'masculine', number: 'singular' },
      tag: 'NAMS',
      difficulty: 1,
    },
    {
      id: 'john-1-1-ergon',
      reference: '約翰福音 1:1',
      form: 'ἔργον',
      lemma: 'ἔργον',
      gloss: '工作',
      partOfSpeech: 'noun',
      ending: '-ον',
      stem: 'ἔργ',
      parse: { case: 'accusative', gender: 'neuter', number: 'singular' },
      tag: 'NANS',
      difficulty: 1,
    },
    {
      id: 'john-1-2-ergon',
      reference: '約翰福音 1:2',
      form: 'ἔργον',
      lemma: 'ἔργον',
      gloss: '工作',
      partOfSpeech: 'noun',
      ending: '-ον',
      stem: 'ἔργ',
      parse: { case: 'nominative', gender: 'neuter', number: 'singular' },
      tag: 'NNNS',
      difficulty: 1,
    },
    { ...sampleCorpus[1], id: 'distractor-ngms' },
    { ...sampleCorpus[2], id: 'distractor-ngfs' },
    { ...sampleCorpus[3], id: 'distractor-participle' },
  ];

  const question = buildQuizQuestion(ambiguousNounCorpus, {
    partOfSpeech: 'noun',
    parse: { case: 'accusative', gender: 'masculine', number: 'singular' },
    seed: 1,
  });

  assert.equal(question.correctAnswer, 'NAMS');
  assert.ok(question.options.includes('NAMS'));
  assert.equal(question.options.includes('NANS'), false);
  assert.equal(question.options.includes('NNNS'), false);
});

test('random quiz corpus agrees with passage tags for the same word occurrence', () => {
  const passageWord = passages
    .find((passage) => passage.reference === '約翰福音 13:34')
    .words.find((word) => word.form === 'ἀγαπᾶτε');
  const corpusWord = corpus.find((word) => word.id === passageWord.id);

  assert.equal(passageWord.tag, 'VSPA2P');
  assert.equal(corpusWord.tag, passageWord.tag);
  assert.equal(corpusWord.parse.mood, passageWord.parse.mood);
});

test('buildScopedCorpus limits random quiz words to selected passage groups', () => {
  const groups = [
    { id: 'lesson-a', name: '第一課 A', references: ['約翰福音 13:34', '約翰福音 15:12'] },
    { id: 'lesson-b', name: '第一課 B', references: ['羅馬書 5:1'] },
  ];

  const johnScope = buildScopedCorpus(corpus, groups, ['lesson-a']);
  assert.ok(johnScope.length > 0);
  assert.deepEqual([...new Set(johnScope.map((word) => word.reference))].sort(), ['約翰福音 13:34', '約翰福音 15:12']);
  assert.ok(johnScope.some((word) => word.reference === '約翰福音 13:34' && word.form === 'ἀγαπᾶτε' && word.tag === 'VSPA2P'));

  const combinedScope = buildScopedCorpus(corpus, groups, ['lesson-a', 'lesson-b']);
  assert.ok(combinedScope.some((word) => word.reference === '約翰福音 13:34'));
  assert.ok(combinedScope.some((word) => word.reference === '羅馬書 5:1'));

  assert.equal(buildScopedCorpus(corpus, groups, [allScopeId]).length, corpus.length);
});

test('createScopeGroup removes duplicate references and supplies a usable name', () => {
  const group = createScopeGroup('', ['約翰福音 13:34', '約翰福音 13:34', '羅馬書 5:1'], [
    { id: 'existing', name: 'Existing', references: [] },
  ]);

  assert.equal(group.name, '經文組 2');
  assert.deepEqual(group.references, ['約翰福音 13:34', '羅馬書 5:1']);
});

test('buildQuestionInfoItems hides answer-bearing details until the question is checked', () => {
  const question = buildRandomEndingQuestion(sampleCorpus, {
    partOfSpeech: 'noun',
    seed: 7,
  });

  const hiddenItems = buildQuestionInfoItems(question, false);
  assert.deepEqual(hiddenItems.map((item) => item.label), ['詞類', '中文翻譯', '例字來源']);
  assert.equal(hiddenItems.some((item) => item.value === question.correctAnswer), false);
  assert.equal(hiddenItems.some((item) => item.value === question.prompt.ending), false);
  assert.equal(hiddenItems.find((item) => item.label === '中文翻譯').value, '道');

  const revealedItems = buildQuestionInfoItems(question, true);
  assert.deepEqual(revealedItems.map((item) => item.label), ['詞類', '中文翻譯', '例字來源', '詞尾', '常見標籤', '解析']);
  assert.equal(revealedItems.some((item) => item.value === question.correctAnswer), true);
});

test('buildQuestionInfoItems uses local Chinese lexical glosses instead of Greek lemmas', () => {
  const question = buildQuizQuestion(corpus, {
    partOfSpeech: 'participle',
    parse: { tense: 'perfect', case: 'genitive', gender: 'neuter', number: 'plural' },
    seed: 1,
  });

  question.prompt = corpus.find((form) => form.id === 'lu-24-14-9');
  const glossItem = buildQuestionInfoItems(question, false).find((item) => item.label === '中文翻譯');

  assert.equal(question.prompt.gloss, 'συμβαίνω');
  assert.equal(glossItem.value, '發生、臨到');
});

test('formatParseSummary presents noun and verb-family parses for learners', () => {
  assert.equal(formatParseSummary(sampleCorpus[1]), '屬格 / 陽性 / 單數 / 第二變化');
  assert.equal(formatParseSummary(sampleCorpus[0]), '完成式 / 主動 / 主格 / 陽性 / 複數');
});

test('buildReviewQueue prioritizes weak endings by accuracy and due count', () => {
  const attempts = [
    { ending: '-ου', correct: false },
    { ending: '-ου', correct: true },
    { ending: '-κότες', correct: false },
    { ending: '-κότες', correct: false },
    { ending: '-ων', correct: true },
  ];

  const queue = buildReviewQueue(sampleCorpus, attempts);

  assert.equal(queue[0].ending, '-κότες');
  assert.equal(queue[0].missed, 2);
  assert.equal(queue[1].ending, '-ου');
});

test('buildReviewQueue lowers priority after focused review streaks', () => {
  const attempts = [
    { ending: '-ου', correct: false },
    { ending: '-κότες', correct: false },
  ];

  const queue = buildReviewQueue(sampleCorpus, attempts, { '-ου': 3 });

  assert.equal(queue[0].ending, '-κότες');
  assert.equal(queue.find((item) => item.ending === '-ου').streak, 3);
});

test('buildFocusedReviewQuestion creates a quiz limited to one weak ending', () => {
  const question = buildFocusedReviewQuestion(sampleCorpus, '-ου', 4);

  assert.equal(question.prompt.ending, '-ου');
  assert.equal(question.prompt.form, 'λόγου');
  assert.equal(question.correctAnswer, 'N-GMS');
});

test('second declension rules follow paradigm order and merge masculine/neuter rows', () => {
  assert.deepEqual(
    endingRules.map((rule) => rule.ending),
    ['-ος/-ον', '-ου', '-ῳ', '-ον', '-οι/-α', '-ων', '-οις', '-ους/-α'],
  );
  assert.deepEqual(
    endingRules.map((rule) => rule.tag),
    [
      'NNMS/NNNS',
      'NGMS/NGNS',
      'NDMS/NDNS',
      'NAMS/NANS',
      'NNMP/NNNP',
      'NGMP/NGNP',
      'NDMP/NDNP',
      'NAMP/NANP',
    ],
  );
});

test('verb and participle tags use mood or form before tense and voice', () => {
  const tagFor = (reference, form) => corpus.find((entry) => entry.reference === reference && entry.form === form)?.tag;

  assert.equal(tagFor('約翰福音 14:15', 'τηρήσετε'), 'VIFA2P');
  assert.equal(tagFor('約翰福音 13:34', 'ἀγαπᾶτε'), 'VSPA2P');
  assert.equal(tagFor('約翰福音 3:16', 'πιστεύων'), 'VPPA-NMS');
  assert.equal(tagFor('羅馬書 5:1', 'ἔχωμεν'), 'VSPA1P');
  assert.equal(tagFor('約翰一書 3:9', 'δύναται'), 'VIPM3S');

  const verbFamilyTags = corpus
    .filter((form) => form.partOfSpeech === 'verb' || form.partOfSpeech === 'participle')
    .map((form) => form.tag);

  assert.deepEqual(
    verbFamilyTags.filter((tag) => /^V-[APRFI][AMPISN]-/.test(tag) || /^V-[APRFI][AMPISN]/.test(tag) || /^V[ISOMNP][PIFARL]N/.test(tag)),
    [],
  );
});

test('rules table shows only endings and parse summary in the center pane', () => {
  const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const rulesViewSource = mainSource.slice(mainSource.indexOf('function rulesView()'), mainSource.indexOf('function reviewView()'));

  assert.match(rulesViewSource, /<th>字尾<\/th><th>格性數<\/th>/);
  assert.doesNotMatch(rulesViewSource, /<th>解析標籤<\/th>/);
  assert.doesNotMatch(rulesViewSource, /<th>新約例字<\/th>/);
  assert.doesNotMatch(rulesViewSource, /tag-cell/);
  assert.doesNotMatch(rulesViewSource, /examples-cell/);
});

test('paradigm table displays compact row labels instead of long Chinese grammar labels', () => {
  const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainSource, /'主格單數': 'NS'/);
  assert.match(mainSource, /shortMatrixLabel\(row\.label\)/);
});

test('noun overview includes second first and third declensions in compact column order', () => {
  const section = getRuleSection('noun-overview');

  assert.deepEqual(section.matrix.columns, ['2M', '1F', '2N', '3M', '3N']);
  assert.equal(section.matrix.rows[0].cells[0].tag, 'NNMS');
  assert.equal(section.matrix.rows[0].cells[1].tag, 'NNFS');
  assert.equal(section.matrix.rows[0].cells[2].tag, 'NNNS');
  assert.equal(section.matrix.rows[0].cells[3].tag, 'NNMS');
  assert.equal(section.matrix.rows[0].cells[4].tag, 'NNNS');
  assert.equal(section.matrix.rows[7].cells[3].tag, 'NAMP');
  assert.equal(section.matrix.rows[7].cells[4].tag, 'NANP');
});

test('indicative verb overview pages exist for each tense with plural rows below singular rows', () => {
  const expectedRows = ['1S', '2S', '3S', '1P', '2P', '3P'];

  [
    ['verb-present-overview', ['A', 'M/P']],
    ['verb-imperfect-overview', ['A', 'M/P']],
    ['verb-future-overview', ['A', 'M', 'P']],
    ['verb-aorist-overview', ['A', 'M', 'P']],
    ['verb-perfect-overview', ['A', 'M/P']],
    ['verb-pluperfect-overview', ['A', 'M/P']],
  ].forEach(([sectionId, columns]) => {
    const section = getRuleSection(sectionId);

    assert.deepEqual(section.matrix.columns, columns);
    assert.deepEqual(section.matrix.rows.map((row) => row.label), expectedRows);
  });

  assert.equal(getRuleSection('verb-aorist-overview').matrix.rows[3].label, '1P');
  assert.equal(getRuleSection('verb-aorist-overview').matrix.rows[3].cells[0].tag, 'VIAA1P');
});

test('participle overview puts plural forms below singular forms', () => {
  const section = getRuleSection('participle-overview');

  assert.deepEqual(section.matrix.rows.map((row) => row.label), ['NMS', 'NFS', 'NNS', 'NMP', 'NFP', 'NNP']);
  assert.equal(section.matrix.rows[2].cells[0].tag, 'VPPA-NNS');
  assert.equal(section.matrix.rows[3].cells[0].tag, 'VPPA-NMP');
  assert.equal(section.matrix.rows[5].cells[6].ending, '-μένα');
});

test('subjunctive overview uses vertical person-number rows to prevent crowding', () => {
  const section = getRuleSection('subjunctive-overview');

  assert.deepEqual(section.matrix.columns, ['A', 'Pres M/P', 'Aor M', 'Aor P']);
  assert.deepEqual(section.matrix.rows.map((row) => row.label), ['1S', '2S', '3S', '1P', '2P', '3P']);
  assert.equal(section.matrix.rows[0].cells[0].tag, 'VSPA1S/VSAA1S');
  assert.equal(section.matrix.rows[0].cells[1].tag, 'VSPM1S/VSPP1S');
  assert.equal(section.matrix.rows[0].cells[2].tag, 'VSAM1S');
  assert.equal(section.matrix.rows[0].cells[3].tag, 'VSAP1S');
});

test('every rule navigation item has a selectable rule section with rows', () => {
  const navKeys = ruleGroups.flatMap((group) => group.items.map((item) => item.id));
  const sectionKeys = ruleSections.map((section) => section.id);

  assert.deepEqual(navKeys.sort(), sectionKeys.sort());

  for (const key of navKeys) {
    const section = getRuleSection(key);
    assert.ok(section.title);
    assert.ok(section.subtitle);
    assert.ok(section.rows.length > 0);
    assert.ok(section.rows.every((row) => row.ending && row.parse && row.tag && row.examples));
  }
});

test('rule table does not truncate endings with ellipsis', () => {
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(styles, /text-overflow:\s*ellipsis/);
});

test('verb tense sections expose tense markers for the detail pane', () => {
  assert.equal(getRuleSection('verb-aorist').marker, 'σα / θη');
  assert.equal(getRuleSection('verb-future').marker, 'σ / θησ');
  assert.equal(getRuleSection('verb-perfect').marker, 'κ');
  assert.equal(getRuleSection('verb-pluperfect').marker, 'κ');
});

test('indicative verb rules include middle passive forms and split them when endings differ', () => {
  const presentRows = getRuleSection('verb-present').rows;
  const futureRows = getRuleSection('verb-future').rows;
  const aoristRows = getRuleSection('verb-aorist').rows;
  const perfectRows = getRuleSection('verb-perfect').rows;
  const pluperfectRows = getRuleSection('verb-pluperfect').rows;

  assert.ok(presentRows.some((row) => row.tag === 'VIPM1S/VIPP1S' && row.ending === '-ομαι'));
  assert.ok(presentRows.every((row) => row.parse !== '直說 / 現在 / 被動 / 1單'));
  assert.ok(perfectRows.some((row) => row.tag === 'VIRM1S/VIRP1S' && row.ending === '-μαι'));
  assert.ok(pluperfectRows.some((row) => row.tag === 'VILM1S/VILP1S' && row.ending === 'ἐ-...-μην'));

  assert.ok(futureRows.some((row) => row.tag === 'VIFM1S' && row.ending === '-σομαι'));
  assert.ok(futureRows.some((row) => row.tag === 'VIFP1S' && row.ending === '-θήσομαι'));
  assert.ok(aoristRows.some((row) => row.tag === 'VIAM1S' && row.ending === 'ἐ-...-σάμην'));
  assert.ok(aoristRows.some((row) => row.tag === 'VIAP1S' && row.ending === 'ἐ-...-θην'));
});

test('verbals and non-indicative moods include middle passive forms where applicable', () => {
  const participleRows = getRuleSection('participle').rows;
  const infinitiveRows = getRuleSection('infinitive').rows;
  const subjunctiveRows = getRuleSection('subjunctive').rows;
  const imperativeRows = getRuleSection('imperative').rows;

  assert.ok(participleRows.some((row) => row.ending === '-όμενος/-ομένη/-όμενον' && row.tag.includes('VPPP')));
  assert.ok(participleRows.some((row) => row.ending === '-σάμενος/-σαμένη/-σάμενον' && row.tag.includes('VPAM')));
  assert.ok(participleRows.some((row) => row.ending === '-μένος/-μένη/-μένον' && row.tag.includes('VPRP')));

  assert.ok(infinitiveRows.some((row) => row.ending === '-εσθαι' && row.tag === 'VNPM/VNPP'));
  assert.ok(infinitiveRows.some((row) => row.ending === '-σασθαι' && row.tag === 'VNAM'));
  assert.ok(infinitiveRows.some((row) => row.ending === '-θῆναι' && row.tag === 'VNAP'));

  assert.ok(subjunctiveRows.some((row) => row.ending === '-ωμαι' && row.tag === 'VSPM1S/VSPP1S'));
  assert.ok(subjunctiveRows.some((row) => row.ending === '-σωμαι' && row.tag === 'VSAM1S'));
  assert.ok(subjunctiveRows.some((row) => row.ending === '-θῶ' && row.tag === 'VSAP1S'));

  assert.ok(imperativeRows.some((row) => row.ending === '-ου' && row.tag === 'VMPM2S/VMPP2S'));
  assert.ok(imperativeRows.some((row) => row.ending === '-σαι' && row.tag === 'VMAM2S'));
  assert.ok(imperativeRows.some((row) => row.ending === '-θητι' && row.tag === 'VMAP2S'));
});

test('article rule tags use D instead of T', () => {
  const articleTags = ruleSections
    .filter((section) => section.groupId === 'article')
    .flatMap((section) => section.rows.map((row) => row.tag));

  assert.ok(articleTags.length > 0);
  assert.ok(articleTags.every((tag) => tag.split('/').every((part) => part.startsWith('D'))));
  assert.equal(getRuleSection('article-masculine').rows[0].tag, 'DNMS');
});

test('neuter article rules split nominative and accusative rows in paradigm order', () => {
  const rows = getRuleSection('article-neuter').rows;

  assert.deepEqual(
    rows.map((row) => row.parse),
    [
      '主格 / 中性 / 單數',
      '屬格 / 中性 / 單數',
      '間接受格 / 中性 / 單數',
      '受格 / 中性 / 單數',
      '主格 / 中性 / 複數',
      '屬格 / 中性 / 複數',
      '間接受格 / 中性 / 複數',
      '受格 / 中性 / 複數',
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.tag),
    ['DNNS', 'DGNS', 'DDNS', 'DANS', 'DNNP', 'DGNP', 'DDNP', 'DANP'],
  );
});

test('article overview rule presents masculine feminine and neuter in one paradigm table', () => {
  const section = getRuleSection('article-overview');

  assert.deepEqual(section.matrix.columns, ['陽性', '陰性', '中性']);
  assert.deepEqual(
    section.matrix.rows.map((row) => row.label),
    ['主格單數', '屬格單數', '間接受格單數', '受格單數', '主格複數', '屬格複數', '間接受格複數', '受格複數'],
  );
  assert.equal(section.matrix.rows[0].cells[0].ending, 'ὁ');
  assert.equal(section.matrix.rows[0].cells[1].ending, 'ἡ');
  assert.equal(section.matrix.rows[0].cells[2].ending, 'τό');
  assert.equal(section.matrix.rows[7].cells[2].tag, 'DANP');
});

test('rule library includes overview paradigm pages for major suitable categories', () => {
  const navKeys = ruleGroups.flatMap((group) => group.items.map((item) => item.id));

  [
    'noun-overview',
    'verb-present-overview',
    'adjective-overview',
    'article-overview',
    'participle-overview',
    'infinitive-overview',
    'subjunctive-overview',
    'imperative-overview',
  ].forEach((sectionId) => {
    assert.ok(navKeys.includes(sectionId));
    assert.ok(getRuleSection(sectionId).matrix);
  });
});
