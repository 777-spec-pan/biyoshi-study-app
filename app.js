let currentQuestions = [];
let currentIndex = 0;
let currentScore = 0;
let currentMode = "random";
let answered = false;

const STORAGE_KEY = "biyoshiMasterStatsV1";

function getStats() {
  const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"answered":0,"correct":0,"wrongIds":[],"daily":{},"studyDates":[]}');
  s.daily = s.daily || {};
  s.studyDates = s.studyDates || [];
  return s;
}
function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}
function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}
function showOnly(id) {
  ["homeScreen","officialScreen","examScreen","categoryScreen","quizScreen","resultScreen"].forEach(x => {
    document.getElementById(x).classList.toggle("hidden", x !== id);
  });
}
function dateKey(d = new Date()) { return d.toISOString().slice(0,10); }
function calcStreak(dates) {
  const set = new Set(dates || []);
  let d = new Date(), n = 0;
  if (!set.has(dateKey(d))) d.setDate(d.getDate()-1);
  while (set.has(dateKey(d))) { n++; d.setDate(d.getDate()-1); }
  return n;
}
function updateHomeStats() {
  const s = getStats(), today = dateKey();
  document.getElementById("todayAnswered").textContent = s.daily[today] || 0;
  document.getElementById("totalAnswered").textContent = s.answered;
  document.getElementById("accuracy").textContent = s.answered ? Math.round(s.correct / s.answered * 100) + "%" : "0%";
  document.getElementById("wrongCount").textContent = s.wrongIds.length;
  document.getElementById("streakDays").textContent = calcStreak(s.studyDates) + "日";
}
function goHome() {
  showOnly("homeScreen");
  updateHomeStats();
}
function showOfficialExams() {
  showOnly("officialScreen");
}
function showExams() {
  const list = document.getElementById("examList");
  list.innerHTML = "";
  [...new Set(QUESTIONS.map(q => q.exam))].sort((a,b)=>b-a).forEach(exam => {
    const btn = document.createElement("button");
    const count = QUESTIONS.filter(q => q.exam === exam).length;
    btn.className = "category-button";
    btn.textContent = `第${exam}回（${count}問）`;
    btn.onclick = () => startQuiz("exam", exam);
    list.appendChild(btn);
  });
  showOnly("examScreen");
}
function showCategories() {
  const list = document.getElementById("categoryList");
  list.innerHTML = "";
  APP_CONFIG.categories.forEach(category => {
    const count = QUESTIONS.filter(q => q.category === category).length;
    const btn = document.createElement("button");
    btn.className = "category-button";
    btn.textContent = `${category}（${count}問）`;
    btn.onclick = () => startQuiz("category", category);
    list.appendChild(btn);
  });
  showOnly("categoryScreen");
}
function startQuiz(mode, category = null) {
  currentMode = mode;
  let pool = [];
  if (mode === "wrong") {
    const wrongIds = getStats().wrongIds;
    pool = QUESTIONS.filter(q => wrongIds.includes(q.id));
    if (!pool.length) {
      alert("復習する問題はまだありません。まず通常問題に挑戦してください。");
      return;
    }
  } else if (mode === "category") {
    pool = QUESTIONS.filter(q => q.category === category);
  } else if (mode === "exam") {
    pool = QUESTIONS.filter(q => q.exam === category);
  } else {
    pool = QUESTIONS;
  }
  currentQuestions = shuffle(pool).slice(0, mode === "exam" ? pool.length : APP_CONFIG.randomQuestionCount);
  currentIndex = 0;
  currentScore = 0;
  showOnly("quizScreen");
  renderQuestion();
}
function startMockExam() {
  currentMode = "mock";
  currentQuestions = shuffle(QUESTIONS).slice(0, Math.min(APP_CONFIG.mockQuestionCount, QUESTIONS.length));
  currentIndex = 0;
  currentScore = 0;
  showOnly("quizScreen");
  renderQuestion();
}
function renderQuestion() {
  answered = false;
  const q = currentQuestions[currentIndex];
  document.getElementById("progressText").textContent = `${currentIndex + 1} / ${currentQuestions.length}`;
  document.getElementById("progressBar").style.width = `${(currentIndex / currentQuestions.length) * 100}%`;
  document.getElementById("categoryBadge").textContent = q.category;
  document.getElementById("questionText").textContent = q.question;
  document.getElementById("resultBox").className = "result-box hidden";
  document.getElementById("nextButton").className = "primary-btn hidden";
  const choices = document.getElementById("choices");
  choices.innerHTML = "";
  q.choices.forEach((choice, index) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = `${index + 1}. ${choice}`;
    btn.onclick = () => answerQuestion(index);
    choices.appendChild(btn);
  });
}
function answerQuestion(selected) {
  if (answered) return;
  answered = true;
  const q = currentQuestions[currentIndex];
  const correct = selected === q.answer;
  const buttons = [...document.querySelectorAll(".choice-btn")];
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add("correct");
    if (i === selected && !correct) btn.classList.add("wrong");
  });

  const s = getStats();
  s.answered += 1;
  const today = dateKey();
  s.daily[today] = (s.daily[today] || 0) + 1;
  if (!s.studyDates.includes(today)) s.studyDates.push(today);
  if (correct) {
    currentScore += 1;
    s.correct += 1;
    s.wrongIds = s.wrongIds.filter(id => id !== q.id);
  } else if (!s.wrongIds.includes(q.id)) {
    s.wrongIds.push(q.id);
  }
  saveStats(s);

  const result = document.getElementById("resultBox");
  result.className = `result-box ${correct ? "correct" : "wrong"}`;
  result.innerHTML = `<strong>${correct ? "正解です" : "不正解です"}</strong><br>${q.explanation}`;
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
  const rate = Math.round(currentScore / currentQuestions.length * 100);
  document.getElementById("scoreText").textContent = `${currentScore}/${currentQuestions.length}`;
  document.getElementById("resultMessage").textContent =
    rate >= APP_CONFIG.passingRate ? `正答率${rate}％。合格ライン相当です。` : `正答率${rate}％。間違い復習で定着させましょう。`;
  showOnly("resultScreen");
}
function quitQuiz() {
  if (confirm("学習を終了してホームに戻りますか？")) goHome();
}

document.getElementById("appTitle").textContent = APP_CONFIG.appName;
document.getElementById("versionBadge").textContent = APP_CONFIG.version;
updateHomeStats();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
