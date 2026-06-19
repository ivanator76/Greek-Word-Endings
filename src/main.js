import { corpus } from './data/corpus.js?v=20260522-voice-n-as-middle';
import { passages } from './data/passages.js';
import { getRuleSection, ruleGroups, ruleSections } from './data/rules.js?v=20260518-random-info-hidden';
import {
  buildPassageQuestion,
  choosePracticePart,
  getAvailableBooks,
  getAvailableChapters,
  getAvailableVerses,
  getPassage,
  getPracticePartOptions,
  getPracticeWordDisplay,
  practiceParts,
} from './passageEngine.js';
import {
  buildFocusedReviewQuestion,
  buildQuestionInfoItems,
  buildQuizQuestion,
  buildRandomEndingQuestion,
  buildReviewQueue,
  formatParseSummary,
  NoAlternativeFormError,
} from './quizEngine.js?v=20260518-chinese-gloss-map';
import { createQuizSource } from './ai/quizGeneratorAdapter.js';
import { buildEndingComparison } from './endingComparison.js';
import { buildEndingMap, getEndingMapEntry, groupEndingMapEntries } from './endingMap.js';
import {
  allScopeId,
  buildScopedCorpus,
  createScopeGroup,
  defaultScopeGroups,
  scopeWordCount,
} from './quizScopes.js?v=20260518-random-scopes';
import { formatWordSplit } from './wordSplit.js?v=20260518-stem-ending-repair';

const app = document.querySelector('#app');
const initialPassage = passages[0];
const endingMapEntries = buildEndingMap(ruleSections);
const scopeStorageKey = 'nt-greek-ending-scope-groups';
const initialScopeDraftSelection = {
  book: initialPassage.book,
  chapter: initialPassage.chapter,
  verse: initialPassage.verse,
};

function loadScopeGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem(scopeStorageKey) ?? 'null');
    return Array.isArray(saved) ? saved : defaultScopeGroups;
  } catch {
    return defaultScopeGroups;
  }
}

function saveScopeGroups(groups) {
  localStorage.setItem(scopeStorageKey, JSON.stringify(groups));
}

const state = {
  view: 'practice',
  passageSelection: {
    book: initialPassage.book,
    chapter: initialPassage.chapter,
    verse: initialPassage.verse,
  },
  selectedPracticePart: 'participle',
  selectedRuleSectionId: 'noun-second',
  selectedRule: getRuleSection('noun-second').rows[1],
  selectedMapNode: '-ου',
  randomMode: 'all',
  randomQuestion: null,
  selectedRandomAnswer: null,
  randomChecked: false,
  selectedScopeIds: [allScopeId],
  scopeGroups: loadScopeGroups(),
  scopeDraft: {
    name: '',
    selection: initialScopeDraftSelection,
    references: [],
  },
  seed: 3,
  question: null,
  selectedAnswer: null,
  checked: false,
  practiceDisplaySettingsOpen: false,
  practiceDisplaySettings: {
    showParse: true,
    quizWordsOnly: false,
    highlightCurrentPart: true,
  },
  selectedReviewEnding: null,
  reviewQuestion: null,
  selectedReviewAnswer: null,
  reviewChecked: false,
  reviewStreaks: {},
  attempts: [
    { ending: '-ου', correct: false },
    { ending: '-ου', correct: true },
    { ending: '-κότες', correct: false },
    { ending: '-κότες', correct: false },
    { ending: '-σωμεν', correct: false },
    { ending: '-ων', correct: true },
    { ending: '-οις', correct: false },
  ],
};

const quizSource = createQuizSource((filters) =>
  buildPassageQuestion(passages, { ...state.passageSelection, ...filters, seed: state.seed++ }),
);

const matrixLabelShortcuts = {
  '主格單數': 'NS',
  '屬格單數': 'GS',
  '間接受格單數': 'DS',
  '受格單數': 'AS',
  '主格複數': 'NP',
  '屬格複數': 'GP',
  '間接受格複數': 'DP',
  '受格複數': 'AP',
  '主格陽性單數': 'NMS',
  '主格陰性單數': 'NFS',
  '主格中性單數': 'NNS',
  '1人稱': '1',
  '2人稱': '2',
  '3人稱': '3',
  '主動': 'A',
  '關身 / 被動': 'M/P',
  '2單': '2S',
  '3單': '3S',
  '2複': '2P',
};

function shortMatrixLabel(label) {
  return matrixLabelShortcuts[label] ?? label;
}

function randomCorpus() {
  return buildScopedCorpus(corpus, state.scopeGroups, state.selectedScopeIds);
}

function randomModeCount(mode, source = randomCorpus()) {
  return source.filter((form) =>
    mode === 'all'
      ? ['noun', 'verb', 'participle'].includes(form.partOfSpeech)
      : form.partOfSpeech === mode,
  ).length;
}

function nextRandomQuestion(mode = state.randomMode) {
  const source = randomCorpus();
  const resolvedMode = randomModeCount(mode, source) > 0 ? mode : 'all';
  state.randomMode = resolvedMode;
  state.randomQuestion = buildRandomEndingQuestion(source, {
    partOfSpeech: resolvedMode,
    seed: state.seed++,
  });
  state.selectedRandomAnswer = null;
  state.randomChecked = false;
}

function nextQuestion(filters = { partOfSpeech: 'participle' }) {
  const passage = getPassage(passages, state.passageSelection);
  const desiredPart = filters.partOfSpeech ?? state.selectedPracticePart;
  const currentPrompt = filters.excludeCurrent ? state.question?.prompt : null;
  state.selectedPracticePart = choosePracticePart(passage, desiredPart);
  try {
    state.question = quizSource.next({
      partOfSpeech: state.selectedPracticePart,
      excludeIds: currentPrompt ? [currentPrompt.id] : undefined,
      excludeForms: currentPrompt ? [currentPrompt.form] : undefined,
      requireAlternative: Boolean(currentPrompt),
    });
  } catch (error) {
    if (!(error instanceof NoAlternativeFormError)) throw error;
  }
  state.selectedAnswer = null;
  state.checked = false;
}

nextQuestion();
nextRandomQuestion();
render();

function render() {
  app.innerHTML = `
    <div class="shell">
      ${topNav()}
      <main class="workspace ${state.view}">
        ${renderView()}
      </main>
      ${bottomBar()}
    </div>
  `;

  bindEvents();
}

function topNav() {
  const tabs = [
    ['rules', '規則庫', '🏛'],
    ['practice', '經文練習', '📖'],
    ['random', '隨機測驗', '✦'],
    ['review', '弱點複習', '◎'],
    ['map', '詞尾地圖', '◇'],
  ];

  return `
    <header class="topbar">
      <div class="brand">
        <div class="mark">✣</div>
        <div>
          <strong>希臘文詞尾學習器</strong>
          <span>NT Greek Endings Lab · v0.1.0</span>
        </div>
      </div>
      <nav>
        ${tabs.map(([id, label, icon]) => `
          <button class="nav-tab ${state.view === id ? 'active' : ''}" data-view="${id}">
            <span>${icon}</span>${label}
          </button>
        `).join('')}
      </nav>
      <div class="tools">
        <button title="閱讀設定">▥</button>
        <button title="學習統計">▥</button>
        <button title="設定">⚙</button>
      </div>
    </header>
  `;
}

function renderView() {
  if (state.view === 'rules') return rulesView();
  if (state.view === 'random') return randomQuizView();
  if (state.view === 'review') return reviewView();
  if (state.view === 'map') return mapView();
  return practiceView();
}

function practiceView() {
  const q = state.question;
  const passage = getPassage(passages, state.passageSelection);
  const practiceOptions = getPracticePartOptions(passage);
  const split = formatWordSplit(q.prompt);
  return `
    <section class="pane scripture">
      <div class="pane-head">
        <div>
          <h2>${passage.reference}</h2>
          <span>本地 tagged corpus · 對照</span>
        </div>
        <button class="small ${state.practiceDisplaySettingsOpen ? 'active' : ''}" data-action="toggle-display-settings">顯示設定</button>
      </div>
      ${displaySettingsPanel()}
      ${passageSelector()}
      <p class="verse">${passage.translation}</p>
      ${wordList(passage)}
    </section>
    <section class="pane quiz">
      <div class="filter-label">出題範圍</div>
      <div class="mode-tabs">
        ${practiceOptions.map((option) => `
          <button
            class="${state.selectedPracticePart === option.id ? 'active' : ''}"
            data-filter="${option.id}"
            ${option.available ? '' : 'disabled'}
          >
            <span>${option.label}</span>
            <small>${option.count}</small>
          </button>
        `).join('')}
      </div>
      <div class="selected-word">
        <span>已選詞彙</span>
        <h1>${q.prompt.form}</h1>
        <div class="split"><b>${split.stem}</b><i>+</i><b>${split.ending}</b></div>
      </div>
      <div class="answer-grid">
        ${q.options.map((option) => `
          <button class="answer ${state.selectedAnswer === option ? 'selected' : ''} ${state.checked && option === q.correctAnswer ? 'correct' : ''}" data-answer="${option}">
            ${option}
          </button>
        `).join('')}
      </div>
      <div class="quiz-actions">
        <button class="primary" data-action="check">檢查答案</button>
        <button data-action="next">下一個詞彙 →</button>
      </div>
      ${state.checked ? `<p class="feedback">${state.selectedAnswer === q.correctAnswer ? '答對了。' : '再看一次詞尾。'}${q.explanation}</p>` : ''}
    </section>
    ${endingComparisonPanel(q.prompt)}
  `;
}

function endingComparisonPanel(prompt) {
  const comparison = buildEndingComparison(prompt);

  return `
    <section class="pane ladder">
      <h2>${comparison.title}</h2>
      <p class="comparison-subtitle">${comparison.subtitle}</p>
      ${comparison.marker ? `<p class="marker-line">時態記號 <span>${comparison.marker}</span></p>` : ''}
      ${comparison.rows.map((row) => `
        <article class="${row.active ? 'active' : ''}">
          <strong>${row.ending}</strong>
          <span>${row.parse}</span>
          <small>${row.tag} · ${row.examples}</small>
        </article>
      `).join('')}
      <div class="rule-note">
        <b>對照提醒</b>
        <p>${comparison.note}</p>
      </div>
    </section>
  `;
}

function displaySettingsPanel() {
  if (!state.practiceDisplaySettingsOpen) return '';

  const settings = state.practiceDisplaySettings;
  const options = [
    ['showParse', '顯示解析', '顯示每個詞的格性數或時態語態摘要'],
    ['quizWordsOnly', '只顯示可測驗詞', '只留下名詞、動詞、分詞'],
    ['highlightCurrentPart', '高亮目前詞類', '依中間的出題範圍標出同類詞'],
  ];

  return `
    <div class="display-settings">
      ${options.map(([key, label, hint]) => `
        <label>
          <input type="checkbox" data-display-setting="${key}" ${settings[key] ? 'checked' : ''} />
          <span>${label}</span>
          <small>${hint}</small>
        </label>
      `).join('')}
    </div>
  `;
}

function passageSelector() {
  const books = getAvailableBooks(passages);
  const chapters = getAvailableChapters(passages, state.passageSelection.book);
  const verses = getAvailableVerses(passages, state.passageSelection.book, state.passageSelection.chapter);

  return `
    <div class="passage-selector">
      <label>書卷
        <select data-passage-field="book">
          ${books.map((book) => `<option value="${book}" ${book === state.passageSelection.book ? 'selected' : ''}>${book}</option>`).join('')}
        </select>
      </label>
      <label>章
        <select data-passage-field="chapter">
          ${chapters.map((chapter) => `<option value="${chapter}" ${chapter === Number(state.passageSelection.chapter) ? 'selected' : ''}>${chapter}</option>`).join('')}
        </select>
      </label>
      <label>節
        <select data-passage-field="verse">
          ${verses.map((verse) => `<option value="${verse}" ${verse === Number(state.passageSelection.verse) ? 'selected' : ''}>${verse}</option>`).join('')}
        </select>
      </label>
    </div>
  `;
}

function scopeDraftSelector() {
  const books = getAvailableBooks(passages);
  const selection = state.scopeDraft.selection;
  const chapters = getAvailableChapters(passages, selection.book);
  const verses = getAvailableVerses(passages, selection.book, selection.chapter);

  return `
    <div class="passage-selector compact">
      <label>書卷
        <select data-scope-field="book">
          ${books.map((book) => `<option value="${book}" ${book === selection.book ? 'selected' : ''}>${book}</option>`).join('')}
        </select>
      </label>
      <label>章
        <select data-scope-field="chapter">
          ${chapters.map((chapter) => `<option value="${chapter}" ${chapter === Number(selection.chapter) ? 'selected' : ''}>${chapter}</option>`).join('')}
        </select>
      </label>
      <label>節
        <select data-scope-field="verse">
          ${verses.map((verse) => `<option value="${verse}" ${verse === Number(selection.verse) ? 'selected' : ''}>${verse}</option>`).join('')}
        </select>
      </label>
    </div>
  `;
}

function updateScopeDraftSelection(field, value) {
  const nextSelection = {
    ...state.scopeDraft.selection,
    [field]: field === 'book' ? value : Number(value),
  };

  if (field === 'book') {
    const [chapter] = getAvailableChapters(passages, nextSelection.book);
    nextSelection.chapter = chapter;
    [nextSelection.verse] = getAvailableVerses(passages, nextSelection.book, chapter);
  }

  if (field === 'chapter') {
    [nextSelection.verse] = getAvailableVerses(passages, nextSelection.book, nextSelection.chapter);
  }

  state.scopeDraft = {
    ...state.scopeDraft,
    selection: nextSelection,
  };
}

function currentScopeDraftReference() {
  return getPassage(passages, state.scopeDraft.selection).reference;
}

function wordList(passage) {
  const words = getPracticeWordDisplay(passage, {
    selectedWordId: state.question.prompt.id,
    selectedPracticePart: state.selectedPracticePart,
    settings: state.practiceDisplaySettings,
  });

  return `<div class="word-list ${state.practiceDisplaySettings.showParse ? '' : 'hide-parse'}">${words.map((word, index) => `
    <button class="${word.active ? 'active' : ''} ${word.highlighted ? 'part-highlight' : ''}" data-word-id="${word.id}">
      <span>${index + 1}</span><b>${word.form}</b><em>${word.gloss}</em>${word.showParse ? `<small>${formatParseSummary(word) || word.tag}</small>` : ''}
    </button>
  `).join('')}</div>`;
}

function rulesView() {
  const section = getRuleSection(state.selectedRuleSectionId);
  if (section.matrix) return matrixRulesView(section);

  return `
    <section class="pane nav-pane">
      <input class="search" placeholder="搜尋字尾或解析標籤" />
      ${ruleGroups.map((group) => `
        <div class="rule-group">
          <h3>${group.title}<span>${group.count}</span></h3>
          ${group.items.map((item) => `
            <button class="${state.selectedRuleSectionId === item.id ? 'active' : ''}" data-rule-section="${item.id}">
              ${item.label}
            </button>
          `).join('')}
        </div>
      `).join('')}
    </section>
    <section class="pane rule-table-pane">
      <div class="pane-head">
        <div><h2>${section.title}</h2><span>${section.subtitle}</span></div>
        <button class="small">開始測驗</button>
      </div>
      ${section.matrix ? matrixRuleTable(section) : listRuleTable(section)}
    </section>
    <section class="pane detail">
      <h2>${state.selectedRule.ending} 的辨識</h2>
      <p class="big-ending">${state.selectedRule.ending}</p>
      <dl>
        <dt>主要功能</dt><dd>${state.selectedRule.parse}</dd>
        ${section.marker ? `<dt>時態記號</dt><dd><span class="marker-badge">${section.marker}</span></dd>` : ''}
        <dt>常見標籤</dt><dd>${state.selectedRule.tag}</dd>
        <dt>例字</dt><dd>${state.selectedRule.examples}</dd>
      </dl>
      <div class="rule-note">
        <b>辨識提醒</b>
        <p>${state.selectedRule.note ?? '同一個字尾可能跨詞類共用；請同時看冠詞、詞幹、句法位置與上下文。'}</p>
      </div>
      <button class="primary">加入複習</button>
    </section>
  `;
}

function ruleNavigation() {
  return `
    <section class="pane nav-pane">
      <input class="search" placeholder="搜尋字尾或解析標籤" />
      ${ruleGroups.map((group) => `
        <div class="rule-group">
          <h3>${group.title}<span>${group.count}</span></h3>
          ${group.items.map((item) => `
            <button class="${state.selectedRuleSectionId === item.id ? 'active' : ''}" data-rule-section="${item.id}">
              ${item.label}
            </button>
          `).join('')}
        </div>
      `).join('')}
    </section>
  `;
}

function matrixRulesView(section) {
  return `
    ${ruleNavigation()}
    <section class="pane matrix-pane">
      <div class="pane-head">
        <div><h2>${section.title}</h2><span>${section.subtitle}</span></div>
        <button class="small">開始測驗</button>
      </div>
      <div class="matrix-layout">
        ${matrixRuleTable(section)}
        <aside class="matrix-detail">
          <h2>${state.selectedRule.ending} 的辨識</h2>
          <p class="big-ending">${state.selectedRule.ending}</p>
          <dl>
            <dt>主要功能</dt><dd>${state.selectedRule.parse}</dd>
            <dt>常見標籤</dt><dd>${state.selectedRule.tag}</dd>
            <dt>例字</dt><dd>${state.selectedRule.examples}</dd>
          </dl>
          <div class="rule-note">
            <b>辨識提醒</b>
            <p>${state.selectedRule.note ?? '同一個字尾可能跨詞類共用；請同時看冠詞、詞幹、句法位置與上下文。'}</p>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function isSelectedRule(rule) {
  return (
    state.selectedRule.ending === rule.ending &&
    state.selectedRule.parse === rule.parse &&
    state.selectedRule.tag === rule.tag
  );
}

function listRuleTable(section) {
  return `
    <div class="rule-table-scroll">
      <table class="rule-table">
        <colgroup>
          <col class="ending-col" />
          <col class="parse-col" />
        </colgroup>
        <thead><tr><th>字尾</th><th>格性數</th></tr></thead>
        <tbody>
          ${section.rows.map((rule, index) => `
            <tr class="${isSelectedRule(rule) ? 'active' : ''}" data-rule-index="${index}">
              <td class="ending-cell">${rule.ending}</td><td class="parse-cell">${rule.parse}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function matrixRuleTable(section) {
  let ruleIndex = 0;
  return `
    <div class="rule-table-scroll">
      <table class="paradigm-table">
        <thead>
          <tr>
            <th>${section.matrix.rowHeader ?? ''}</th>
            ${section.matrix.columns.map((column) => `<th>${column}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${section.matrix.rows.map((row) => `
            <tr>
              <th title="${row.label}">${shortMatrixLabel(row.label)}</th>
              ${row.cells.map((cell) => {
                const currentIndex = ruleIndex;
                const rule = section.rows[ruleIndex];
                ruleIndex += 1;
                return `
                  <td class="${isSelectedRule(rule) ? 'active' : ''}" data-rule-index="${currentIndex}">
                    <b>${cell.ending}</b>
                    <span>${cell.tag}</span>
                    <small>${cell.examples}</small>
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function randomQuizView() {
  const q = state.randomQuestion;
  const split = formatWordSplit(q.prompt);
  const infoItems = buildQuestionInfoItems(q, state.randomChecked);
  const source = randomCorpus();
  const modes = [
    ['all', '混合', randomModeCount('all', source)],
    ['noun', '名詞', randomModeCount('noun', source)],
    ['verb', '動詞', randomModeCount('verb', source)],
    ['participle', '分詞', randomModeCount('participle', source)],
  ];
  const activeScopeNames = state.selectedScopeIds.includes(allScopeId)
    ? ['全本新約']
    : state.scopeGroups.filter((group) => state.selectedScopeIds.includes(group.id)).map((group) => group.name);

  return `
    <section class="pane nav-pane">
      <div class="pane-head"><div><h2>隨機測驗</h2><span>${activeScopeNames.join('、')} · ${randomModeCount('all', source)} 詞</span></div></div>
      <div class="random-mode-list">
        ${modes.map(([id, label, count]) => `
          <button class="${state.randomMode === id ? 'active' : ''}" data-random-mode="${id}" ${count ? '' : 'disabled'}>
            <b>${label}</b>
            <span>${count} 詞</span>
          </button>
        `).join('')}
      </div>
      ${randomScopePanel()}
      <div class="rule-note">
        <b>測驗範圍</b>
        <p>先選經文組，再選名詞、動詞、分詞或混合。混合模式只會從名詞、動詞、分詞抽題。</p>
      </div>
    </section>
    <section class="pane quiz">
      <div class="selected-word">
        <span>${modes.find(([id]) => id === state.randomMode)?.[1] ?? '混合'}測驗</span>
        <h1>${q.prompt.form}</h1>
        <div class="split"><b>${split.stem}</b><i>+</i><b>${split.ending}</b></div>
      </div>
      <div class="answer-grid">
        ${q.options.map((option) => `
          <button class="answer ${state.selectedRandomAnswer === option ? 'selected' : ''} ${state.randomChecked && option === q.correctAnswer ? 'correct' : ''}" data-random-answer="${option}">
            ${option}
          </button>
        `).join('')}
      </div>
      <div class="quiz-actions">
        <button class="primary" data-action="random-check">檢查答案</button>
        <button data-action="random-next">下一題 →</button>
      </div>
      ${state.randomChecked ? `<p class="feedback">${state.selectedRandomAnswer === q.correctAnswer ? '答對了。' : '這個詞尾已納入弱點複習。'}${q.explanation}</p>` : ''}
    </section>
    <section class="pane detail">
      <h2>本題資訊</h2>
      <dl>
        ${infoItems.map((item) => `<dt>${item.label}</dt><dd>${item.value}</dd>`).join('')}
      </dl>
      ${state.randomChecked ? '' : '<p class="hint">作答後會顯示詞尾、標籤與解析。</p>'}
      <div class="rule-note">
        <b>弱點連動</b>
        <p>每次檢查答案都會記錄詞尾與正誤；答錯的詞尾會在弱點複習中提高優先級。</p>
      </div>
    </section>
  `;
}

function randomScopePanel() {
  return `
    <div class="scope-panel">
      <h3>出題經文組</h3>
      <label class="scope-choice">
        <input type="checkbox" data-scope-id="${allScopeId}" ${state.selectedScopeIds.includes(allScopeId) ? 'checked' : ''} />
        <span><b>全本新約</b><small>${scopeWordCount(corpus, state.scopeGroups, allScopeId)} 詞</small></span>
      </label>
      ${state.scopeGroups.map((group) => `
        <label class="scope-choice">
          <input type="checkbox" data-scope-id="${group.id}" ${state.selectedScopeIds.includes(group.id) ? 'checked' : ''} />
          <span><b>${group.name}</b><small>${group.references.join('、')} · ${scopeWordCount(corpus, state.scopeGroups, group.id)} 詞</small></span>
          <button type="button" class="icon-button" title="刪除經文組" data-delete-scope="${group.id}">×</button>
        </label>
      `).join('')}
      <div class="scope-editor">
        <input type="text" data-scope-name placeholder="經文組名稱，例如：第 1 課 A 組" value="${state.scopeDraft.name}" />
        ${scopeDraftSelector()}
        <button type="button" data-action="add-scope-reference">加入這節</button>
        <div class="scope-reference-list">
          ${state.scopeDraft.references.length
            ? state.scopeDraft.references.map((reference) => `
              <span>${reference}<button type="button" data-remove-scope-reference="${reference}">×</button></span>
            `).join('')
            : '<small>尚未加入經文</small>'}
        </div>
        <button type="button" class="primary" data-action="save-scope-group" ${state.scopeDraft.references.length ? '' : 'disabled'}>儲存經文組</button>
      </div>
    </div>
  `;
}

function reviewView() {
  const queue = buildReviewQueue(corpus, state.attempts, state.reviewStreaks)
    .filter((item) => item.forms.length > 0);
  ensureReviewQuestion(queue);
  const selected = queue.find((item) => item.ending === state.selectedReviewEnding);
  const q = state.reviewQuestion;
  const split = q ? formatWordSplit(q.prompt) : null;

  if (!queue.length || !selected || !q) {
    return `
      <section class="pane nav-pane">
        <div class="pane-head"><div><h2>弱點佇列</h2><span>完成經文練習後會自動建立</span></div></div>
      </section>
      <section class="pane quiz review-empty">
        <h2>目前沒有可複習的弱點</h2>
        <p>先到經文練習答幾題；答錯的詞尾會自動進入這裡。</p>
        <button class="primary" data-view="practice">前往經文練習</button>
      </section>
      <section class="pane detail">
        <h2>複習規則</h2>
        <p class="rule-note">答錯會提高詞尾優先級；集中複習中連續答對會降低排序權重。</p>
      </section>
    `;
  }

  return `
    <section class="pane nav-pane">
      <div class="pane-head"><div><h2>弱點佇列</h2><span>依錯題與到期排序</span></div></div>
      <div class="chips"><button class="active">全部</button><button>名詞</button><button>動詞</button><button>分詞</button></div>
      ${queue.map((item) => `
        <button class="weak-item ${item.ending === state.selectedReviewEnding ? 'active' : ''}" data-review-ending="${item.ending}">
          <b>${item.ending}</b>
          <span>錯 ${item.missed}｜正確率 ${item.accuracy}%｜連對 ${item.streak}</span>
          <meter min="0" max="100" value="${item.accuracy}"></meter>
        </button>
      `).join('')}
    </section>
    <section class="pane quiz">
      <div class="selected-word">
        <span>集中複習：${selected.ending}</span>
        <h1>${q.prompt.form}</h1>
        <div class="split"><b>${split.stem}</b><i>+</i><b>${split.ending}</b></div>
      </div>
      <div class="answer-grid">
        ${q.options.map((option) => `
          <button class="answer ${state.selectedReviewAnswer === option ? 'selected' : ''} ${state.reviewChecked && option === q.correctAnswer ? 'correct' : ''}" data-review-answer="${option}">
            ${option}
          </button>
        `).join('')}
      </div>
      <div class="quiz-actions">
        <button class="primary" data-action="review-check">檢查答案</button>
        <button data-action="review-next">下一個弱點題 →</button>
      </div>
      ${state.reviewChecked ? `<p class="feedback">${state.selectedReviewAnswer === q.correctAnswer ? '答對了，這個詞尾的權重下降。' : '這題先留在弱點佇列。'}${q.explanation}</p>` : ''}
    </section>
    <section class="pane detail">
      <h2>${selected.ending} 的復健進度</h2>
      <dl>
        <dt>累積作答</dt><dd>${selected.total} 次</dd>
        <dt>錯題次數</dt><dd>${selected.missed} 次</dd>
        <dt>目前正確率</dt><dd>${selected.accuracy}%</dd>
        <dt>連續答對</dt><dd>${selected.streak} / 3</dd>
      </dl>
      <div class="mini-chart">
        <span style="height:${Math.max(8, selected.accuracy)}%"></span>
        <span style="height:${Math.max(8, selected.priority * 18)}%"></span>
        <span style="height:${Math.max(8, selected.streak * 28)}%"></span>
      </div>
      <div class="rule-note">
        <b>複習規則</b>
        <p>連續答對會降低這個詞尾在弱點佇列中的排序；答錯則會重置連對並提高優先級。</p>
      </div>
    </section>
  `;
}

function mapView() {
  const selectedEntry = getEndingMapEntry(endingMapEntries, state.selectedMapNode);
  state.selectedMapNode = selectedEntry.ending;
  const groups = groupEndingMapEntries(endingMapEntries);
  const quizForms = corpus.filter((form) => form.ending === selectedEntry.ending);
  return `
    <section class="pane nav-pane">
      <input class="search" placeholder="搜尋 -ου, -οι, -μεν" />
      <div class="rule-group">
        <h3>顯示設定</h3>
        ${['顯示相同字尾', '標出易混淆', '只看已學', '新約常見'].map((item) => `<label><input type="checkbox" checked /> ${item}</label>`).join('')}
      </div>
      <div class="legend"><span></span>格性數 <span></span>時態語氣 <span></span>易混淆</div>
    </section>
    <section class="pane map-pane">
      <h2>新約希臘文字尾地圖</h2>
      <div class="ending-map">
        ${groups.map((group) => `
          <div class="map-band">
            <h3>${group.label}</h3>
            ${group.entries.map((entry) => `
              <button class="${selectedEntry.ending === entry.ending ? 'active' : ''}" data-node="${entry.ending}">
                <span>${entry.ending}</span>
                <small>${entry.sourceCount} 規則</small>
              </button>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </section>
    <section class="pane detail">
      <h2>${selectedEntry.ending} 的交會點</h2>
      <p class="big-ending">${selectedEntry.ending}</p>
      <p class="map-summary">
        出現在 ${selectedEntry.groupLabels.join('、')}，共 ${selectedEntry.sourceCount} 條規則。
      </p>
      <div class="map-sources">
        ${selectedEntry.sources.map((source) => `
          <article>
            <b>${source.groupLabel}</b>
            <strong>${source.sectionTitle}</strong>
            <span>${source.originalEnding}｜${source.parse}</span>
            <small>${source.tag} · ${source.examples}</small>
          </article>
        `).join('')}
      </div>
      <div class="rule-note">
        <b>辨識提醒</b>
        <p>${selectedEntry.sources[0]?.note ?? '同一個字尾可能跨詞類共用；請回到上下文判斷詞類與句法角色。'}</p>
      </div>
      <button class="primary" data-action="map-practice" ${quizForms.length ? '' : 'disabled'}>
        用 ${selectedEntry.ending} 出弱點題
      </button>
    </section>
  `;
}

function bottomBar() {
  return `
    <footer class="statusbar">
      <span>學習進度：形容詞分詞｜完成度 64%</span>
      <progress max="100" value="64"></progress>
      <span>連續學習 7 天</span>
      <span>今日已學 23 詞彙</span>
    </footer>
  `;
}

function ensureReviewQuestion(queue) {
  if (!queue.length) {
    state.selectedReviewEnding = null;
    state.reviewQuestion = null;
    return;
  }

  const selectedStillQueued = queue.some((item) => item.ending === state.selectedReviewEnding);
  if (!selectedStillQueued) {
    state.selectedReviewEnding = queue[0].ending;
    state.reviewQuestion = null;
  }

  if (!state.reviewQuestion || state.reviewQuestion.prompt.ending !== state.selectedReviewEnding) {
    startReviewQuestion(state.selectedReviewEnding);
  }
}

function startReviewQuestion(ending) {
  state.selectedReviewEnding = ending;
  state.reviewQuestion = buildFocusedReviewQuestion(corpus, ending, state.seed++);
  state.selectedReviewAnswer = null;
  state.reviewChecked = false;
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      render();
    });
  });
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      state.selectedPracticePart = button.dataset.filter;
      nextQuestion({ partOfSpeech: button.dataset.filter });
      render();
    });
  });
  document.querySelectorAll('[data-passage-field]').forEach((select) => {
    select.addEventListener('change', () => {
      updatePassageSelection(select.dataset.passageField, select.value);
      nextQuestion({ partOfSpeech: state.selectedPracticePart });
      render();
    });
  });
  document.querySelectorAll('[data-word-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const passage = getPassage(passages, state.passageSelection);
      const word = passage.words.find((item) => item.id === button.dataset.wordId);
      if (!word || !practiceParts.includes(word.partOfSpeech)) return;
      state.selectedPracticePart = word.partOfSpeech;
      state.question = buildQuizQuestion(passage.words, { partOfSpeech: word.partOfSpeech, ending: word.ending, seed: state.seed++ });
      state.selectedAnswer = null;
      state.checked = false;
      render();
    });
  });
  document.querySelectorAll('[data-answer]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedAnswer = button.dataset.answer;
      render();
    });
  });
  document.querySelectorAll('[data-random-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      nextRandomQuestion(button.dataset.randomMode);
      render();
    });
  });
  document.querySelectorAll('[data-scope-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const scopeId = checkbox.dataset.scopeId;
      if (scopeId === allScopeId) {
        state.selectedScopeIds = [allScopeId];
      } else if (checkbox.checked) {
        state.selectedScopeIds = [...new Set(state.selectedScopeIds.filter((id) => id !== allScopeId).concat(scopeId))];
      } else {
        state.selectedScopeIds = state.selectedScopeIds.filter((id) => id !== scopeId);
        if (state.selectedScopeIds.length === 0) state.selectedScopeIds = [allScopeId];
      }
      nextRandomQuestion();
      render();
    });
  });
  document.querySelectorAll('[data-delete-scope]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const groupId = button.dataset.deleteScope;
      state.scopeGroups = state.scopeGroups.filter((group) => group.id !== groupId);
      state.selectedScopeIds = state.selectedScopeIds.filter((id) => id !== groupId);
      if (state.selectedScopeIds.length === 0) state.selectedScopeIds = [allScopeId];
      saveScopeGroups(state.scopeGroups);
      nextRandomQuestion();
      render();
    });
  });
  document.querySelector('[data-scope-name]')?.addEventListener('input', (event) => {
    state.scopeDraft = {
      ...state.scopeDraft,
      name: event.target.value,
    };
  });
  document.querySelectorAll('[data-scope-field]').forEach((select) => {
    select.addEventListener('change', () => {
      updateScopeDraftSelection(select.dataset.scopeField, select.value);
      render();
    });
  });
  document.querySelector('[data-action="add-scope-reference"]')?.addEventListener('click', () => {
    const reference = currentScopeDraftReference();
    state.scopeDraft = {
      ...state.scopeDraft,
      references: [...new Set([...state.scopeDraft.references, reference])],
    };
    render();
  });
  document.querySelectorAll('[data-remove-scope-reference]').forEach((button) => {
    button.addEventListener('click', () => {
      state.scopeDraft = {
        ...state.scopeDraft,
        references: state.scopeDraft.references.filter((reference) => reference !== button.dataset.removeScopeReference),
      };
      render();
    });
  });
  document.querySelector('[data-action="save-scope-group"]')?.addEventListener('click', () => {
    if (state.scopeDraft.references.length === 0) return;
    const group = createScopeGroup(state.scopeDraft.name, state.scopeDraft.references, state.scopeGroups);
    state.scopeGroups = [...state.scopeGroups, group];
    state.selectedScopeIds = [group.id];
    state.scopeDraft = {
      name: '',
      selection: state.scopeDraft.selection,
      references: [],
    };
    saveScopeGroups(state.scopeGroups);
    nextRandomQuestion();
    render();
  });
  document.querySelectorAll('[data-random-answer]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedRandomAnswer = button.dataset.randomAnswer;
      render();
    });
  });
  document.querySelectorAll('[data-review-ending]').forEach((button) => {
    button.addEventListener('click', () => {
      startReviewQuestion(button.dataset.reviewEnding);
      render();
    });
  });
  document.querySelectorAll('[data-review-answer]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedReviewAnswer = button.dataset.reviewAnswer;
      render();
    });
  });
  document.querySelector('[data-action="check"]')?.addEventListener('click', () => {
    if (!state.selectedAnswer) return;
    state.checked = true;
    state.attempts.push({
      ending: state.question.prompt.ending,
      correct: state.selectedAnswer === state.question.correctAnswer,
    });
    render();
  });
  document.querySelector('[data-action="random-check"]')?.addEventListener('click', () => {
    if (!state.selectedRandomAnswer || state.randomChecked) return;
    state.randomChecked = true;
    state.attempts.push({
      ending: state.randomQuestion.prompt.ending,
      correct: state.selectedRandomAnswer === state.randomQuestion.correctAnswer,
      mode: 'random',
    });
    render();
  });
  document.querySelector('[data-action="review-check"]')?.addEventListener('click', () => {
    if (!state.selectedReviewAnswer || state.reviewChecked) return;
    const correct = state.selectedReviewAnswer === state.reviewQuestion.correctAnswer;
    const ending = state.reviewQuestion.prompt.ending;
    state.reviewChecked = true;
    state.reviewStreaks = {
      ...state.reviewStreaks,
      [ending]: correct ? (state.reviewStreaks[ending] ?? 0) + 1 : 0,
    };
    state.attempts.push({ ending, correct, mode: 'review' });
    render();
  });
  document.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    nextQuestion({ partOfSpeech: state.question.prompt.partOfSpeech, excludeCurrent: true });
    render();
  });
  document.querySelector('[data-action="random-next"]')?.addEventListener('click', () => {
    nextRandomQuestion();
    render();
  });
  document.querySelector('[data-action="review-next"]')?.addEventListener('click', () => {
    if (!state.selectedReviewEnding) return;
    startReviewQuestion(state.selectedReviewEnding);
    render();
  });
  document.querySelector('[data-action="toggle-display-settings"]')?.addEventListener('click', () => {
    state.practiceDisplaySettingsOpen = !state.practiceDisplaySettingsOpen;
    render();
  });
  document.querySelectorAll('[data-display-setting]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      state.practiceDisplaySettings = {
        ...state.practiceDisplaySettings,
        [checkbox.dataset.displaySetting]: checkbox.checked,
      };
      render();
    });
  });
  document.querySelectorAll('[data-rule-index]').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedRule = getRuleSection(state.selectedRuleSectionId).rows[Number(row.dataset.ruleIndex)];
      render();
    });
  });
  document.querySelectorAll('[data-rule-section]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedRuleSectionId = button.dataset.ruleSection;
      state.selectedRule = getRuleSection(state.selectedRuleSectionId).rows[0];
      render();
    });
  });
  document.querySelectorAll('[data-node]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedMapNode = button.dataset.node;
      render();
    });
  });
  document.querySelector('[data-action="map-practice"]')?.addEventListener('click', () => {
    const ending = state.selectedMapNode;
    if (!corpus.some((form) => form.ending === ending)) return;
    state.attempts.push({ ending, correct: false, mode: 'map' });
    startReviewQuestion(ending);
    state.view = 'review';
    render();
  });
}

function updatePassageSelection(field, value) {
  if (field === 'book') {
    const chapter = getAvailableChapters(passages, value)[0];
    const verse = getAvailableVerses(passages, value, chapter)[0];
    state.passageSelection = { book: value, chapter, verse };
    return;
  }

  if (field === 'chapter') {
    const chapter = Number(value);
    const verse = getAvailableVerses(passages, state.passageSelection.book, chapter)[0];
    state.passageSelection = { ...state.passageSelection, chapter, verse };
    return;
  }

  state.passageSelection = { ...state.passageSelection, verse: Number(value) };
}
