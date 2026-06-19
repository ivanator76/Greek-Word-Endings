import { endingRules } from './data/rules.js';
import { chineseGlossFor } from './data/chineseGlosses.js';

const labels = {
  nominative: '主格',
  genitive: '屬格',
  dative: '間接受格',
  accusative: '受格',
  vocative: '呼格',
  masculine: '陽性',
  feminine: '陰性',
  neuter: '中性',
  singular: '單數',
  plural: '複數',
  first: '第一變化',
  second: '第二變化',
  third: '第三變化',
  present: '現在式',
  imperfect: '未完成式',
  future: '未來式',
  aorist: '過去簡單式',
  perfect: '完成式',
  pluperfect: '過去完成式',
  active: '主動',
  middle: '關身',
  passive: '被動',
  indicative: '直說語氣',
  subjunctive: '假設語氣',
  imperative: '命令語氣',
  infinitive: '不定詞',
  participle: '分詞',
  firstPerson: '1 人稱',
  secondPerson: '2 人稱',
  thirdPerson: '3 人稱',
};

export const randomEndingParts = ['noun', 'verb', 'participle'];

function seededIndex(length, seed = Date.now()) {
  if (length === 0) return -1;
  const x = Math.sin(seed * 9999) * 10000;
  return Math.floor((x - Math.floor(x)) * length);
}

function matchesParse(form, parse = {}) {
  return Object.entries(parse).every(([key, value]) => form.parse[key] === value);
}

function matchingForms(corpus, filters = {}) {
  return corpus.filter((form) => {
    if (filters.partOfSpeech && form.partOfSpeech !== filters.partOfSpeech) return false;
    if (filters.ending && form.ending !== filters.ending) return false;
    if (filters.maxDifficulty && form.difficulty > filters.maxDifficulty) return false;
    if (filters.excludeIds?.includes(form.id)) return false;
    if (filters.excludeForms?.includes(form.form)) return false;
    return matchesParse(form, filters.parse);
  });
}

export class NoAlternativeFormError extends Error {
  constructor() {
    super('No alternative corpus forms match the selected filters.');
    this.name = 'NoAlternativeFormError';
  }
}

export function selectRandomForm(corpus, filters = {}) {
  let matches = matchingForms(corpus, filters);

  if (matches.length === 0 && (filters.excludeIds?.length || filters.excludeForms?.length)) {
    if (filters.requireAlternative) {
      throw new NoAlternativeFormError();
    }
    const { excludeIds: _excludeIds, excludeForms: _excludeForms, ...fallbackFilters } = filters;
    matches = matchingForms(corpus, fallbackFilters);
  }

  if (matches.length === 0) {
    throw new Error('No corpus forms match the selected filters.');
  }

  return matches[seededIndex(matches.length, filters.seed)];
}

function scoreDistractor(candidate, target) {
  let score = 0;
  if (candidate.partOfSpeech === target.partOfSpeech) score += 4;
  if (candidate.ending === target.ending) score += 3;
  if (candidate.parse.case && candidate.parse.case === target.parse.case) score += 2;
  if (candidate.parse.tense && candidate.parse.tense === target.parse.tense) score += 2;
  if (candidate.parse.number === target.parse.number) score += 1;
  return score;
}

function splitTagList(tag) {
  return String(tag)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitEndingList(ending) {
  return String(ending)
    .split('/')
    .map((part) => part.trim().replace(/^-/, ''))
    .filter(Boolean);
}

function plausibleTagsFromVisibleEnding(target) {
  if (target.partOfSpeech !== 'noun') return new Set();

  const form = target.form ?? target.surface ?? '';
  const tags = new Set();

  for (const rule of endingRules) {
    const endings = splitEndingList(rule.ending);
    if (endings.some((ending) => form.endsWith(ending))) {
      splitTagList(rule.tag).forEach((tag) => tags.add(tag));
    }
  }

  return tags;
}

export function buildQuizQuestion(corpus, filters = {}) {
  const target = selectRandomForm(corpus, filters);
  const plausibleVisibleTags = plausibleTagsFromVisibleEnding(target);
  const distractors = corpus
    .filter((form) => form.tag !== target.tag)
    .filter((form) => !plausibleVisibleTags.has(form.tag))
    .sort((a, b) => scoreDistractor(b, target) - scoreDistractor(a, target))
    .map((form) => form.tag);
  const options = [...new Set([target.tag, ...distractors])].slice(0, 4);

  return {
    id: `quiz-${target.id}`,
    prompt: target,
    correctAnswer: target.tag,
    options: shuffleWithSeed(options, filters.seed ?? 1),
    explanation: `${target.form} 的詞尾 ${target.ending} 在這裡標示為 ${formatParseSummary(target)}。`,
  };
}

export function buildRandomEndingQuestion(corpus, { partOfSpeech = 'all', seed } = {}) {
  const practiceCorpus = corpus.filter((form) => randomEndingParts.includes(form.partOfSpeech));

  return buildQuizQuestion(practiceCorpus, {
    partOfSpeech: partOfSpeech === 'all' ? undefined : partOfSpeech,
    seed,
  });
}

export function buildQuestionInfoItems(question, isChecked = false) {
  const baseItems = [
    { label: '詞類', value: question.prompt.partOfSpeech },
    { label: '中文翻譯', value: chineseGlossFor(question.prompt) || '尚未收錄中文詞義' },
    { label: '例字來源', value: question.prompt.reference },
  ];

  if (!isChecked) return baseItems;

  return [
    ...baseItems,
    { label: '詞尾', value: question.prompt.ending },
    { label: '常見標籤', value: question.prompt.tag },
    { label: '解析', value: formatParseSummary(question.prompt) },
  ];
}

function shuffleWithSeed(items, seed) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = Math.sin((seed + 1) * (index + 17) * 9999) * 10000;
    const random = value - Math.floor(value);
    const swapIndex = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function formatParseSummary(form) {
  const parse = form.parse;
  const nounParts = [parse.case, parse.gender, parse.number, parse.declension]
    .filter(Boolean)
    .map((part) => labels[part] ?? part);
  const verbParts = [parse.tense, parse.voice, parse.mood, parse.person, parse.case, parse.gender, parse.number]
    .filter(Boolean)
    .map((part) => labels[part] ?? part);

  return form.partOfSpeech === 'noun' || form.partOfSpeech === 'article' || form.partOfSpeech === 'adjective'
    ? nounParts.join(' / ')
    : verbParts.join(' / ');
}

export function buildFocusedReviewQuestion(corpus, ending, seed) {
  return buildQuizQuestion(corpus, { ending, seed });
}

export function buildReviewQueue(corpus, attempts, streaks = {}) {
  const stats = attempts.reduce((acc, attempt) => {
    acc[attempt.ending] ??= { ending: attempt.ending, total: 0, missed: 0 };
    acc[attempt.ending].total += 1;
    if (!attempt.correct) acc[attempt.ending].missed += 1;
    return acc;
  }, {});

  return Object.values(stats)
    .map((stat) => ({
      ...stat,
      correct: stat.total - stat.missed,
      accuracy: Math.round(((stat.total - stat.missed) / stat.total) * 100),
      streak: streaks[stat.ending] ?? 0,
      priority: Math.max(0, stat.missed * 2 - (streaks[stat.ending] ?? 0)),
      forms: corpus.filter((form) => form.ending === stat.ending),
    }))
    .sort((a, b) => b.priority - a.priority || b.missed - a.missed || a.accuracy - b.accuracy);
}

export const morphologyLabels = labels;
