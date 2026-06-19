import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEndingMap, getEndingMapEntry } from '../src/endingMap.js';
import { ruleSections } from '../src/data/rules.js';

test('buildEndingMap creates a reverse index from ending variants to rule rows', () => {
  const map = buildEndingMap(ruleSections);
  const ou = getEndingMapEntry(map, '-ου');

  assert.equal(ou.ending, '-ου');
  assert.ok(ou.sources.some((source) => source.sectionId === 'noun-second' && source.tag === 'NGMS/NGNS'));
  assert.ok(ou.sources.some((source) => source.sectionId === 'adjective-two' && source.tag === 'AJGMS/AJGFS/AJGNS'));
});

test('buildEndingMap classifies endings by the rule groups they appear in', () => {
  const map = buildEndingMap(ruleSections);
  const on = getEndingMapEntry(map, '-ον');

  assert.ok(on.groupIds.includes('nouns'));
  assert.ok(on.groupIds.includes('adjectives'));
  assert.ok(on.sourceCount > 1);
});

test('getEndingMapEntry returns the most connected ending when no selection is available', () => {
  const map = buildEndingMap(ruleSections);
  const entry = getEndingMapEntry(map, '-missing');

  assert.ok(entry.ending);
  assert.ok(entry.sourceCount >= 1);
});
