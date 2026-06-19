import { ruleSections } from './data/rules.js';

function tagParts(tag) {
  return String(tag ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchingRuleEndings(tag) {
  return ruleSections
    .flatMap((section) => section.rows)
    .filter((row) => tagParts(row.tag).includes(tag))
    .flatMap((row) => String(row.ending).split('/'))
    .map((ending) => ending.trim())
    .filter((ending) => ending.startsWith('-'))
    .sort((a, b) => b.length - a.length);
}

function allRuleEndings() {
  return ruleSections
    .flatMap((section) => section.rows)
    .flatMap((row) => String(row.ending).split('/'))
    .map((ending) => ending.trim())
    .filter((ending) => ending.startsWith('-') && !ending.includes('...') && !ending.includes('∅'))
    .sort((a, b) => b.length - a.length);
}

function tagFamily(tag) {
  if (String(tag).startsWith('N')) return 'N';
  if (String(tag).startsWith('D')) return 'D';
  if (String(tag).startsWith('AJ')) return 'AJ';
  if (String(tag).startsWith('V')) return 'V';
  return '';
}

function rowFamily(tag) {
  if (String(tag).startsWith('AJ')) return 'AJ';
  return String(tag).slice(0, 1);
}

function familyRuleEndings(tag) {
  const family = tagFamily(tag);
  if (!family) return [];

  return ruleSections
    .flatMap((section) => section.rows)
    .filter((row) => rowFamily(row.tag) === family)
    .flatMap((row) => String(row.ending).split('/'))
    .map((ending) => ending.trim())
    .filter((ending) => ending.startsWith('-') && !ending.includes('...') && !ending.includes('∅'))
    .sort((a, b) => stripEndingMarker(b).length - stripEndingMarker(a).length);
}

function stripEndingMarker(ending) {
  return ending.replace(/^-/, '');
}

function withoutGreekAccent(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u0304\u0306-\u0344]/gu, '')
    .normalize('NFC');
}

function endsWithGreekEnding(form, ending) {
  return withoutGreekAccent(form).endsWith(withoutGreekAccent(ending));
}

function inferSplitFromEndings(form, endings) {
  const ending = endings.find((candidate) => endsWithGreekEnding(form, stripEndingMarker(candidate)));
  if (!ending) return null;

  const endingText = stripEndingMarker(ending);
  return {
    stem: form.slice(0, form.length - endingText.length),
    ending,
  };
}

function inferSplitFromRules(form, tag) {
  return inferSplitFromEndings(form, matchingRuleEndings(tag));
}

function inferSplitFromAnyRule(form) {
  return inferSplitFromEndings(form, allRuleEndings());
}

function inferSplitFromBestRule(form, tag) {
  return inferSplitFromEndings(
    form,
    [...new Set([...matchingRuleEndings(tag), ...familyRuleEndings(tag)])]
      .sort((a, b) => stripEndingMarker(b).length - stripEndingMarker(a).length),
  );
}

function hasParseableEndingRule(tag) {
  return matchingRuleEndings(tag).length > 0;
}

function visibleLength(value) {
  return [...String(value ?? '')].length;
}

function isSuspiciousImportedSplit(form, stem, ending) {
  const endingText = stripEndingMarker(ending);
  return (
    stem === form ||
    ending === form ||
    ending === `-${form}` ||
    (visibleLength(stem) <= 2 && visibleLength(endingText) >= 3) ||
    visibleLength(endingText) >= Math.max(4, visibleLength(form) - 1)
  );
}

function isUsableImportedSplit(form, stem, ending) {
  const endingText = stripEndingMarker(ending);
  return (
    ending.startsWith('-') &&
    !ending.includes('...') &&
    ending !== `-${form}` &&
    endsWithGreekEnding(form, endingText) &&
    visibleLength(stem) >= 2 &&
    visibleLength(endingText) >= 1 &&
    visibleLength(endingText) < visibleLength(form) - 1
  );
}

function isUnhelpfulRepairedSplit(word, split) {
  return (
    visibleLength(split.stem) <= 1 &&
    visibleLength(stripEndingMarker(split.ending)) >= 3
  );
}

export function formatWordSplit(word) {
  const form = word.form ?? '';
  const stem = word.stem ?? '';
  const ending = word.ending ?? '';
  const suspiciousImportedSplit = isSuspiciousImportedSplit(form, stem, ending);
  const usableImportedSplit = isUsableImportedSplit(form, stem, ending);

  const repairedSplit = inferSplitFromBestRule(form, word.tag);

  if (!suspiciousImportedSplit && usableImportedSplit) {
    return { stem, ending };
  }

  if (repairedSplit && !isUnhelpfulRepairedSplit(word, repairedSplit)) {
    return repairedSplit;
  }

  if (usableImportedSplit) {
    return { stem, ending };
  }

  if (!hasParseableEndingRule(word.tag)) {
    return { stem: form, ending: '∅' };
  }

  return { stem: form, ending: '∅' };
}
