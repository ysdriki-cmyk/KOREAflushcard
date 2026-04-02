const CONFIG = window.APP_CONFIG || {};

const state = {
  words: [],
  mode: localStorage.getItem(CONFIG.modeStorageKey || "korean-flashcard-mode") || "order",
  deck: [],
  pos: 0,
  currentExampleKo: "",
  sourceLabel: ""
};

const elements = {
  appTitle: document.getElementById("appTitle"),
  appSubtitle: document.getElementById("appSubtitle"),
  dataSourceLabel: document.getElementById("dataSourceLabel"),
  reloadBtn: document.getElementById("reloadBtn"),
  qIndex: document.getElementById("qIndex"),
  qTotal: document.getElementById("qTotal"),
  modeOrderBtn: document.getElementById("modeOrderBtn"),
  modeShuffleBtn: document.getElementById("modeShuffleBtn"),
  koWord: document.getElementById("koWord"),
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
      exampleJp: row.example_jp || row.exampleJp || ""
    }))
    .filter((row) => row.ko && row.en);
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
      url: CONFIG.googleSheetCsvUrl,
      label: "Googleスプレッドシート"
    });
  }
  if (CONFIG.fallbackCsvPath) {
    sources.push({
      url: CONFIG.fallbackCsvPath,
      label: "ローカルCSV"
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
      state.words = parsed;
      state.sourceLabel = `${source.label}を使用中`;
      elements.dataSourceLabel.textContent = state.sourceLabel;
      elements.qTotal.textContent = String(state.words.length);
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

function updateModeButtons() {
  const orderActive = state.mode === "order";
  elements.modeOrderBtn.classList.toggle("mode-active", orderActive);
  elements.modeOrderBtn.classList.toggle("mode-inactive", !orderActive);
  elements.modeShuffleBtn.classList.toggle("mode-active", !orderActive);
  elements.modeShuffleBtn.classList.toggle("mode-inactive", orderActive);
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

function showQuestion() {
  if (!state.words.length) {
    return;
  }

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

function bindEvents() {
  elements.reloadBtn.addEventListener("click", async () => {
    elements.dataSourceLabel.textContent = "再読込中...";
    try {
      await initializeQuiz();
    } catch (error) {
      showError(error);
    }
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
    state.mode = "order";
    localStorage.setItem(CONFIG.modeStorageKey || "korean-flashcard-mode", state.mode);
    updateModeButtons();
    buildDeck();
    showQuestion();
  });

  elements.modeShuffleBtn.addEventListener("click", () => {
    state.mode = "shuffle";
    localStorage.setItem(CONFIG.modeStorageKey || "korean-flashcard-mode", state.mode);
    updateModeButtons();
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
  elements.dataSourceLabel.textContent = "データ読込エラー";
  elements.koWord.textContent = "データを読み込めませんでした";
  elements.options.innerHTML = "";
  clearFeedback();
}

async function initializeQuiz() {
  await loadWords();
  updateModeButtons();
  buildDeck();
  showQuestion();
}

applyConfig();
bindEvents();
initializeQuiz().catch(showError);
