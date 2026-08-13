import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_LESSONS = [
  "step2-describe-distributions",
  "step2-grammar-of-graphics",
  "step2-show-individuals",
  "step2-report-and-transfer",
];
const ALLOWED_KINDS = new Set([
  "selected-response",
  "output-prediction",
  "constructed-response",
  "transfer-task",
]);
const ALLOWED_PROCESSES = new Set(["explain", "apply", "analyze", "transfer"]);
const ALLOWED_STRENGTHS = new Set(["supporting", "direct"]);
const MIN_CHALLENGE_HINTS = 2;
const MIN_CHALLENGE_RUBRIC_ITEMS = 4;
const MIN_CHALLENGE_EXAMPLE_LENGTH = 80;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function loadStep2Assessments(rootDir = ROOT) {
  const contentDir = join(rootDir, "content", "step2");
  return {
    curriculum: readJson(join(contentDir, "curriculum.json")),
    assessments: readJson(join(contentDir, "assessments.json")),
    manuscripts: new Map([
      [
        "step2-describe-distributions",
        readFileSync(join(contentDir, "l17-descriptive-statistics.md"), "utf8"),
      ],
      [
        "step2-grammar-of-graphics",
        readFileSync(join(contentDir, "l18-grammar-of-graphics.md"), "utf8"),
      ],
      [
        "step2-show-individuals",
        readFileSync(join(contentDir, "l19-individual-differences.md"), "utf8"),
      ],
      [
        "step2-report-and-transfer",
        readFileSync(join(contentDir, "l20-report-and-transfer.md"), "utf8"),
      ],
    ]),
  };
}

function validateChoiceQuestion(question) {
  const errors = [];
  if (!Array.isArray(question.choices) || question.choices.length < 3) {
    return [`${question.id}: 選択肢は3件以上必要です`];
  }
  const choiceIds = question.choices.map((choice) => choice.id);
  if (new Set(choiceIds).size !== choiceIds.length) {
    errors.push(`${question.id}: 選択肢IDが重複しています`);
  }
  if (!choiceIds.includes(question.correctChoiceId)) {
    errors.push(`${question.id}: correctChoiceIdが選択肢にありません`);
  }
  for (const choice of question.choices) {
    if (!choice.text?.trim()) errors.push(`${question.id}:${choice.id}: 選択肢本文がありません`);
    if (!choice.diagnostic?.trim()) {
      errors.push(`${question.id}:${choice.id}: 誤答診断がありません`);
    }
    if (
      choice.id === question.correctChoiceId &&
      choice.diagnostic !== "correct"
    ) {
      errors.push(`${question.id}:${choice.id}: 正答診断はcorrectでなければなりません`);
    }
    if (
      choice.id !== question.correctChoiceId &&
      choice.diagnostic === "correct"
    ) {
      errors.push(`${question.id}:${choice.id}: 誤答がcorrectと診断されています`);
    }
  }
  if (!question.correctFeedback?.trim()) {
    errors.push(`${question.id}: 正答フィードバックがありません`);
  }
  if (question.kind === "output-prediction" && !question.code?.trim()) {
    errors.push(`${question.id}: 出力予測コードがありません`);
  }
  return errors;
}

function validateConstructedQuestion(question) {
  const errors = [];
  if (!Array.isArray(question.rubric) || question.rubric.length < 3) {
    return [`${question.id}: 記述rubricは3観点以上必要です`];
  }
  const rubricIds = question.rubric.map((item) => item.id);
  if (new Set(rubricIds).size !== rubricIds.length) {
    errors.push(`${question.id}: rubric IDが重複しています`);
  }
  for (const item of question.rubric) {
    if (!item.criterion?.trim()) errors.push(`${question.id}:${item.id}: 判定基準がありません`);
  }
  if (!question.modelAnswer?.trim()) errors.push(`${question.id}: レビュー用解答例がありません`);
  if (question.kind === "transfer-task") {
    if (question.responseMode !== "constructed") {
      errors.push(`${question.id}: 転移課題はconstructed回答でなければなりません`);
    }
    if (!question.scenario?.trim()) errors.push(`${question.id}: 未見シナリオがありません`);
  }
  return errors;
}

function validateOptionalChallenge(challenge, lessonId) {
  const errors = [];
  if (!challenge || typeof challenge !== "object") {
    return [`${lessonId}: 任意チャレンジがありません`];
  }
  for (const key of ["title", "scenario", "task", "example"]) {
    if (!challenge[key]?.trim()) errors.push(`${lessonId}: 任意チャレンジの${key}がありません`);
  }
  if (!Array.isArray(challenge.hints) || challenge.hints.length < MIN_CHALLENGE_HINTS) {
    errors.push(`${lessonId}: 任意チャレンジの段階ヒントは${MIN_CHALLENGE_HINTS}件以上必要です`);
  } else if (challenge.hints.some((hint) => !hint?.trim())) {
    errors.push(`${lessonId}: 任意チャレンジに空の段階ヒントがあります`);
  }
  if (!Array.isArray(challenge.rubric) || challenge.rubric.length < MIN_CHALLENGE_RUBRIC_ITEMS) {
    errors.push(`${lessonId}: 任意チャレンジの評価観点は${MIN_CHALLENGE_RUBRIC_ITEMS}件以上必要です`);
  } else {
    if (challenge.rubric.some((criterion) => !criterion?.trim())) {
      errors.push(`${lessonId}: 任意チャレンジに空の評価観点があります`);
    }
    if (new Set(challenge.rubric).size !== challenge.rubric.length) {
      errors.push(`${lessonId}: 任意チャレンジの評価観点が重複しています`);
    }
  }
  if ((challenge.example?.trim().length ?? 0) < MIN_CHALLENGE_EXAMPLE_LENGTH) {
    errors.push(`${lessonId}: 任意チャレンジの解答例は${MIN_CHALLENGE_EXAMPLE_LENGTH}文字以上必要です`);
  }
  return errors;
}

function validateAssessmentContract(content) {
  const errors = [];
  const { assessments, curriculum, manuscripts } = content;

  if (assessments.schemaVersion !== 1) errors.push("assessments.schemaVersionは1である必要があります");
  if (assessments.status !== "published") {
    errors.push("STEP 2理解問題はpublishedでなければなりません");
  }
  if (assessments.designRules?.questionsPerLesson !== 5) {
    errors.push("各レッスンの問題数契約は5でなければなりません");
  }
  if (assessments.designRules?.learnerAnswersAreNotPerformanceEvidence !== true) {
    errors.push("理解問題を実技証拠と区別する契約がありません");
  }
  if (assessments.designRules?.shuffleSelectedResponseChoices !== true) {
    errors.push("選択肢IDを維持した並べ替え契約がありません");
  }
  const lessons = assessments.lessons ?? [];
  if (lessons.map((lesson) => lesson.lessonId).join("|") !== EXPECTED_LESSONS.join("|")) {
    errors.push("理解問題はL17・L18の順で定義する必要があります");
  }

  const allQuestionIds = new Set();
  const questionsById = new Map();
  for (const assessmentLesson of lessons) {
    const curriculumLesson = curriculum.lessons.find(
      (lesson) => lesson.id === assessmentLesson.lessonId,
    );
    if (!curriculumLesson) {
      errors.push(`${assessmentLesson.lessonId}: カリキュラムに対応レッスンがありません`);
      continue;
    }
    if (
      JSON.stringify(assessmentLesson.outcomeDimensions) !==
      JSON.stringify(curriculumLesson.outcomeDimensions)
    ) {
      errors.push(`${assessmentLesson.lessonId}: 到達目標次元がカリキュラムと一致しません`);
    }

    const questions = assessmentLesson.questions ?? [];
    if (questions.length !== assessments.designRules.questionsPerLesson) {
      errors.push(`${assessmentLesson.lessonId}: 理解問題が5件ではありません`);
    }
    const reviewQuestions = assessmentLesson.reviewQuestions ?? [];
    const expectedReviewCount = assessmentLesson.lessonId === EXPECTED_LESSONS[0] ? 0 : 1;
    if (reviewQuestions.length !== expectedReviewCount) {
      errors.push(`${assessmentLesson.lessonId}: 累積復習が${expectedReviewCount}件ではありません`);
    }
    errors.push(...validateOptionalChallenge(assessmentLesson.challenge, assessmentLesson.lessonId));
    const kinds = new Set(questions.map((question) => question.kind));
    for (const requiredKind of assessments.designRules.requiredKinds ?? []) {
      if (!kinds.has(requiredKind)) {
        errors.push(`${assessmentLesson.lessonId}: ${requiredKind}がありません`);
      }
    }

    const coveredDimensions = new Set();
    const correctPositions = [];
    for (const question of questions) {
      if (!/^step2-l(?:17|18|19|20)-q\d-[a-z0-9-]+$/.test(question.id ?? "")) {
        errors.push(`${question.id ?? "IDなし"}: 問題ID形式が不正です`);
      }
      if (allQuestionIds.has(question.id)) errors.push(`${question.id}: 問題IDが重複しています`);
      allQuestionIds.add(question.id);
      questionsById.set(question.id, { ...question, lessonId: assessmentLesson.lessonId });

      if (!ALLOWED_KINDS.has(question.kind)) errors.push(`${question.id}: 問題形式が不正です`);
      if (!ALLOWED_PROCESSES.has(question.cognitiveProcess)) {
        errors.push(`${question.id}: 認知過程が不正です`);
      }
      if (!ALLOWED_STRENGTHS.has(question.evidenceStrength)) {
        errors.push(`${question.id}: 証拠強度が不正です`);
      }
      if (!question.prompt?.trim()) errors.push(`${question.id}: 問題文がありません`);
      if (!question.retryHint?.trim()) errors.push(`${question.id}: 再挑戦ヒントがありません`);
      if (!(question.targetDimensions?.length > 0)) {
        errors.push(`${question.id}: 測定次元がありません`);
      }
      for (const dimension of question.targetDimensions ?? []) {
        if (!assessmentLesson.outcomeDimensions.includes(dimension)) {
          errors.push(`${question.id}: 未定義の測定次元${dimension}があります`);
        }
        coveredDimensions.add(dimension);
      }

      if (["selected-response", "output-prediction"].includes(question.kind)) {
        errors.push(...validateChoiceQuestion(question));
        correctPositions.push(
          question.choices?.findIndex((choice) => choice.id === question.correctChoiceId),
        );
      } else {
        errors.push(...validateConstructedQuestion(question));
      }
      if (!manuscripts.get(assessmentLesson.lessonId)?.includes(question.id)) {
        errors.push(`${question.id}: 対応原稿に問題IDがありません`);
      }
    }

    for (const question of reviewQuestions) {
      if (!/^step2-review-[a-z0-9-]+$/.test(question.id ?? "")) {
        errors.push(`${question.id ?? "IDなし"}: 累積復習ID形式が不正です`);
      }
      if (allQuestionIds.has(question.id)) errors.push(`${question.id}: 問題IDが重複しています`);
      allQuestionIds.add(question.id);
      if (!question.reviewLabel?.trim()) errors.push(`${question.id}: 復習範囲がありません`);
      if (!question.prompt?.trim()) errors.push(`${question.id}: 問題文がありません`);
      if (!question.retryHint?.trim()) errors.push(`${question.id}: 再挑戦ヒントがありません`);
      if (!ALLOWED_PROCESSES.has(question.cognitiveProcess)) {
        errors.push(`${question.id}: 認知過程が不正です`);
      }
      if (!["selected-response", "output-prediction"].includes(question.kind)) {
        errors.push(`${question.id}: 累積復習は選択問題でなければなりません`);
      } else {
        errors.push(...validateChoiceQuestion(question));
      }
    }
    for (const dimension of assessmentLesson.outcomeDimensions) {
      if (!coveredDimensions.has(dimension)) {
        errors.push(`${assessmentLesson.lessonId}: 測定されない次元${dimension}があります`);
      }
    }
    if (new Set(correctPositions).size < 2) {
      errors.push(`${assessmentLesson.lessonId}: 正答位置が単調です`);
    }
    if (questions.filter((question) => question.evidenceStrength === "direct").length < 2) {
      errors.push(`${assessmentLesson.lessonId}: 直接証拠問題が2件未満です`);
    }
  }

  for (const lesson of curriculum.lessons) {
    for (const evidence of lesson.directEvidence ?? []) {
      for (const assessmentId of evidence.assessmentIds ?? []) {
        const question = questionsById.get(assessmentId);
        if (!question) errors.push(`${lesson.id}: 未知の理解問題${assessmentId}を参照しています`);
        else if (question.lessonId !== lesson.id) {
          errors.push(`${lesson.id}: 他レッスンの理解問題${assessmentId}を参照しています`);
        } else if (question.evidenceStrength !== "direct") {
          errors.push(`${lesson.id}: ${assessmentId}が直接証拠として定義されていません`);
        }
      }
    }
  }
  return errors;
}

function main() {
  const errors = validateAssessmentContract(loadStep2Assessments());
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("STEP 2 assessments verified: 20 core questions, 3 cumulative reviews, and 4 optional challenges");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export {
  loadStep2Assessments,
  validateAssessmentContract,
  validateChoiceQuestion,
  validateConstructedQuestion,
  validateOptionalChallenge,
};
