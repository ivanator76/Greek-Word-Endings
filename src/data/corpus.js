import { passages } from './generatedPassages.js';

export const corpus = passages.flatMap((passage) => passage.words);
