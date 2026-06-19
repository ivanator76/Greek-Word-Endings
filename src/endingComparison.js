import { getRuleSection } from './data/rules.js?v=20260518-random-info-hidden';
import { formatParseSummary } from './quizEngine.js';

const nounDeclensionSections = {
  first: 'noun-first',
  second: 'noun-second',
  third: 'noun-third',
};

const indicativeTenseSections = {
  present: 'verb-present',
  imperfect: 'verb-imperfect',
  future: 'verb-future',
  aorist: 'verb-aorist',
  perfect: 'verb-perfect',
  pluperfect: 'verb-pluperfect',
};

const notes = {
  noun: '同一變化表中的詞尾常彼此相近；先用格、性、數定位，再回到經文看句法角色。',
  verb: '同一語氣與時態的人稱詞尾放在一起比較；注意時態記號、augment，以及人稱與數。',
  participle: '分詞同時帶有動詞的時態語態，也像形容詞一樣標出格、性、數。',
};

function hasAnyEnding(value, endings) {
  return endings.some((ending) => String(value ?? '').endsWith(ending));
}

function inferNounSectionId(prompt) {
  if (prompt.parse.declension) {
    return nounDeclensionSections[prompt.parse.declension] ?? 'noun-second';
  }

  const tag = String(prompt.tag ?? '');
  const lemma = prompt.lemma ?? '';
  const form = prompt.form ?? prompt.surface ?? '';

  if (
    tag.startsWith('N') &&
    prompt.parse.gender === 'feminine' &&
    (
      hasAnyEnding(lemma, ['α', 'η']) ||
      hasAnyEnding(lemma, ['ά', 'ή']) ||
      hasAnyEnding(form, ['ᾳ', 'ῃ', 'ᾷ', 'ῇ', 'αν', 'ην', 'άν', 'ήν', 'ας', 'ης', 'άς', 'ής', 'αι', 'αί', 'αις', 'αῖς'])
    )
  ) {
    return 'noun-first';
  }

  return 'noun-second';
}

function sectionIdForPrompt(prompt) {
  if (prompt.partOfSpeech === 'participle') return 'participle';

  if (prompt.partOfSpeech === 'noun') {
    return inferNounSectionId(prompt);
  }

  if (prompt.partOfSpeech === 'verb') {
    if (prompt.parse.mood === 'subjunctive') return 'subjunctive';
    if (prompt.parse.mood === 'imperative') return 'imperative';
    return indicativeTenseSections[prompt.parse.tense] ?? 'verb-present';
  }

  return 'participle';
}

function tagParts(tag) {
  return String(tag)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function ruleMatchesPrompt(rule, prompt) {
  if (tagParts(rule.tag).includes(prompt.tag)) return true;

  const endingVariants = String(rule.ending)
    .split('/')
    .map((ending) => ending.trim());

  return endingVariants.includes(prompt.ending) || rule.ending === prompt.ending;
}

function markerForPrompt(prompt, section) {
  if (prompt.partOfSpeech === 'verb' && prompt.parse.tense === 'aorist' && prompt.parse.voice === 'passive') {
    return 'θη';
  }

  return section.marker;
}

export function buildEndingComparison(prompt) {
  const sectionId = sectionIdForPrompt(prompt);
  const section = getRuleSection(sectionId);
  const titleByPart = {
    noun: '名詞詞尾對照',
    verb: '動詞詞尾對照',
    participle: '分詞詞尾對照',
  };
  const title = titleByPart[prompt.partOfSpeech] ?? '詞尾對照';

  const rows = section.rows.map((row) => ({
    ...row,
    active: ruleMatchesPrompt(row, prompt),
  }));

  if (!rows.some((row) => row.active)) {
    rows.unshift({
      ending: prompt.ending,
      parse: formatParseSummary(prompt),
      tag: prompt.tag,
      examples: prompt.form,
      note: '目前題目的詞尾；完整規則表尚未收錄這一列。',
      active: true,
      current: true,
    });
  }

  return {
    sectionId,
    title,
    subtitle: section.title,
    marker: markerForPrompt(prompt, section),
    note: notes[prompt.partOfSpeech] ?? '把目前詞尾放回同一組規則中比較，可以更快看出容易混淆的位置。',
    rows,
  };
}
