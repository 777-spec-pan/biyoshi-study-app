let currentQuestions = [];
let currentIndex = 0;
let currentScore = 0;
let currentMode = "random";
let answered = false;
let sessionResults = [];
let timerId = null;
let remainingSeconds = 0;
let waitingWorker = null;

const STORAGE_KEY = "biyoshiMasterStatsV2";

function defaultStats() {
  return {
    answered: 0,
    correct: 0,
    wrongIds: [],
    favoriteIds: [],
    daily: {},
    studyDates: [],
    categoryStats: {}
  };
}

function getStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultStats(),
      ...saved,
      wrongIds: Array.isArray(saved.wrongIds) ? saved.wrongIds : [],
      favoriteIds: Array.isArray(saved.favoriteIds) ? saved.favoriteIds : [],
      daily: saved.daily || {},
      studyDates: Array.isArray(saved.studyDates) ? saved.studyDates : [],
      categoryStats: saved.categoryStats || {}
    };
  } catch {
    return defaultStats();
  }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dateKey(date = new Date()) {
  return date.toLocaleDateString("sv-SE");
}

function calcStreak(dates) {
  const set = new Set(dates || []);
  const d = new Date();
  let count = 0;
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dateKey(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function showOnly(id) {
  ["homeScreen","officialScreen","examScreen","categoryScreen","searchScreen","quizScreen","resultScreen"].forEach(screenId => {
    document.getElementById(screenId).classList.toggle("hidden", screenId !== id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHomeStats() {
  const stats = getStats();
  const today = dateKey();
  document.getElementById("todayAnswered").textContent = stats.daily[today] || 0;
  document.getElementById("totalAnswered").textContent = stats.answered;
  document.getElementById("accuracy").textContent =
    stats.answered ? `${Math.round(stats.correct / stats.answered * 100)}%` : "0%";
  document.getElementById("wrongCount").textContent = stats.wrongIds.length;
  document.getElementById("favoriteCount").textContent = stats.favoriteIds.length;
  document.getElementById("streakDays").textContent = `${calcStreak(stats.studyDates)}日`;
  document.getElementById("questionCountText").textContent = `収録問題 ${QUESTIONS.length}問`;
}

function goHome() {
  stopTimer();
  showOnly("homeScreen");
  updateHomeStats();
}

function showOfficialExams() {
  showOnly("officialScreen");
}

function showExams() {
  const list = document.getElementById("examList");
  list.innerHTML = "";
  const exams = [...new Set(QUESTIONS.map(q => q.exam).filter(Boolean))].sort((a, b) => b - a);

  if (!exams.length) {
    list.innerHTML = '<div class="empty-state">収録問題がまだありません。</div>';
  }

  exams.forEach(exam => {
    const count = QUESTIONS.filter(q => q.exam === exam).length;
    const button = document.createElement("button");
    button.className = "category-button";
    button.textContent = `第${exam}回（${count}問）`;
    button.onclick = () => startQuiz("exam", exam);
    list.appendChild(button);
  });
  showOnly("examScreen");
}

function showCategories() {
  const list = document.getElementById("categoryList");
  list.innerHTML = "";

  APP_CONFIG.categories.forEach(category => {
    const count = QUESTIONS.filter(q => q.category === category).length;
    const button = document.createElement("button");
    button.className = "category-button";
    button.textContent = `${category}（${count}問）`;
    button.disabled = count === 0;
    button.onclick = () => startQuiz("category", category);
    list.appendChild(button);
  });
  showOnly("categoryScreen");
}

function showSearch() {
  document.getElementById("searchInput").value = "";
  renderSearchResults();
  showOnly("searchScreen");
}

function renderSearchResults() {
  const keyword = (document.getElementById("searchInput").value || "").trim().toLowerCase();
  const results = keyword
    ? QUESTIONS.filter(q => [
        q.question,
        q.explanation,
        q.category,
        ...(q.choices || [])
      ].join(" ").toLowerCase().includes(keyword))
    : QUESTIONS;

  document.getElementById("searchSummary").textContent = `${results.length}問見つかりました`;
  const container = document.getElementById("searchResults");
  container.innerHTML = "";

  results.forEach(q => {
    const article = document.createElement("article");
    article.className = "search-item";
    const button = document.createElement("button");
    button.innerHTML = `
      <strong>第${q.exam || "-"}回・問${q.number || "-"}</strong>
      <span>${escapeHtml(q.question)}</span>
      <small>${escapeHtml(q.category || "未分類")}</small>`;
    button.onclick = () => startSpecificQuestion(q.id);
    article.appendChild(button);
    container.appendChild(article);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}

function startSpecificQuestion(id) {
  const question = QUESTIONS.find(q => q.id === id);
  if (!question) return;
  currentMode = "search";
  currentQuestions = [question];
  beginSession();
}

function startQuiz(mode, value = null) {
  currentMode = mode;
  let pool = [];

  if (mode === "wrong") {
    const ids = getStats().wrongIds;
    pool = QUESTIONS.filter(q => ids.includes(q.id));
    if (!pool.length) return alert("復習する問題はまだありません。");
  } else if (mode === "favorite") {
    const ids = getStats().favoriteIds;
    pool = QUESTIONS.filter(q => ids.includes(q.id));
    if (!pool.length) return alert("お気に入り問題はまだありません。問題画面の☆を押して保存してください。");
  } else if (mode === "category") {
    pool = QUESTIONS.filter(q => q.category === value);
  } else if (mode === "exam") {
    pool = QUESTIONS.filter(q => q.exam === value);
  } else {
    pool = QUESTIONS;
  }

  if (!pool.length) return alert("この学習モードには、まだ問題がありません。");

  const limit = ["exam","wrong","favorite"].includes(mode)
    ? pool.length
    : APP_CONFIG.randomQuestionCount;

  currentQuestions = shuffle(pool).slice(0, limit);
  beginSession();
}

function startMockExam() {
  if (!QUESTIONS.length) return alert("収録問題がありません。");
  currentMode = "mock";
  currentQuestions = shuffle(QUESTIONS).slice(0, Math.min(APP_CONFIG.mockQuestionCount, QUESTIONS.length));
  beginSession();
  startTimer(APP_CONFIG.examMinutes * 60);
}

function beginSession() {
  stopTimer();
  currentIndex = 0;
  currentScore = 0;
  sessionResults = [];
  showOnly("quizScreen");
  renderQuestion();
}

function renderQuestion() {
  answered = false;
  const question = currentQuestions[currentIndex];
  if (!question) return showResult();

  document.getElementById("progressText").textContent = `${currentIndex + 1} / ${currentQuestions.length}`;
  document.getElementById("progressBar").style.width = `${currentIndex / currentQuestions.length * 100}%`;
  document.getElementById("categoryBadge").textContent = question.category || "未分類";
  document.getElementById("questionNumber").textContent =
    `第${question.exam || "-"}回　問${question.number || currentIndex + 1}`;
  document.getElementById("questionText").textContent = question.question;
  document.getElementById("resultBox").className = "result-box hidden";
  document.getElementById("nextButton").className = "primary-btn hidden";

  updateFavoriteButton();

  const choices = document.getElementById("choices");
  choices.innerHTML = "";
  (question.choices || []).forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice-btn";
    button.textContent = `${index + 1}. ${choice}`;
    button.onclick = () => answerQuestion(index);
    choices.appendChild(button);
  });
}

function answerQuestion(selected) {
  if (answered) return;
  answered = true;

  const question = currentQuestions[currentIndex];
  const correct = selected === question.answer;
  const buttons = [...document.querySelectorAll(".choice-btn")];

  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === question.answer) button.classList.add("correct");
    if (index === selected && !correct) button.classList.add("wrong");
  });

  const stats = getStats();
  const today = dateKey();
  stats.answered += 1;
  stats.daily[today] = (stats.daily[today] || 0) + 1;
  if (!stats.studyDates.includes(today)) stats.studyDates.push(today);

  const category = question.category || "未分類";
  stats.categoryStats[category] = stats.categoryStats[category] || { answered: 0, correct: 0 };
  stats.categoryStats[category].answered += 1;

  if (correct) {
    currentScore += 1;
    stats.correct += 1;
    stats.categoryStats[category].correct += 1;
    stats.wrongIds = stats.wrongIds.filter(id => id !== question.id);
  } else if (!stats.wrongIds.includes(question.id)) {
    stats.wrongIds.push(question.id);
  }

  saveStats(stats);
  sessionResults.push({ category, correct });

  const result = document.getElementById("resultBox");
  result.className = `result-box ${correct ? "correct" : "wrong"}`;
  result.innerHTML = `
    <strong>${correct ? "正解です" : "不正解です"}</strong><br>
    ${escapeHtml(question.explanation || "解説は準備中です。")}`;

  document.getElementById("nextButton").classList.remove("hidden");
}

function nextQuestion() {
  currentIndex += 1;
  if (currentIndex >= currentQuestions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

function showResult() {
  stopTimer();
  const total = currentQuestions.length || 1;
  const rate = Math.round(currentScore / total * 100);

  document.getElementById("scoreText").textContent = `${currentScore}/${currentQuestions.length}`;
  document.getElementById("resultMessage").textContent =
    rate >= APP_CONFIG.passingRate
      ? `正答率${rate}％。合格ライン相当です。`
      : `正答率${rate}％。間違い復習で定着させましょう。`;

  const grouped = {};
  sessionResults.forEach(item => {
    grouped[item.category] = grouped[item.category] || { answered: 0, correct: 0 };
    grouped[item.category].answered += 1;
    if (item.correct) grouped[item.category].correct += 1;
  });

  const container = document.getElementById("categoryResults");
  container.innerHTML = "";
  Object.entries(grouped).forEach(([category, values]) => {
    const row = document.createElement("div");
    row.className = "category-result-row";
    const categoryRate = Math.round(values.correct / values.answered * 100);
    row.innerHTML = `<span>${escapeHtml(category)}</span><strong>${values.correct}/${values.answered}（${categoryRate}%）</strong>`;
    container.appendChild(row);
  });

  showOnly("resultScreen");
}

function toggleFavorite() {
  const question = currentQuestions[currentIndex];
  if (!question) return;

  const stats = getStats();
  if (stats.favoriteIds.includes(question.id)) {
    stats.favoriteIds = stats.favoriteIds.filter(id => id !== question.id);
  } else {
    stats.favoriteIds.push(question.id);
  }

  saveStats(stats);
  updateFavoriteButton();
}

function updateFavoriteButton() {
  const question = currentQuestions[currentIndex];
  const button = document.getElementById("favoriteButton");
  if (!question || !button) return;
  const isFavorite = getStats().favoriteIds.includes(question.id);
  button.textContent = isFavorite ? "★" : "☆";
  button.classList.toggle("active", isFavorite);
}

function quitQuiz() {
  if (confirm("学習を終了してホームに戻りますか？")) goHome();
}

function startTimer(seconds) {
  remainingSeconds = seconds;
  const timer = document.getElementById("timerText");
  timer.classList.remove("hidden");
  updateTimerText();

  timerId = setInterval(() => {
    remainingSeconds -= 1;
    updateTimerText();
    if (remainingSeconds <= 0) {
      stopTimer();
      alert("試験時間が終了しました。");
      showResult();
    }
  }, 1000);
}

function updateTimerText() {
  const minutes = Math.floor(Math.max(remainingSeconds, 0) / 60);
  const seconds = Math.max(remainingSeconds, 0) % 60;
  document.getElementById("timerText").textContent =
    `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  const timer = document.getElementById("timerText");
  if (timer) timer.classList.add("hidden");
}

function resetLearningData() {
  if (!confirm("回答履歴・間違い・お気に入りをすべて削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  updateHomeStats();
  alert("学習データをリセットしました。");
}

async function checkForUpdate() {
  if (!("serviceWorker" in navigator)) {
    alert("このブラウザでは更新確認を利用できません。");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      await navigator.serviceWorker.register("sw.js");
      alert("更新機能を準備しました。");
      return;
    }
    await registration.update();
    alert("更新を確認しました。新しい版がある場合は画面上部に表示されます。");
  } catch (error) {
    console.error(error);
    alert("更新確認に失敗しました。");
  }
}

function applyUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.location.reload();
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("sw.js");

    if (registration.waiting) {
      waitingWorker = registration.waiting;
      document.getElementById("updateBanner").classList.remove("hidden");
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          document.getElementById("updateBanner").classList.remove("hidden");
        }
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

function initializeApp() {
  if (document.body.dataset.initialized) return;
  document.body.dataset.initialized = "true";

  document.getElementById("appTitle").textContent = APP_CONFIG.appName;
  document.getElementById("versionBadge").textContent = APP_CONFIG.version;
  updateHomeStats();
  registerServiceWorker();
}

window.addEventListener("questionDatabaseReady", initializeApp, { once: true });
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(initializeApp, 1500);
});
