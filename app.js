let currentQuestions = [];
let currentIndex = 0;
let currentScore = 0;
let currentMode = "random";
let answered = false;

const STORAGE_KEY = "biyoshiMasterStatsV1";

function getStats() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"answered":0,"correct":0,"wrongIds":[]}');
}
function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}
function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}
function showOnly(id) {
  ["homeScreen","categoryScreen","quizScreen","resultScreen"].forEach(x => {
    document.getElementById(x).classList.toggle("hidden", x !== id);
  });
}
function updateHomeStats() {
  const s = getStats();
  document.getElementById("totalAnswered").textContent = s.answered;
  document.getElementById("accuracy").textContent = s.answered ? Math.round(s.correct / s.answered * 100) + "%" : "0%";
  document.getElementById("wrongCount").textContent = s.wrongIds.length;
}
function goHome() {
  showOnly("homeScreen");
  updateHomeStats();
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
  } else {
    pool = QUESTIONS;
  }
  currentQuestions = shuffle(pool).slice(0, APP_CONFIG.randomQuestionCount);
  currentIndex = 0;
  currentScore = 0;
  showOnly("quizScreen");
  renderQuestion();
}
function startMockExam() {
  currentMode = "mock";
  currentQuestions = shuffle(QUESTIONS).slice(0, APP_CONFIG.mockQuestionCount);
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
