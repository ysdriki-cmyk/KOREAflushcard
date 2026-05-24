const CONFIG = window.APP_CONFIG || {};

const state = {
  allWords: [],
  words: [],
  categories: [],
  selectedCategory: "",
  mode: localStorage.getItem(CONFIG.modeStorageKey || "korean-flashcard-mode") || "order",
  deck: [],
  pos: 0,
  currentExampleKo: ""
};

const elements = {
  appTitle: document.getElementById("appTitle"),
  appSubtitle: document.getElementById("appSubtitle"),
  reloadBtn: document.getElementById("reloadBtn"),
  startScreen: document.getElementById("startScreen"),
  categorySummary: document.getElementById("categorySummary"),
  categoryCountBadge: document.getElementById("categoryCountBadge"),
  quickActionButtons: document.getElementById("quickActionButtons"),
  categoryButtons: document.getElementById("categoryButtons"),
  quizScreen: document.getElementById("quizScreen"),
  currentCategory: document.getElementById("currentCategory"),
  qIndex: document.getElementById("qIndex"),
  qTotal: document.getElementById("qTotal"),
  backToCategoriesBtn: document.getElementById("backToCategoriesBtn"),
  modeOrderBtn: document.getElementById("modeOrderBtn"),
  modeShuffleBtn: document.getElementById("modeShuffleBtn"),
  koWord: document.getElementById("koWord"),
  optionsLabel: document.getElementById("optionsLabel"),
  options: document.getElementById("options"),
  result: document.getElementById("result"),
  correctAnswer: document.getElementById("correctAnswer"),
  exKo: document.getElementById("exKo"),
  exEn: document.getElementById("exEn"),
  exJp: document.getElementById("exJp"),
  exSpeakKo: document.getElementById("exSpeakKo"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  speakKo: document.getElementById("speakKo"),
  speakEn: document.getElementById("speakEn"),
  memoBox: document.getElementById("memoBox"),
  errorMessage: document.getElementById("errorMessage")
};

function applyConfig() {
  if (CONFIG.appTitle) {
    document.title = CONFIG.appTitle;
    elements.appTitle.textContent = CONFIG.appTitle;
  }
  if (CONFIG.appSubtitle) {
    elements.appSubtitle.textContent = CONFIG.appSubtitle;
  }
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function speak(text, lang) {
  if (!text) {
    return;
  }
  if (!("speechSynthesis" in window)) {
    alert("このブラウザは音声読み上げに対応していません。");
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  synth.speak(utter);
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cells) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = (cells[index] || "").trim();
    });
    return item;
  });
}

function normalizeRows(rows) {
  return rows
    .map((row, index) => ({
      id: Number(row.id || index + 1),
      ko: row.ko_word || row.ko || row.Front || "",
      en: row.word_en || row.en || row.Back || "",
      exampleKoDisplay: row.example_ko_display || row.exampleKoDisplay || "",
      exampleKoTts: row.example_ko_tts || row.exampleKoTts || row.example_ko_display || "",
      exampleEn: row.example_en || row.exampleEn || "",
      exampleJp: row.example_jp || row.exampleJp || "",
      category: row.category || row.Category || row.category_name || row["カテゴリ"] || ""
    }))
    .filter((row) => row.ko && row.en);
}

function collectCategories(words) {
  const counts = new Map();
  words.forEach((word) => {
    if (!word.category) {
      return;
    }
    counts.set(word.category, (counts.get(word.category) || 0) + 1);
  });
  return Array.from(counts, ([name, count]) => ({ name, count }));
}

async function fetchCsv(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CSVの取得に失敗しました: ${response.status}`);
  }
  return response.text();
}

async function loadWords() {
  elements.errorMessage.textContent = "";

  const sources = [];
  if (CONFIG.googleSheetCsvUrl) {
    sources.push({
      url: CONFIG.googleSheetCsvUrl
    });
  }
  if (CONFIG.fallbackCsvPath) {
    sources.push({
      url: CONFIG.fallbackCsvPath
    });
  }

  let lastError;

  for (const source of sources) {
    try {
      const csvText = await fetchCsv(source.url);
      const parsed = normalizeRows(parseCsv(csvText));
      if (!parsed.length) {
        throw new Error("有効な単語行が見つかりませんでした。");
      }
      state.allWords = parsed;
      state.categories = collectCategories(parsed);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("読み込めるデータソースがありません。");
}

function buildDeck() {
  state.deck = Array.from({ length: state.words.length }, (_, index) => index);
  if (state.mode === "shuffle") {
    state.deck = shuffleArray(state.deck);
  }
  state.pos = 0;
}

function setScreen(showQuiz) {
  elements.startScreen.classList.toggle("hidden", showQuiz);
  elements.quizScreen.classList.toggle("hidden", !showQuiz);
}

function updateOptionsLabel() {
  const choiceCount = Math.min(6, Math.max(state.words.length, 1));
  elements.optionsLabel.textContent = `正しい英語の意味を選んでください（${choiceCount}択）`;
}

function updateQuizHeader() {
  elements.currentCategory.textContent = state.selectedCategory || "全カテゴリ";
  elements.qTotal.textContent = String(state.words.length);
  elements.backToCategoriesBtn.classList.toggle("hidden", !state.categories.length);
  updateOptionsLabel();
}

function updateModeButtons() {
  const orderActive = state.mode === "order";
  elements.modeOrderBtn.classList.toggle("mode-active", orderActive);
  elements.modeOrderBtn.classList.toggle("mode-inactive", !orderActive);
  elements.modeShuffleBtn.classList.toggle("mode-active", !orderActive);
  elements.modeShuffleBtn.classList.toggle("mode-inactive", orderActive);
}

function setMode(mode) {
  state.mode = mode;
  localStorage.setItem(CONFIG.modeStorageKey || "korean-flashcard-mode", state.mode);
  updateModeButtons();
}

function getCurrentWord() {
  const index = state.deck[state.pos];
  return state.words[index];
}

function clearFeedback() {
  elements.result.textContent = "";
  elements.result.className = "result";
  elements.correctAnswer.textContent = "";
  elements.exKo.textContent = "";
  elements.exEn.textContent = "";
  elements.exJp.textContent = "";
  state.currentExampleKo = "";
}

function buildOptions() {
  const currentWord = getCurrentWord();
  const currentIndex = state.deck[state.pos];

  const wrongChoices = shuffleArray(
    state.words
      .map((word, index) => ({ word, index }))
      .filter((item) => item.index !== currentIndex)
  ).slice(0, 5);

  const choices = shuffleArray([
    { text: currentWord.en, correct: true },
    ...wrongChoices.map((item) => ({ text: item.word.en, correct: false }))
  ]);

  elements.options.innerHTML = "";

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mc-option";
    button.textContent = choice.text;
    button.dataset.correct = String(choice.correct);
    button.addEventListener("click", () => handleChoice(button));
    elements.options.appendChild(button);
  });
}

function getWordsForCategory(categoryName) {
  if (!categoryName) {
    return [...state.allWords];
  }
  return state.allWords.filter((word) => word.category === categoryName);
}

function createSelectionButton({ label, countText, description = "", className = "", onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `category-btn ${className}`.trim();
  button.addEventListener("click", onClick);

  const main = document.createElement("div");
  main.className = "category-main";

  const name = document.createElement("span");
  name.className = "category-name";
  name.textContent = label;
  main.appendChild(name);

  if (description) {
    const note = document.createElement("span");
    note.className = "category-note";
    note.textContent = description;
    main.appendChild(note);
  }

  const side = document.createElement("div");
  side.className = "category-side";

  const count = document.createElement("span");
  count.className = "category-count";
  count.textContent = countText;

  const arrow = document.createElement("span");
  arrow.className = "category-arrow";
  arrow.textContent = ">";

  side.append(count, arrow);
  button.append(main, side);
  return button;
}

function renderCategoryButtons() {
  elements.quickActionButtons.innerHTML = "";
  elements.categoryButtons.innerHTML = "";
  elements.categoryCountBadge.textContent = `${state.categories.length}カテゴリ`;

  const allButton = createSelectionButton({
    label: "全カテゴリ",
    countText: `${state.allWords.length}問`,
    description: "登録されている全問題を順番に学習",
    className: "category-btn-primary",
    onClick: () => startQuiz("", { mode: "order" })
  });

  elements.quickActionButtons.appendChild(allButton);

  state.categories.forEach((category) => {
    const button = createSelectionButton({
      label: category.name,
      countText: `${category.count}問`,
      description: "このカテゴリだけで演習",
      onClick: () => startQuiz(category.name)
    });
    elements.categoryButtons.appendChild(button);
  });
}

function showCategoryPicker() {
  elements.categorySummary.textContent =
    `全${state.allWords.length}問 / ${state.categories.length}カテゴリ。カテゴリが増えるとここも自動で増えます。`;
  elements.currentCategory.textContent = "未選択";
  elements.qIndex.textContent = "0";
  elements.qTotal.textContent = "0";
  elements.koWord.textContent = "カテゴリを選ぶと問題が始まります";
  elements.options.innerHTML = "";
  clearFeedback();
  renderCategoryButtons();
  setScreen(false);
}

function showQuestion() {
  if (!state.words.length) {
    return;
  }

  updateQuizHeader();
  const currentWord = getCurrentWord();
  elements.koWord.textContent = currentWord.ko;
  elements.qIndex.textContent = String(state.pos + 1);
  clearFeedback();
  buildOptions();
}

function handleChoice(selectedButton) {
  const currentWord = getCurrentWord();
  const isCorrect = selectedButton.dataset.correct === "true";

  elements.result.textContent = isCorrect ? "正解です" : "不正解です";
  elements.result.className = `result ${isCorrect ? "correct" : "incorrect"}`;
  elements.correctAnswer.textContent = `正解: ${currentWord.en}`;

  const buttons = elements.options.querySelectorAll(".mc-option");
  buttons.forEach((button) => {
    button.disabled = true;
    if (button.dataset.correct === "true") {
      button.classList.add("correct-choice");
    } else if (button === selectedButton && !isCorrect) {
      button.classList.add("wrong-choice");
    }
  });

  elements.exKo.textContent = currentWord.exampleKoDisplay;
  elements.exEn.textContent = currentWord.exampleEn;
  elements.exJp.textContent = currentWord.exampleJp;
  state.currentExampleKo = currentWord.exampleKoTts || currentWord.exampleKoDisplay;
}

function moveQuestion(step) {
  if (!state.deck.length) {
    return;
  }
  state.pos = (state.pos + step + state.deck.length) % state.deck.length;
  showQuestion();
}

function startQuiz(categoryName, { mode } = {}) {
  if (mode) {
    setMode(mode);
  }
  state.selectedCategory = categoryName;
  state.words = getWordsForCategory(categoryName);
  elements.errorMessage.textContent = "";

  if (!state.words.length) {
    throw new Error("このカテゴリには表示できる問題がありません。");
  }

  buildDeck();
  updateModeButtons();
  setScreen(true);
  showQuestion();
}

function bindEvents() {
  elements.reloadBtn.addEventListener("click", async () => {
    const keepCategoryPicker = !elements.startScreen.classList.contains("hidden");
    try {
      await initializeQuiz({ openCategoryPicker: keepCategoryPicker });
    } catch (error) {
      showError(error);
    }
  });

  elements.backToCategoriesBtn.addEventListener("click", () => {
    showCategoryPicker();
  });

  elements.nextBtn.addEventListener("click", () => moveQuestion(1));
  elements.prevBtn.addEventListener("click", () => moveQuestion(-1));

  elements.speakKo.addEventListener("click", () => {
    const currentWord = getCurrentWord();
    speak(currentWord?.ko, "ko-KR");
  });

  elements.speakEn.addEventListener("click", () => {
    const currentWord = getCurrentWord();
    speak(currentWord?.en, "en-US");
  });

  elements.exSpeakKo.addEventListener("click", () => {
    speak(state.currentExampleKo, "ko-KR");
  });

  elements.modeOrderBtn.addEventListener("click", () => {
    setMode("order");
    buildDeck();
    showQuestion();
  });

  elements.modeShuffleBtn.addEventListener("click", () => {
    setMode("shuffle");
    buildDeck();
    showQuestion();
  });

  elements.memoBox.value = localStorage.getItem(CONFIG.memoStorageKey || "korean-flashcard-memo") || "";
  elements.memoBox.addEventListener("input", (event) => {
    localStorage.setItem(CONFIG.memoStorageKey || "korean-flashcard-memo", event.target.value);
  });
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  elements.errorMessage.textContent = message;
  setScreen(true);
  elements.currentCategory.textContent = "-";
  elements.qIndex.textContent = "0";
  elements.qTotal.textContent = "0";
  elements.koWord.textContent = "データを読み込めませんでした";
  elements.options.innerHTML = "";
  clearFeedback();
}

async function initializeQuiz({ openCategoryPicker = false } = {}) {
  await loadWords();

  if (state.categories.length) {
    const canResumeCurrentCategory =
      !openCategoryPicker &&
      (!state.selectedCategory || state.categories.some((category) => category.name === state.selectedCategory));

    if (canResumeCurrentCategory) {
      startQuiz(state.selectedCategory);
      return;
    }

    showCategoryPicker();
    return;
  }

  startQuiz("");
}

applyConfig();
bindEvents();
initializeQuiz({ openCategoryPicker: true }).catch(showError);
