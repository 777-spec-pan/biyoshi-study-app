const EXAM_DATA_FILES = ["53", "52", "51", "50"];
let QUESTIONS = [];
let EXAM_DATABASE = [];

async function loadQuestionDatabase() {
  const loaded = [];
  for (const exam of EXAM_DATA_FILES) {
    try {
      const response = await fetch(`data/${exam}.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      loaded.push(data);
    } catch (error) {
      console.warn(`data/${exam}.json を読み込めませんでした`, error);
    }
  }

  EXAM_DATABASE = loaded;
  QUESTIONS = loaded.flatMap(item => Array.isArray(item.questions) ? item.questions : []);

  window.dispatchEvent(new CustomEvent("questionDatabaseReady", {
    detail: { exams: EXAM_DATABASE, questions: QUESTIONS }
  }));
}

loadQuestionDatabase();
