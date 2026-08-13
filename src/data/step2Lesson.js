import curriculum from "../../content/step2/curriculum.json";
import assessments from "../../content/step2/assessments.json";

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
  return language === "r" ? "R" : language ? language.toUpperCase() : "CODE";
}

export function step2ManuscriptToPages(markdown, outcome) {
  const pages = [];
  let page = null;
  let prose = [];
  let table = [];
  let code = [];
  let codeLanguage = "";
  let inCode = false;
  let capturesOutput = false;
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
        codeLanguage = fence[1].toLowerCase();
        capturesOutput = codeLanguage === "text" && Boolean(page.code) && !page.out;
        if (!capturesOutput && page.code) startContinuation();
        inCode = true;
        code = [];
      } else {
        const value = code.join("\n").trimEnd();
        if (capturesOutput) {
          page.out = value;
        } else {
          page.code = value;
          page.lang = languageLabel(codeLanguage);
          page.verify = {
            mode: "manual",
            reason: "配布データを使い、学習者のR環境で段階的に実行するコード例のため",
          };
        }
        inCode = false;
        capturesOutput = false;
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

  if (pages.length === 0) throw new Error("STEP 2 manuscript produced no lesson pages");
  if (pages[0].b[0]?.endsWith("できるようになります。")) pages[0].b.shift();
  pages[0].b.unshift(`このレッスンでは、${outcome}ようになります。`);
  return pages;
}

function questionToExercise(question) {
  const codeMeta = question.code
    ? {
        code: question.code,
        lang: "R",
        verify: {
          mode: "manual",
          reason: "結果を予想してから、配布データを使って手元のRで確かめる問題のため",
        },
      }
    : {};
  if (question.choices) {
    return {
      k: "choice",
      reviewLabel: question.reviewLabel,
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
    reviewLabel: question.reviewLabel,
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
    intro: "理解問題とは別に、手元のRで成果物を作り、説明できることを確かめます。チェック内容はこのブラウザにだけ保存されます。",
    items: lesson.directEvidence.map((evidence, index) => ({
      id: `evidence-${index + 1}`,
      label: evidence.artifact,
      criterion: evidence.criterion,
    })),
  };
}

const STEP2_LADDERS = {
  "step2-describe-distributions": {
    skill: "試行と参加者を区別し、参加者×条件で要約する",
    tasks: [
      {
        task: "本文のコードを実行し、960行・884正答試行・24名を別々に確認します。",
        criterion: "3つの数を、それぞれ何の件数か説明できたら完了です。",
      },
      {
        task: "group_byへconditionだけを指定した場合の行数を予想し、元の指定と比べます。",
        criterion: "出力の1行の意味が、グループ化する列で変わると説明できたら完了です。",
      },
      {
        task: "例を閉じ、正答試行から参加者×条件の48行を作るコードを書きます。",
        criterion: "group_by、summarise、n、mean、medianを見ずに接続できたら完了です。",
      },
      {
        task: "30名×7日の日誌データで、学生×曜日種別の要約表を設計します。",
        criterion: "列名が変わっても『誰の、どの条件』を1行にするか決められたら完了です。",
      },
    ],
  },
  "step2-grammar-of-graphics": {
    skill: "問いと変数型から対応付けと図形を選ぶ",
    tasks: [
      {
        task: "48行の要約表から、本文の箱ひげと参加者点の図を再現します。",
        criterion: "箱2つと点48個を確認し、各層の役割を説明できたら完了です。",
      },
      {
        task: "点の色だけを条件に対応付け、固定色との違いを予想して確かめます。",
        criterion: "aes内の列への対応付けと、aes外の固定値を区別できたら完了です。",
      },
      {
        task: "例を閉じ、カテゴリをx、連続量をyに置き、箱ひげと全点を重ねます。",
        criterion: "ggplot、aes、geomを見ずに正しい順で書けたら完了です。",
      },
      {
        task: "3品種×収量kgのデータに合う図、軸、単位、注記を設計します。",
        criterion: "別の場面でも個々の点と分布要約を残す理由を説明できたら完了です。",
      },
    ],
  },
  "step2-show-individuals": {
    skill: "同じ参加者の測定値を結び、個人差を読む",
    tasks: [
      {
        task: "本文の対応図を再現し、24本の線と48点を確認します。",
        criterion: "1本の線が同じ参加者の2条件を結ぶと説明できたら完了です。",
      },
      {
        task: "groupをidからconditionへ変えた図を予想し、なぜ誤るか確かめます。",
        criterion: "線を分ける単位を、問いに合わせて選べたら完了です。",
      },
      {
        task: "例を閉じ、idごとに2条件を結ぶ点と線の図を書きます。",
        criterion: "factorの順序、group、line、pointを見ずに指定できたら完了です。",
      },
      {
        task: "18名の介入前後の血圧データへ対応図を移します。",
        criterion: "別の場面でも対応キー、単位、図だけでは言えないことを示せたら完了です。",
      },
    ],
  },
  "step2-report-and-transfer": {
    skill: "図と表を再生成し、観察結果と限界を報告する",
    tasks: [
      {
        task: "入口スクリプトを実行し、2図・3CSV・探索メモを作ります。",
        criterion: "6ファイルの役割と保存場所を説明できたら完了です。",
      },
      {
        task: "図の幅だけを6 inchへ変え、保存されるpixel数を予想して確かめます。",
        criterion: "inchとdpiから画像寸法を計算できたら完了です。",
      },
      {
        task: "例を閉じ、保存対象・名前・幅・高さ・単位・dpiを含むggsaveを書きます。",
        criterion: "画面のExport操作に頼らず、保存条件をコードへ残せたら完了です。",
      },
      {
        task: "通常睡眠日と睡眠制限日の覚醒度データで2図と報告文を設計します。",
        criterion: "別の場面でも分布・対応・観察・限界を分けて説明できたら完了です。",
      },
    ],
  },
};

const PRACTICE_STAGES = [
  { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。" },
  { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。" },
  { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。" },
  { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。" },
];

function practiceLadderForLesson(lessonId) {
  const ladder = STEP2_LADDERS[lessonId];
  return {
    title: "4段階の反復練習",
    intro: `今回くり返す技能は「${ladder.skill}」です。各段階は、実際にRで確かめてからチェックしてください。`,
    steps: PRACTICE_STAGES.map((stage, index) => ({
      ...stage,
      ...ladder.tasks[index],
    })),
  };
}

export function buildStep2Lesson(lessonId, manuscript) {
  const lesson = curriculum.lessons.find((item) => item.id === lessonId);
  const assessment = assessments.lessons.find((item) => item.lessonId === lessonId);
  if (!lesson || !assessment) throw new Error(`Unknown STEP 2 lesson: ${lessonId}`);

  return {
    id: lesson.id,
    title: lesson.title,
    tag: lesson.concepts.slice(0, 3).join("・"),
    pages: step2ManuscriptToPages(manuscript, lesson.outcome),
    ex: [...assessment.questions, ...assessment.reviewQuestions].map(questionToExercise),
    practice: practiceForLesson(lesson),
    practiceLadder: practiceLadderForLesson(lesson.id),
    challenge: assessment.challenge,
  };
}

function buildOutcome(lesson) {
  const assessment = assessments.lessons.find((item) => item.lessonId === lesson.id);
  const coreDimensions = lesson.outcomeDimensions.filter((dimension) => dimension !== "transfer");
  const questionEvidence = assessment.questions.map((question, exerciseIndex) => ({
    kind: "exercise",
    exerciseIndex,
    method: question.choices ? "selected-response" : "constructed-response",
    strength: question.evidenceStrength,
    dimensions: question.targetDimensions,
    criterion: question.choices
      ? question.correctFeedback
      : question.rubric.map((item) => item.criterion).join("。"),
  }));
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
    goalId: `${lesson.id}-workflow`,
    statement: lesson.outcome,
    level: "perform",
    dimensions: lesson.outcomeDimensions,
    evidence: [...questionEvidence, ...practiceEvidence],
  };
}

export const STEP2_OUTCOMES = curriculum.lessons.map(buildOutcome);
