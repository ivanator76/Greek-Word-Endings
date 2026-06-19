const groupLabels = {
  nouns: '名詞',
  verbs: '動詞',
  adjectives: '形容詞',
  article: '定冠詞',
  verbals: '分詞 / 不定詞 / 語氣',
};

function splitEndingVariants(ending) {
  return ending
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('-') || part.includes('...') || /^[\u0370-\u03ff\u1f00-\u1fff]/u.test(part)) {
        return part;
      }
      return `-${part}`;
    });
}

function endingSort(a, b) {
  return b.sourceCount - a.sourceCount || a.ending.localeCompare(b.ending, 'el');
}

export function buildEndingMap(sections) {
  const entries = new Map();

  sections.forEach((section) => {
    section.rows.forEach((row) => {
      splitEndingVariants(row.ending).forEach((ending) => {
        if (!entries.has(ending)) {
          entries.set(ending, {
            ending,
            sourceCount: 0,
            groupIds: [],
            groupLabels: [],
            sources: [],
            examples: [],
          });
        }

        const entry = entries.get(ending);
        const source = {
          sectionId: section.id,
          sectionTitle: section.title,
          groupId: section.groupId,
          groupLabel: groupLabels[section.groupId] ?? section.groupId,
          originalEnding: row.ending,
          parse: row.parse,
          tag: row.tag,
          examples: row.examples,
          note: row.note,
          marker: section.marker,
        };

        entry.sources.push(source);
        entry.sourceCount = entry.sources.length;
        entry.groupIds = [...new Set([...entry.groupIds, section.groupId])];
        entry.groupLabels = entry.groupIds.map((groupId) => groupLabels[groupId] ?? groupId);
        entry.examples = [...new Set([...entry.examples, ...row.examples.split(',').map((example) => example.trim())])];
      });
    });
  });

  return [...entries.values()].sort(endingSort);
}

export function getEndingMapEntry(mapEntries, selectedEnding) {
  return mapEntries.find((entry) => entry.ending === selectedEnding) ?? mapEntries[0];
}

export function groupEndingMapEntries(mapEntries) {
  const groups = [
    { id: 'shared', label: '高混淆字尾', entries: mapEntries.filter((entry) => entry.sourceCount >= 3) },
    { id: 'nouns', label: '名詞 / 形容詞', entries: mapEntries.filter((entry) => entry.groupIds.includes('nouns') || entry.groupIds.includes('adjectives')) },
    { id: 'article', label: '定冠詞', entries: mapEntries.filter((entry) => entry.groupIds.includes('article')) },
    { id: 'verbs', label: '動詞', entries: mapEntries.filter((entry) => entry.groupIds.includes('verbs')) },
    { id: 'verbals', label: '分詞 / 不定詞 / 語氣', entries: mapEntries.filter((entry) => entry.groupIds.includes('verbals')) },
  ];

  return groups.map((group) => ({
    ...group,
    entries: group.entries.slice(0, 16),
  }));
}
