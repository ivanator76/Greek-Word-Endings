import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceDir = new URL('../src/data/tisch-morph/', import.meta.url);
const outFile = new URL('../src/data/generatedPassages.js', import.meta.url);
const cuvDir = '/Users/ivansu/bible-theology-notebook/backend/src/bible-data/cuv';

const books = [
  ['MT', '馬太福音', 'mat'],
  ['MR', '馬可福音', 'mrk'],
  ['LU', '路加福音', 'luk'],
  ['JOH', '約翰福音', 'jhn'],
  ['AC', '使徒行傳', 'act'],
  ['RO', '羅馬書', 'rom'],
  ['1CO', '哥林多前書', '1co'],
  ['2CO', '哥林多後書', '2co'],
  ['GA', '加拉太書', 'gal'],
  ['EPH', '以弗所書', 'eph'],
  ['PHP', '腓立比書', 'php'],
  ['COL', '歌羅西書', 'col'],
  ['1TH', '帖撒羅尼迦前書', '1th'],
  ['2TH', '帖撒羅尼迦後書', '2th'],
  ['1TI', '提摩太前書', '1ti'],
  ['2TI', '提摩太後書', '2ti'],
  ['TIT', '提多書', 'tit'],
  ['PHM', '腓利門書', 'phm'],
  ['HEB', '希伯來書', 'heb'],
  ['JAS', '雅各書', 'jas'],
  ['1PE', '彼得前書', '1pe'],
  ['2PE', '彼得後書', '2pe'],
  ['1JO', '約翰一書', '1jn'],
  ['2JO', '約翰二書', '2jn'],
  ['3JO', '約翰三書', '3jn'],
  ['JUDE', '猶大書', 'jud'],
  ['RE', '啟示錄', 'rev'],
];

const caseLabels = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const genderLabels = { M: 'masculine', F: 'feminine', N: 'neuter' };
const numberLabels = { S: 'singular', P: 'plural' };
const tenseLabels = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect' };
const voiceLabels = { A: 'active', M: 'middle', P: 'passive', E: 'middle', D: 'middle', O: 'passive', N: 'middle' };
const displayVoiceCodes = { E: 'M', D: 'M', O: 'P', N: 'M' };
const moodLabels = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle' };

function cleanForm(form) {
  return form.replace(/[.,;··!?]+$/u, '');
}

function verseText(words) {
  return words
    .map((word) => word.surface)
    .join(' ')
    .replace(/\s+([,.;··!?])/gu, '$1');
}

function loadCuvBook(bookCode) {
  return JSON.parse(readFileSync(join(cuvDir, `${bookCode}.json`), 'utf8'));
}

function cuvVerseText(cuvBook, chapter, verse) {
  return cuvBook[String(chapter)]?.find((item) => item.verse === verse)?.text;
}

function convertCaseNumberGender(code = '') {
  const [caseCode, numberCode, genderCode] = code;
  if (!caseCode || !numberCode || !genderCode) return code;
  return `${caseCode}${genderCode}${numberCode}`;
}

function parseNominal(code = '') {
  const [caseCode, numberCode, genderCode] = code;
  return {
    ...(caseLabels[caseCode] ? { case: caseLabels[caseCode] } : {}),
    ...(genderLabels[genderCode] ? { gender: genderLabels[genderCode] } : {}),
    ...(numberLabels[numberCode] ? { number: numberLabels[numberCode] } : {}),
  };
}

function parseMorph(morph) {
  if (morph.startsWith('V-')) return parseVerbMorph(morph);

  const [posCode, nominalCode = ''] = morph.split('-');
  if (posCode === 'N') {
    return { partOfSpeech: 'noun', tag: `N${convertCaseNumberGender(nominalCode)}`, parse: parseNominal(nominalCode) };
  }
  if (posCode === 'T') {
    return { partOfSpeech: 'article', tag: `D${convertCaseNumberGender(nominalCode)}`, parse: parseNominal(nominalCode) };
  }
  if (posCode === 'A') {
    return { partOfSpeech: 'adjective', tag: `AJ${convertCaseNumberGender(nominalCode)}`, parse: parseNominal(nominalCode) };
  }
  if (posCode === 'P') {
    return { partOfSpeech: 'pronoun', tag: `P${convertCaseNumberGender(nominalCode)}`, parse: parseNominal(nominalCode) };
  }

  const otherMap = {
    ADV: 'adverb',
    CONJ: 'conjunction',
    COND: 'conjunction',
    PREP: 'preposition',
    PRT: 'particle',
    INJ: 'interjection',
    HEB: 'proper',
    ARAM: 'proper',
  };

  return { partOfSpeech: otherMap[posCode] ?? 'other', tag: morph.replaceAll('-', ''), parse: {} };
}

function parseVerbMorph(morph) {
  const [, verbCode = '', tail = ''] = morph.split('-');
  const normalizedVerbCode = verbCode.replace(/^2/, '');
  const [tenseCode, voiceCode, moodCode] = normalizedVerbCode;
  const displayVoiceCode = displayVoiceCodes[voiceCode] ?? voiceCode;
  const parse = {
    ...(tenseLabels[tenseCode] ? { tense: tenseLabels[tenseCode] } : {}),
    ...(voiceLabels[voiceCode] ? { voice: voiceLabels[voiceCode] } : {}),
    ...(moodLabels[moodCode] ? { mood: moodLabels[moodCode] } : {}),
  };

  if (moodCode === 'P') {
    Object.assign(parse, parseNominal(tail));
    return {
      partOfSpeech: 'participle',
      tag: `VP${tenseCode}${displayVoiceCode}-${convertCaseNumberGender(tail)}`,
      parse,
    };
  }

  if (moodCode === 'N') {
    return {
      partOfSpeech: 'infinitive',
      tag: `VN${tenseCode}${displayVoiceCode}`,
      parse,
    };
  }

  if (/^[123][SP]$/.test(tail)) {
    parse.person = `${tail[0]}Person`;
    parse.number = numberLabels[tail[1]];
  }

  return {
    partOfSpeech: 'verb',
    tag: `V${moodCode}${tenseCode}${displayVoiceCode}${tail}`,
    parse,
  };
}

function deriveEnding(form, morph) {
  const clean = cleanForm(form);
  if (clean.length <= 4) return clean;
  if (morph.startsWith('T-') || morph === 'PREP' || morph === 'CONJ') return clean;
  return `-${[...clean].slice(-Math.min(5, [...clean].length)).join('')}`;
}

function parseLine(line, bookName) {
  const cols = line.trim().split(/\s+/u);
  const ref = cols[1];
  const [chapterVerse, wordIndex] = ref.split('.');
  const [chapter, verse] = chapterVerse.split(':').map(Number);
  const surface = cols[3];
  const morph = cols[5];
  const lemma = cols.at(-1);
  const parsed = parseMorph(morph);

  return {
    chapter,
    verse,
    wordIndex: Number(wordIndex),
    surface,
    form: cleanForm(surface),
    lemma,
    gloss: lemma,
    ending: deriveEnding(surface, morph),
    stem: cleanForm(surface).replace(deriveEnding(surface, morph).replace(/^-/, ''), '') || cleanForm(surface),
    difficulty: parsed.partOfSpeech === 'verb' || parsed.partOfSpeech === 'participle' ? 2 : 1,
    ...parsed,
    book: bookName,
  };
}

const passages = [];

for (const [code, bookName, cuvCode] of books) {
  const file = readFileSync(join(sourceDir.pathname, `${code}.txt`), 'utf8');
  const cuvBook = loadCuvBook(cuvCode);
  const byVerse = new Map();

  for (const line of file.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const word = parseLine(line, bookName);
    const key = `${word.chapter}:${word.verse}`;
    if (!byVerse.has(key)) byVerse.set(key, []);
    byVerse.get(key).push(word);
  }

  for (const [key, words] of byVerse) {
    const [chapter, verse] = key.split(':').map(Number);
    const id = `${code.toLowerCase()}-${chapter}-${verse}`;
    const reference = `${bookName} ${chapter}:${verse}`;
    const greekText = verseText(words);
    passages.push({
      id,
      book: bookName,
      chapter,
      verse,
      reference,
      translation: cuvVerseText(cuvBook, chapter, verse) ?? greekText,
      greekText,
      words: words.map((word) => {
        const { book, chapter: _chapter, verse: _verse, wordIndex, surface, ...rest } = word;
        return {
          id: `${id}-${wordIndex}`,
          reference,
          surface,
          ...rest,
        };
      }),
    });
  }
}

writeFileSync(
  outFile,
  `// Generated by scripts/import-tischendorf.mjs from tischendorf-data word-per-line files and local CUV JSON.\nexport const passages = ${JSON.stringify(passages)};\n`,
);

console.log(`Generated ${passages.length} passages with ${passages.reduce((sum, passage) => sum + passage.words.length, 0)} words.`);
