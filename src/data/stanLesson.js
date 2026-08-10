import curriculum from "../../content/stan/curriculum.json";
import assessments from "../../content/stan/foundation-assessments.json";

function cleanInline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^>\s*/, "")
    .trim();
}

function flushParagraph(lines, target) {
  if (lines.length === 0) return;
  const text = cleanInline(lines.join(" ").replace(/\s+/g, " "));
  if (text) target.push(text);
  lines.length = 0;
}

function tableToParagraph(lines) {
  const rows = lines
    .map((line) => line.split("|").slice(1, -1).map((cell) => cleanInline(cell)))
    .filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
  if (rows.length < 2) return cleanInline(lines.join(" "));
  const [headers, ...body] = rows;
  return body
    .map((cells) => cells.map((cell, index) => `${headers[index] || `列${index + 1}`}: ${cell}`).join(" / "))
    .join("。 ");
}

function languageLabel(language) {
  if (language === "stan") return "Stan";
  if (language === "r") return "R";
  if (["bash", "sh", "shell"].includes(language)) return "ターミナル";
  return language ? language.toUpperCase() : "CODE";
}

export function manuscriptToPages(markdown, outcome) {
  const pages = [];
  let page = null;
  let prose = [];
  let table = [];
  let code = [];
  let codeLanguage = "";
  let inCode = false;
  let afterCode = false;
  let continuation = 1;

  const target = () => (afterCode ? page.a : page.b);
  const flushTable = () => {
    if (!page || table.length === 0) return;
    target().push(tableToParagraph(table));
    table = [];
  };
  const flushText = () => {
    if (!page) return;
    flushTable();
    flushParagraph(prose, target());
  };
  const pushPage = () => {
    if (!page) return;
    flushText();
    if (page.b.length || page.a.length || page.code) pages.push(page);
    page = null;
  };
  const startPage = (title) => {
    pushPage();
    page = { t: cleanInline(title), b: [], a: [] };
    continuation = 1;
    afterCode = false;
  };
  const startContinuation = () => {
    const title = `${page.t}（続き ${continuation}）`;
    continuation += 1;
    pushPage();
    page = { t: title, b: [], a: [] };
    afterCode = false;
  };

  for (const rawLine of markdown.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (/^##\s+(内容理解問題|直接評価|公式資料)/.test(line)) break;
    if (/^#\s+/.test(line) || (!page && (/^>/.test(line) || line.trim() === ""))) continue;

    const section = line.match(/^##\s+(.+)$/);
    if (section) {
      startPage(section[1]);
      continue;
    }
    if (!page) continue;

    const fence = line.match(/^```\s*([^\s]*)/);
    if (fence) {
      if (!inCode) {
        flushText();
        if (page.code) startContinuation();
        inCode = true;
        codeLanguage = fence[1].toLowerCase();
        code = [];
      } else {
        page.code = code.join("\n").trimEnd();
        page.lang = languageLabel(codeLanguage);
        page.verify = {
          mode: "manual",
          reason: "Stan編のコード例はCmdStanR・CmdStan環境で学習者が段階的に実行するため",
        };
        inCode = false;
        afterCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(rawLine);
      continue;
    }

    const subsection = line.match(/^###\s+(.+)$/);
    if (subsection) {
      flushText();
      target().push(`【${cleanInline(subsection[1])}】`);
      continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      flushParagraph(prose, target());
      table.push(line.trim());
      continue;
    }
    if (table.length) flushTable();
    if (line.trim() === "") {
      flushParagraph(prose, target());
      continue;
    }
    if (/^(?:[-*]|\d+\.)\s+/.test(line.trim())) {
      flushParagraph(prose, target());
      target().push(cleanInline(line.trim().replace(/^(?:[-*]|\d+\.)\s+/, "・")));
      continue;
    }
    prose.push(line.trim());
  }
  pushPage();

  if (pages.length === 0) throw new Error("Stan manuscript produced no lesson pages");
  pages[0].b.unshift(`このレッスンでは、${outcome}ようになります。`);
  return pages;
}

function questionToExercise(question) {
  const language = /(?:^|\n)\s*(?:data|transformed data|parameters|transformed parameters|model|generated quantities)\s*\{|target\s*\+=|~\s*[a-z_]+\s*\(/m.test(question.code || "")
    ? "Stan"
    : "R";
  const codeMeta = question.code
    ? {
        code: question.code,
        lang: language,
        verify: {
          mode: "manual",
          reason: "Stan編の評価用コードは誤りの診断や未完成箇所を含むため",
        },
      }
    : {};
  if (question.choices) {
    return {
      k: "choice",
      q: question.prompt,
      ...codeMeta,
      opts: question.choices.map((choice) => choice.text),
      ans: question.choices.findIndex((choice) => choice.id === question.correctChoiceId),
      why: question.correctFeedback,
      hint: question.retryHint,
    };
  }

  return {
    k: "reflect",
    q: [question.scenario, question.prompt].filter(Boolean).join("\n\n"),
    ...codeMeta,
    minLength: 40,
    rubric: question.rubric.map((item) => item.criterion),
    example: question.modelAnswer,
  };
}

function practiceForLesson(lesson) {
  return {
    title: "成果物チェック",
    intro: "理解問題とは別に、手元のコードと記録を使って到達目標を実際に確かめます。チェック内容はこのブラウザにだけ保存されます。",
    items: lesson.directEvidence.map((evidence, index) => ({
      id: `evidence-${index + 1}`,
      label: evidence.artifact,
      criterion: evidence.criterion,
    })),
  };
}

export function buildStanLesson(lessonId, manuscript) {
  const lesson = curriculum.lessons.find((item) => item.id === lessonId);
  const assessment = assessments.lessons.find((item) => item.lessonId === lessonId);
  if (!lesson || !assessment) throw new Error(`Unknown Stan lesson: ${lessonId}`);

  return {
    id: lesson.id,
    title: lesson.title,
    tag: lesson.concepts.slice(0, 3).join("・"),
    pages: manuscriptToPages(manuscript, lesson.outcome),
    ex: assessment.questions.map(questionToExercise),
    practice: practiceForLesson(lesson),
  };
}

export const STAN_OUTCOMES = curriculum.lessons.map((lesson) => {
  const assessment = assessments.lessons.find((item) => item.lessonId === lesson.id);
  const questionEvidence = assessment.questions.map((question, exerciseIndex) => ({
    kind: "exercise",
    exerciseIndex,
    method: question.choices ? "selected-response" : "constructed-response",
    strength: question.evidenceStrength,
    dimensions: question.targetDimensions,
    criterion: question.choices ? question.correctFeedback : question.rubric.map((item) => item.criterion).join("。"),
  }));
  const coreDimensions = lesson.outcomeDimensions.filter((dimension) => dimension !== "transfer");
  const practiceEvidence = lesson.directEvidence.map((evidence, index) => ({
    kind: "practice",
    itemId: `evidence-${index + 1}`,
    method: "self-attested-performance",
    strength: "direct",
    dimensions: index === lesson.directEvidence.length - 1 && lesson.outcomeDimensions.includes("transfer")
      ? ["transfer"]
      : coreDimensions,
    criterion: evidence.criterion,
  }));

  return {
    lessonId: lesson.id,
    goalId: `stan-${lesson.id}-workflow`,
    statement: lesson.outcome,
    level: "perform",
    dimensions: lesson.outcomeDimensions,
    evidence: [...questionEvidence, ...practiceEvidence],
  };
});
