const lexicalGlosses = {
  συμβαίνω: '發生、臨到',
  λέγω: '說',
  ἀγαπάω: '愛',
  δίδωμι: '給、賜',
  πιστεύω: '相信',
  λόγος: '話、道',
  ἔργον: '工作、事',
  καρδία: '心',
  γράφω: '寫',
  γίνομαι: '成為、發生',
  ἔρχομαι: '來',
  λαμβάνω: '拿、領受',
  ὁράω: '看見',
  ἀκούω: '聽見',
  ποιέω: '做、行',
  τηρέω: '遵守',
  περιπατέω: '行走、生活',
  πληρόω: '充滿、成就',
  ἐντολή: '命令',
  καινός: '新的',
  ἀλλήλων: '彼此',
  καθώς: '正如、照著',
};

function normalizeGreek(value = '') {
  return String(value).replace(/[.,;··]/g, '').trim();
}

function hasChinese(value = '') {
  return /\p{Script=Han}/u.test(value);
}

function hasGreek(value = '') {
  return /\p{Script=Greek}/u.test(value);
}

export function chineseGlossFor(form) {
  if (hasChinese(form.gloss)) return form.gloss;

  const lemma = normalizeGreek(form.lemma);
  const baseForm = normalizeGreek(form.form);
  const gloss = normalizeGreek(form.gloss);

  return lexicalGlosses[lemma]
    ?? lexicalGlosses[baseForm]
    ?? (gloss && !hasGreek(gloss) ? gloss : '')
    ?? '';
}
