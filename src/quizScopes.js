export const allScopeId = 'all';

export const defaultScopeGroups = [
  {
    id: 'lesson-john-love',
    name: '約翰：彼此相愛',
    references: ['約翰福音 13:34', '約翰福音 15:12', '約翰福音 15:17'],
  },
  {
    id: 'lesson-romans-life',
    name: '羅馬書：新生命',
    references: ['羅馬書 5:1', '羅馬書 6:4'],
  },
];

export function buildReferenceOptions(passages) {
  return passages.map((passage) => ({
    value: passage.reference,
    label: passage.reference,
    book: passage.book,
    chapter: passage.chapter,
    verse: passage.verse,
  }));
}

export function buildScopedCorpus(corpus, scopeGroups, selectedScopeIds = [allScopeId]) {
  if (!selectedScopeIds.length || selectedScopeIds.includes(allScopeId)) return corpus;

  const selectedReferences = new Set(
    scopeGroups
      .filter((group) => selectedScopeIds.includes(group.id))
      .flatMap((group) => group.references),
  );

  if (selectedReferences.size === 0) return corpus;

  return corpus.filter((form) => selectedReferences.has(form.reference));
}

export function scopeWordCount(corpus, scopeGroups, scopeId) {
  return buildScopedCorpus(corpus, scopeGroups, [scopeId]).filter((form) =>
    ['noun', 'verb', 'participle'].includes(form.partOfSpeech),
  ).length;
}

export function createScopeGroup(name, references, existingGroups = []) {
  const normalizedName = name.trim() || `經文組 ${existingGroups.length + 1}`;
  const uniqueReferences = [...new Set(references.filter(Boolean))];
  const slug = normalizedName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '');
  const suffix = existingGroups.length + 1;

  return {
    id: `scope-${Date.now()}-${slug || suffix}`,
    name: normalizedName,
    references: uniqueReferences,
  };
}
