import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_BLOCKS = [
  "data",
  "transformed data",
  "parameters",
  "transformed parameters",
  "model",
  "generated quantities",
];
const EXPECTED_LESSON_IDS = Array.from({ length: 8 }, (_, index) => `l${index + 34}`);
const EXPECTED_GRAMMAR_UNIT_IDS = Array.from({ length: 8 }, (_, index) => `g0${index + 1}`);
const EXPECTED_PRACTICE_STAGES = ["imitate", "modify", "recall", "transfer"];
const EXPECTED_SYNTAX_ERROR_IDS = Array.from({ length: 8 }, (_, index) => `se0${index + 1}`);
const EXPECTED_MODEL_REVIEW_IDS = Array.from({ length: 6 }, (_, index) => `mr0${index + 1}`);
const EXPECTED_RETENTION_CHECKPOINT_IDS = ["sr37", "sr40", "sr41d"];
const EXPECTED_RETENTION_DIMENSION_IDS = [
  "syntax-execution",
  "error-explanation",
  "math-code-translation",
  "model-review",
  "transfer",
  "delayed-retention",
];
const EXPECTED_SYNTAX_LAYER_IDS = ["language", "probabilistic", "computational"];
const EXPECTED_SYNTAX_ENCOUNTERS = ["read", "complete", "modify", "debug", "recall", "delayed-transfer"];
const EXPECTED_SYNTAX_LESSON_STAGES = ["step5", "l34-l35", "l36-l37", "l38-l40", "l41"];
const EXPECTED_SYNTAX_RELEASE_GATES = [
  "syntax-compiles",
  "error-explanation",
  "math-code-translation",
  "valid-but-wrong-diagnosis",
  "novel-response-transfer",
  "delayed-recall",
];
const EXPECTED_AUTHORED_LESSON_IDS = ["l34", "l35", "l36", "l37", "l38"];
const EXPECTED_FOUNDATION_ASSESSMENT_KINDS = [
  "selected-response",
  "output-prediction",
  "constructed-response",
  "transfer-task",
];

function normalizeText(value) {
  return String(value).replace(/\r\n?/g, "\n").trim();
}

function normalizeLineEndings(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

export function stripStanComments(source) {
  let output = "";
  let state = "code";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line") {
      if (char === "\n") {
        output += char;
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (state === "string") {
      output += char;
      if (char === "\\" && next) {
        output += next;
        index += 1;
      } else if (char === '"') {
        state = "code";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line";
    } else if (char === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block";
    } else {
      output += char;
      if (char === '"') state = "string";
    }
  }
  if (state === "block") throw new Error("Stanコードのブロックコメントが閉じていません");
  if (state === "string") throw new Error("Stanコードの文字列が閉じていません");
  return output;
}

function closingBrace(source, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

export function extractStanBlocks(source) {
  const clean = stripStanComments(source);
  const pattern = /\b(transformed\s+parameters|transformed\s+data|generated\s+quantities|parameters|data|model)\s*\{/g;
  const blocks = [];
  let cursor = 0;

  while (cursor < clean.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(clean);
    if (!match) break;
    const name = match[1].replace(/\s+/g, " ");
    const openingIndex = clean.indexOf("{", match.index);
    const closingIndex = closingBrace(clean, openingIndex);
    if (closingIndex < 0) throw new Error(`${name}ブロックの波括弧が閉じていません`);
    blocks.push({ name, body: clean.slice(openingIndex + 1, closingIndex) });
    cursor = closingIndex + 1;
  }

  return blocks;
}

function requiresMatch(errors, source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

export function validateStanProgram(source) {
  const errors = [];
  let blocks;
  try {
    blocks = extractStanBlocks(source);
  } catch (error) {
    return [error.message];
  }

  const names = blocks.map((block) => block.name);
  if (new Set(names).size !== names.length) errors.push("Stanブロックが重複しています");
  if (names.join("|") !== REQUIRED_BLOCKS.join("|")) {
    errors.push(`Stanブロックは${REQUIRED_BLOCKS.join(" → ")}の順でそろえる必要があります`);
  }

  const byName = new Map(blocks.map((block) => [block.name, block.body]));
  const data = byName.get("data") || "";
  const transformedData = byName.get("transformed data") || "";
  const parameters = byName.get("parameters") || "";
  const transformedParameters = byName.get("transformed parameters") || "";
  const model = byName.get("model") || "";
  const generated = byName.get("generated quantities") || "";

  requiresMatch(errors, data, /int\s*<\s*lower\s*=\s*1\s*>\s*N\s*;/, "Nを1以上の整数として宣言していません");
  requiresMatch(errors, data, /vector\s*\[\s*N\s*]\s*x\s*;/, "xをvector[N]として宣言していません");
  requiresMatch(errors, data, /vector\s*\[\s*N\s*]\s*y\s*;/, "yをvector[N]として宣言していません");
  requiresMatch(errors, transformedData, /x_centered\s*=\s*x\s*-\s*mean\s*\(\s*x\s*\)\s*;/, "xの中心化がtransformed dataにありません");
  requiresMatch(errors, parameters, /real\s+alpha\s*;/, "alphaの宣言がありません");
  requiresMatch(errors, parameters, /real\s+beta\s*;/, "betaの宣言がありません");
  requiresMatch(errors, parameters, /real\s*<\s*lower\s*=\s*0\s*>\s*sigma\s*;/, "sigmaを正のrealとして宣言していません");
  requiresMatch(errors, transformedParameters, /mu\s*=\s*alpha\s*\+\s*beta\s*\*\s*x_centered\s*;/, "線形予測子muが中心化済みxを使っていません");

  for (const parameter of ["alpha", "beta", "sigma"]) {
    requiresMatch(
      errors,
      model,
      new RegExp(`\\b${parameter}\\s*~\\s*[A-Za-z][A-Za-z0-9_]*\\s*\\(`),
      `${parameter}の事前分布がありません`
    );
  }
  requiresMatch(errors, model, /\by\s*~\s*normal\s*\(\s*mu\s*,\s*sigma\s*\)\s*;/, "yのベクトル化した正規尤度がありません");
  requiresMatch(errors, generated, /log_lik\s*\[\s*n\s*]\s*=\s*normal_lpdf\s*\(/, "観測ごとのlog_likを生成していません");
  requiresMatch(errors, generated, /y_rep\s*\[\s*n\s*]\s*=\s*normal_rng\s*\(/, "事後予測y_repを生成していません");
  if (/\bnormal_rng\s*\(/.test(model)) errors.push("乱数生成をmodelブロックに置いてはいけません");

  return errors;
}

export function validateCmdStanRunner(source) {
  const errors = [];
  const required = [
    [/library\s*\(\s*cmdstanr\s*\)/, "cmdstanrを読み込んでいません"],
    [/stan_data\s*<-\s*list\s*\(/, "Stanへ渡す名前付きlistがありません"],
    [/\bN\s*=\s*nrow\s*\(/, "Nをデータ行数から作っていません"],
    [/cmdstan_model\s*\([^)]*compile\s*=\s*FALSE/s, "構文確認とコンパイルを分離していません"],
    [/\$check_syntax\s*\(\s*\)/, "Stan構文確認を実行していません"],
    [/\$compile\s*\(\s*\)/, "Stanモデルをコンパイルしていません"],
    [/\$sample\s*\(/, "MCMCサンプリングを実行していません"],
    [/seed\s*=\s*\d+/, "再現用seedがありません"],
    [/chains\s*=\s*4\b/, "4 chainを指定していません"],
    [/\$diagnostic_summary\s*\(\s*\)/, "診断要約を確認していません"],
    [/\$draws\s*\(\s*"y_rep"/, "y_repを取り出していません"],
  ];
  for (const [pattern, message] of required) requiresMatch(errors, source, pattern, message);
  return errors;
}

export function validateGrammarDrills(drills) {
  const errors = [];
  if (drills?.schemaVersion !== 1) errors.push("grammar-drills.schemaVersionは1である必要があります");
  if (drills?.status !== "draft-unpublished") errors.push("文法ドリルは公開ゲート通過までdraft-unpublishedである必要があります");
  if (drills?.practiceOrder?.join("|") !== EXPECTED_PRACTICE_STAGES.join("|")) {
    errors.push("文法ドリルは写経・変更・白紙再現・転移の順である必要があります");
  }
  if (!Array.isArray(drills?.rules) || drills.rules.length < 3) {
    errors.push("文法ドリルの実施規則が不足しています");
  }
  if (!Array.isArray(drills?.units)) return [...errors, "grammar-drills.unitsがありません"];

  const ids = drills.units.map((unit) => unit.id);
  if (ids.join("|") !== EXPECTED_GRAMMAR_UNIT_IDS.join("|")) {
    errors.push("文法ドリルはg01〜g08の連続した8単元である必要があります");
  }
  if (new Set(ids).size !== ids.length) errors.push("文法ドリルの単元IDが重複しています");

  drills.units.forEach((unit) => {
    if (!unit.title?.trim()) errors.push(`${unit.id}: titleがありません`);
    if (!unit.math?.trim()) errors.push(`${unit.id}: 数式との対応がありません`);
    if (!Array.isArray(unit.stanFocus) || unit.stanFocus.length < 3) {
      errors.push(`${unit.id}: Stan構文の練習対象が不足しています`);
    }
    if (!unit.misconception?.trim()) errors.push(`${unit.id}: 初心者の誤概念が定義されていません`);
    if (!Array.isArray(unit.steps)) {
      errors.push(`${unit.id}: 4段階練習がありません`);
      return;
    }
    const stages = unit.steps.map((step) => step.id);
    if (stages.join("|") !== EXPECTED_PRACTICE_STAGES.join("|")) {
      errors.push(`${unit.id}: 4段階練習の順序または段階が不完全です`);
    }
    for (const step of unit.steps) {
      if (!step.prompt?.trim() || !step.successCriterion?.trim()) {
        errors.push(`${unit.id}/${step.id}: 課題または合格基準がありません`);
      }
    }
  });

  const serialized = JSON.stringify(drills);
  for (const required of [
    "_lpdf", "_lpmf", "_lcdf", "_lccdf", "_rng", "T[L, U]",
    "ハイパーパラメータ", "打ち切り", "bernoulli_logit", "poisson_log", "Pareto k", "stacking",
  ]) {
    if (!serialized.includes(required)) errors.push(`文法ドリルに必須項目「${required}」がありません`);
  }
  return errors;
}

export function validateFoundationLessons(curriculum, assessments, manuscripts) {
  const errors = [];
  const delivery = curriculum?.lessonDelivery;
  if (delivery?.status !== "draft-unpublished" ||
      delivery?.assessmentArtifact !== "foundation-assessments.json") {
    errors.push("L34–L38の受講用原稿と理解問題が非公開教材契約へ接続されていません");
  }
  if (delivery?.authoredLessonIds?.join("|") !== EXPECTED_AUTHORED_LESSON_IDS.join("|")) {
    errors.push("受講用原稿の完成範囲はL34–L38である必要があります");
  }
  if (!Array.isArray(delivery?.requiredSections) || delivery.requiredSections.length < 5 ||
      delivery?.practiceEncounters?.join("|") !== EXPECTED_SYNTAX_ENCOUNTERS.join("|")) {
    errors.push("L34–L38の必須見出しまたは6接触設計が不足しています");
  }

  if (assessments?.schemaVersion !== 1 || assessments?.status !== "draft-unpublished") {
    errors.push("foundation-assessmentsはschemaVersion 1の非公開ドラフトである必要があります");
  }
  const designRules = assessments?.designRules;
  if (designRules?.questionsPerLesson !== 5 ||
      designRules?.requiredKinds?.join("|") !== EXPECTED_FOUNDATION_ASSESSMENT_KINDS.join("|") ||
      designRules?.learnerAnswersAreNotPerformanceEvidence !== true ||
      designRules?.preserveFirstAttemptBeforeFeedback !== true) {
    errors.push("L34–L38理解問題が5問・4形式・初回保存・実技証拠分離の設計を満たしていません");
  }

  const assessmentLessons = assessments?.lessons || [];
  if (assessmentLessons.map((item) => item.lessonId).join("|") !== EXPECTED_AUTHORED_LESSON_IDS.join("|")) {
    errors.push("foundation-assessmentsはL34–L38を順番どおり含む必要があります");
  }
  const allQuestionIds = assessmentLessons.flatMap((item) =>
    (item.questions || []).map((question) => question.id)
  );
  if (new Set(allQuestionIds).size !== allQuestionIds.length) {
    errors.push("L34–L38理解問題のIDが重複しています");
  }

  for (const lessonId of EXPECTED_AUTHORED_LESSON_IDS) {
    const lesson = curriculum?.lessons?.find((item) => item.id === lessonId);
    const assessmentLesson = assessmentLessons.find((item) => item.lessonId === lessonId);
    const manuscript = manuscripts?.[lessonId];
    if (!lesson || !assessmentLesson) {
      errors.push(`${lessonId}: カリキュラムまたは理解問題がありません`);
      continue;
    }
    if (!lesson.manuscript?.startsWith(`lessons/${lessonId}-`) || !manuscript) {
      errors.push(`${lessonId}: 受講用原稿への導線がありません`);
      continue;
    }
    if (lesson.outcomeDimensions?.join("|") !== assessmentLesson.outcomeDimensions?.join("|")) {
      errors.push(`${lessonId}: 到達目標次元がカリキュラムと理解問題で一致しません`);
    }
    if (lesson.directEvidence?.map((item) => item.method).join("|") !==
        "constructed-response|debugging-task|transfer-task") {
      errors.push(`${lessonId}: 直接評価が説明・デバッグ・未見転移を分離していません`);
    }
    const questions = assessmentLesson.questions || [];
    if (questions.length !== 5 ||
        lesson.assessmentIds?.join("|") !== questions.map((question) => question.id).join("|")) {
      errors.push(`${lessonId}: カリキュラムと5問の理解問題IDが一致しません`);
    }
    const presentKinds = new Set(questions.map((question) => question.kind));
    for (const kind of EXPECTED_FOUNDATION_ASSESSMENT_KINDS) {
      if (!presentKinds.has(kind)) errors.push(`${lessonId}: 理解問題に${kind}がありません`);
    }
    const targetedDimensions = new Set(questions.flatMap((question) => question.targetDimensions || []));
    for (const dimension of lesson.outcomeDimensions || []) {
      if (!targetedDimensions.has(dimension)) {
        errors.push(`${lessonId}: 到達目標次元${dimension}を測る理解問題がありません`);
      }
    }
    for (const question of questions) {
      if (!question.id?.startsWith(`stan-${lessonId}-q`) || !question.prompt?.trim() ||
          !question.retryHint?.trim() || !Array.isArray(question.targetDimensions) ||
          question.targetDimensions.length === 0) {
        errors.push(`${lessonId}: ${question.id || "IDなし"}の問題・対象次元・再試行支援が不完全です`);
      }
      if ((question.targetDimensions || []).some(
        (dimension) => !lesson.outcomeDimensions?.includes(dimension)
      )) {
        errors.push(`${lessonId}: ${question.id}が未知の到達目標次元を参照しています`);
      }
      if ((question.kind === "selected-response" || question.kind === "output-prediction")) {
        const choiceIds = (question.choices || []).map((choice) => choice.id);
        const correct = (question.choices || []).find((choice) => choice.id === question.correctChoiceId);
        if (choiceIds.length < 4 || new Set(choiceIds).size !== choiceIds.length ||
            correct?.diagnostic !== "correct" || !question.correctFeedback?.trim()) {
          errors.push(`${lessonId}: ${question.id}の選択肢・正答・誤答診断が不完全です`);
        }
      }
      if (question.kind === "constructed-response" || question.kind === "transfer-task") {
        const rubricIds = (question.rubric || []).map((item) => item.id);
        if (!Array.isArray(question.rubric) || question.rubric.length < 3 ||
            new Set(rubricIds).size !== rubricIds.length ||
            question.rubric.some((item) => !item.id?.trim() || !item.criterion?.trim()) ||
            !question.modelAnswer?.trim()) {
          errors.push(`${lessonId}: ${question.id}の記述rubricまたはモデル回答が不足しています`);
        }
      }
    }

    if (!manuscript.startsWith(`# ${lessonId.toUpperCase()}`)) {
      errors.push(`${lessonId}: 原稿見出しがレッスンIDで始まっていません`);
    }
    if (!manuscript.includes("状態: 非公開ドラフト")) {
      errors.push(`${lessonId}: 原稿が公開前ドラフトであることを明示していません`);
    }
    for (const section of delivery.requiredSections || []) {
      if (!manuscript.includes(`## ${section}`)) errors.push(`${lessonId}: 必須見出し「${section}」がありません`);
    }
    for (const questionId of lesson.assessmentIds || []) {
      if (!manuscript.includes(`\`${questionId}\``)) {
        errors.push(`${lessonId}: 原稿から理解問題${questionId}への導線がありません`);
      }
    }
    for (const phrase of ["読む・予測する", "穴埋めする", "一部を変える", "エラーを直す", "見本なし", "別文脈へ移す"]) {
      if (!manuscript.includes(phrase)) errors.push(`${lessonId}: 6接触の「${phrase}」がありません`);
    }
    const officialLinks = manuscript.match(/https:\/\/mc-stan\.org\//g) || [];
    if (officialLinks.length < 3) errors.push(`${lessonId}: Stan公式資料へのリンクが3件未満です`);
  }

  const requiredPhrases = {
    l34: ["データ契約", "stanc3", "model$check_syntax()", "model$compile()", "model$sample(", "L37後"],
    l35: ["functions", "transformed data", "transformed parameters", "generated quantities", "制約は事前分布ではない", "array[N] int", "L37後"],
    l36: ["distribution statement", "normal_lupdf", "target +=", "事前分布は飾りではない", "ベクトル化", "bernoulli_logit", "L37後"],
    l37: ["check_cmdstan_toolchain()", "cmdstan_version()", "write_stan_json()", "compile = FALSE", "check_syntax(pedantic = TRUE)", "chain_ids", "parallel_chains", "iter_warmup", "save_output_files", "save_object()", "diagnostic_summary()", "metadata()", "L40後"],
    l38: ["diagnostic_summary()", "mcse_mean", "mcse_quantile", "R-hat < 1.01", "100 × chain数", "divergenceが1件でも", "E-BFMI 0.30未満", "計算診断が良い誤答モデル", "L40後"],
  };
  for (const [lessonId, phrases] of Object.entries(requiredPhrases)) {
    for (const phrase of phrases) {
      if (!manuscripts?.[lessonId]?.includes(phrase)) {
        errors.push(`${lessonId}: 必須説明「${phrase}」がありません`);
      }
    }
  }
  return errors;
}

export function validateSyntaxErrorCorpus(corpus, evidence, sources, corpusSource) {
  const errors = [];
  if (corpus?.schemaVersion !== 1) {
    errors.push("syntax-error-corpus.schemaVersionは1である必要があります");
  }
  if (corpus?.status !== "draft-unpublished") {
    errors.push("構文エラーコーパスは公開ゲート通過までdraft-unpublishedである必要があります");
  }
  if (corpus?.compilerContract?.compiler !== "stanc3" ||
      corpus?.compilerContract?.cmdstanVersion !== "2.39.0" ||
      corpus?.compilerContract?.flags?.join("|") !== "--warn-pedantic") {
    errors.push("構文エラーコーパスの固定stanc3契約が一致しません");
  }
  if (!Array.isArray(corpus?.rules) || corpus.rules.length < 4) {
    errors.push("構文エラーコーパスの実施規則が不足しています");
  }
  if (!Array.isArray(corpus?.cases)) return [...errors, "syntax-error-corpus.casesがありません"];

  const ids = corpus.cases.map((item) => item.id);
  if (ids.join("|") !== EXPECTED_SYNTAX_ERROR_IDS.join("|")) {
    errors.push("構文エラーコーパスはse01〜se08の連続した8組である必要があります");
  }
  if (new Set(ids).size !== ids.length) errors.push("構文エラーケースIDが重複しています");
  const layers = new Set(corpus.cases.map((item) => item.layer));
  for (const layer of EXPECTED_SYNTAX_LAYER_IDS) {
    if (!layers.has(layer)) errors.push(`構文エラーコーパスに${layer}層の課題がありません`);
  }

  const evidenceById = new Map((evidence?.cases || []).map((item) => [item.id, item]));
  for (const item of corpus.cases) {
    for (const key of ["title", "category", "lessonPlacement", "broken", "fixed", "cause", "repair", "transferPrompt", "successCriterion"]) {
      if (!item[key]?.trim()) errors.push(`${item.id}: ${key}がありません`);
    }
    if (!Array.isArray(item.expectedDiagnosticFragments) || item.expectedDiagnosticFragments.length < 2) {
      errors.push(`${item.id}: 診断の安定断片が不足しています`);
    }
    const broken = sources?.[item.broken];
    const fixed = sources?.[item.fixed];
    if (typeof broken !== "string" || typeof fixed !== "string") {
      errors.push(`${item.id}: 壊れた例または修正版を読み込めません`);
      continue;
    }
    if (normalizeText(broken) === normalizeText(fixed)) {
      errors.push(`${item.id}: 壊れた例と修正版が同一です`);
    }
    const saved = evidenceById.get(item.id);
    if (!saved || saved.brokenSha256 !== sha256(broken) || saved.fixedSha256 !== sha256(fixed)) {
      errors.push(`${item.id}: stanc3実測証拠取得後にソースが変更されています`);
    }
    if (saved?.brokenExitCode !== 1 || saved?.fixedExitCode !== 0) {
      errors.push(`${item.id}: 壊れた例1・修正版0の終了コード証拠がありません`);
    }
  }

  if (evidence?.schemaVersion !== 1 || evidence?.status !== "PASS" ||
      evidence?.environment?.compiler !== "stanc3" || evidence?.environment?.version !== "2.39.0" ||
      evidence?.flags?.join("|") !== "--warn-pedantic") {
    errors.push("構文エラーコーパスのstanc3実測証拠がPASSではありません");
  }
  if (evidenceById.size !== EXPECTED_SYNTAX_ERROR_IDS.length) {
    errors.push("構文エラーコーパスの実測証拠が8組揃っていません");
  }
  if (evidence?.corpusSha256 !== sha256(corpusSource)) {
    errors.push("構文エラーコーパス本体がstanc3実測証拠取得後に変更されています");
  }
  if (!Array.isArray(evidence?.limitations) || evidence.limitations.length < 3) {
    errors.push("構文エラー実測証拠の限界が不足しています");
  }
  const boundary = JSON.stringify(corpus?.knownCompilerBoundary || {});
  for (const required of ["次元", "stanc3", "STAN-009"]) {
    if (!boundary.includes(required)) errors.push(`構文エラーコーパスのコンパイラ境界に「${required}」がありません`);
  }
  return errors;
}

export function validateModelReviewCorpus(corpus, evidence, sources, corpusSource) {
  const errors = [];
  if (corpus?.schemaVersion !== 1) {
    errors.push("model-review-corpus.schemaVersionは1である必要があります");
  }
  if (corpus?.status !== "draft-unpublished") {
    errors.push("モデルレビューコーパスは公開ゲート通過までdraft-unpublishedである必要があります");
  }
  if (corpus?.compilerContract?.compiler !== "stanc3" ||
      corpus?.compilerContract?.cmdstanVersion !== "2.39.0" ||
      corpus?.compilerContract?.flags?.join("|") !== "--warn-pedantic") {
    errors.push("モデルレビューコーパスの固定stanc3契約が一致しません");
  }
  if (!Array.isArray(corpus?.rules) || corpus.rules.length < 4) {
    errors.push("モデルレビューコーパスの実施規則が不足しています");
  }
  if (!Array.isArray(corpus?.cases)) return [...errors, "model-review-corpus.casesがありません"];

  const ids = corpus.cases.map((item) => item.id);
  if (ids.join("|") !== EXPECTED_MODEL_REVIEW_IDS.join("|")) {
    errors.push("モデルレビューコーパスはmr01〜mr06の連続した6組である必要があります");
  }
  if (new Set(ids).size !== ids.length) errors.push("モデルレビューケースIDが重複しています");
  const expectedJudgements = new Map([
    ["mr01", "candidate-reject"],
    ["mr02", "prefer-reference"],
    ["mr03", "context-dependent"],
    ["mr04", "candidate-reject"],
    ["mr05", "candidate-reject"],
    ["mr06", "candidate-reject"],
  ]);
  const evidenceById = new Map((evidence?.cases || []).map((item) => [item.id, item]));

  for (const item of corpus.cases) {
    for (const key of ["title", "layer", "reviewClass", "lessonPlacement", "candidate", "reference", "judgement", "candidateRisk", "whyCompilerCannotDecide", "transferPrompt", "successCriterion"]) {
      if (!item[key]?.trim()) errors.push(`${item.id}: ${key}がありません`);
    }
    if (item.judgement !== expectedJudgements.get(item.id)) {
      errors.push(`${item.id}: candidate-reject・prefer-reference・context-dependentの区別が教材設計と一致しません`);
    }
    if (!Array.isArray(item.reviewQuestions) || item.reviewQuestions.length < 3) {
      errors.push(`${item.id}: コンパイル後のレビュー質問が不足しています`);
    }
    if (!Array.isArray(item.candidateRequiredFragments) || item.candidateRequiredFragments.length < 1 ||
        !Array.isArray(item.referenceRequiredFragments) || item.referenceRequiredFragments.length < 1) {
      errors.push(`${item.id}: candidateまたはreferenceの意味差を固定する断片がありません`);
    }
    const candidate = sources?.[item.candidate];
    const reference = sources?.[item.reference];
    if (typeof candidate !== "string" || typeof reference !== "string") {
      errors.push(`${item.id}: candidateまたはreferenceを読み込めません`);
      continue;
    }
    if (normalizeText(candidate) === normalizeText(reference)) {
      errors.push(`${item.id}: candidateとreferenceが同一です`);
    }
    for (const fragment of item.candidateRequiredFragments || []) {
      if (!candidate.includes(fragment)) errors.push(`${item.id}: candidateに必須断片「${fragment}」がありません`);
    }
    for (const fragment of item.referenceRequiredFragments || []) {
      if (!reference.includes(fragment)) errors.push(`${item.id}: referenceに必須断片「${fragment}」がありません`);
    }
    const saved = evidenceById.get(item.id);
    if (!saved || saved.candidateSha256 !== sha256(candidate) || saved.referenceSha256 !== sha256(reference)) {
      errors.push(`${item.id}: stanc3実測証拠取得後にモデルレビューソースが変更されています`);
    }
    if (saved?.candidateExitCode !== 0 || saved?.referenceExitCode !== 0) {
      errors.push(`${item.id}: candidateとreferenceの両方が構文確認を通った証拠がありません`);
    }
    if (!Number.isInteger(saved?.candidateWarningCount) || saved.candidateWarningCount < 0 ||
        !Number.isInteger(saved?.referenceWarningCount) || saved.referenceWarningCount < 0) {
      errors.push(`${item.id}: pedantic警告数の証拠がありません`);
    }
  }

  if (corpus.cases.find((item) => item.id === "mr06")?.runtimeEvidence !== "scenario-validation.json") {
    errors.push("mr06が切断ケースの複数chain実測証拠へ接続されていません");
  }
  if (!Array.isArray(corpus?.releaseEvidence) || corpus.releaseEvidence.length < 5) {
    errors.push("モデルレビューコーパスの公開証拠が不足しています");
  }
  if (evidence?.schemaVersion !== 1 || evidence?.status !== "PASS" ||
      evidence?.environment?.compiler !== "stanc3" || evidence?.environment?.version !== "2.39.0" ||
      evidence?.flags?.join("|") !== "--warn-pedantic") {
    errors.push("モデルレビューコーパスのstanc3実測証拠がPASSではありません");
  }
  if (evidenceById.size !== EXPECTED_MODEL_REVIEW_IDS.length) {
    errors.push("モデルレビューコーパスの実測証拠が6組揃っていません");
  }
  if (evidence?.corpusSha256 !== sha256(corpusSource)) {
    errors.push("モデルレビューコーパス本体がstanc3実測証拠取得後に変更されています");
  }
  if (!Array.isArray(evidence?.limitations) || evidence.limitations.length < 4) {
    errors.push("モデルレビュー実測証拠の限界が不足しています");
  }
  const serialized = JSON.stringify(corpus);
  for (const required of ["Jacobian", "数値安定性", "常に誤りとせず", "offset", "PSIS-LOO", "診断が良い誤答"]) {
    if (!serialized.includes(required)) errors.push(`モデルレビューコーパスに必須判断「${required}」がありません`);
  }
  return errors;
}

export function validateSyntaxRetention(plan, assessments, evidence, referenceSource, planSource, assessmentSource) {
  const errors = [];
  if (plan?.schemaVersion !== 1 || plan?.status !== "draft-unpublished" ||
      plan?.scheduleStatus !== "provisional-pilot-required") {
    errors.push("Stan保持計画はpilot前のdraft-unpublishedである必要があります");
  }
  if (plan?.assessmentArtifact !== "syntax-retention-assessments.json" ||
      plan?.facilitatorReference !== "retention/facilitator/positive-duration-reference.stan" ||
      plan?.validationEvidence !== "syntax-retention-validation.json" ||
      plan?.runner !== "scripts/verify-stan-retention.mjs") {
    errors.push("Stan保持計画から課題・facilitator参照・証拠・検証器への導線がありません");
  }
  const mastery = plan?.masteryPolicy;
  if (mastery?.selfRecordIsMasteryEvidence !== false || mastery?.immediateAndDelayedAreSeparate !== true ||
      mastery?.initialSubmissionFrozen !== true || mastery?.thresholdStatus !== "not-fixed-before-pilot" ||
      !mastery?.retryPolicy || !mastery?.referencePolicy || !mastery?.privacyPolicy) {
    errors.push("Stan保持計画が自己記録・直後・遅延・初回提出・pilot前閾値を分離していません");
  }
  if (!Array.isArray(plan?.checkpoints)) return [...errors, "syntax-retention-plan.checkpointsがありません"];
  const checkpointIds = plan.checkpoints.map((item) => item.id);
  if (checkpointIds.join("|") !== EXPECTED_RETENTION_CHECKPOINT_IDS.join("|")) {
    errors.push("Stan保持計画はsr37・sr40・sr41dの3地点である必要があります");
  }
  const expectedCheckpointDesign = new Map([
    ["sr37", { after: "l37", units: "g01|g02|g03", tasks: "sr37-01|sr37-02|sr37-03" }],
    ["sr40", { after: "l40", units: "g04|g05|g06|g07", tasks: "sr40-01|sr40-02|sr40-03" }],
    ["sr41d", { after: "l41", units: EXPECTED_GRAMMAR_UNIT_IDS.join("|"), tasks: "sr41d-01|sr41d-02|sr41d-03|sr41d-04" }],
  ]);
  for (const checkpoint of plan.checkpoints) {
    const expected = expectedCheckpointDesign.get(checkpoint.id);
    if (!expected || checkpoint.after !== expected.after || checkpoint.revisitUnits?.join("|") !== expected.units ||
        checkpoint.taskIds?.join("|") !== expected.tasks) {
      errors.push(`${checkpoint.id}: 前提レッスン・累積単元・課題配置が一致しません`);
    }
    if (checkpoint.schedule?.provisional !== true || !checkpoint.schedule?.trigger) {
      errors.push(`${checkpoint.id}: pilot前の暫定実施時期が明示されていません`);
    }
    if (!Array.isArray(checkpoint.requiredEvidence) || checkpoint.requiredEvidence.length < 6) {
      errors.push(`${checkpoint.id}: 初回・修正版・支援を分ける証拠契約が不足しています`);
    }
  }
  const delayed = plan.checkpoints.find((item) => item.id === "sr41d");
  if (delayed?.kind !== "delayed-transfer" || delayed?.schedule?.minimumDays !== 7 ||
      delayed?.schedule?.maximumDays !== 14 || !delayed?.schedule?.reconsiderAfter ||
      delayed?.unseenScenario?.responseType !== "positive-continuous" ||
      delayed?.unseenScenario?.distribution !== "lognormal" ||
      delayed?.unseenScenario?.notUsedByCurrentExamples !== true) {
    errors.push("sr41dはpilotで再検討する7〜14日後の未見lognormal転移である必要があります");
  }
  if (!Array.isArray(plan?.recordSchema?.requiredFields) || !plan.recordSchema.requiredFields.includes("artifactHashes") ||
      !plan.recordSchema.requiredFields.includes("assistanceLevel") ||
      plan.recordSchema.attemptTypes?.join("|") !== "immediate|spaced|delayed" ||
      !plan.recordSchema.forbiddenFields?.includes("researchData")) {
    errors.push("保持評価の匿名記録schemaが初回・支援・hash・個人情報除外を固定していません");
  }
  if (!Array.isArray(plan?.releaseRequirements) || plan.releaseRequirements.length < 5) {
    errors.push("保持・転移課題の公開要件が不足しています");
  }

  if (assessments?.schemaVersion !== 1 || assessments?.status !== "draft-unpublished" ||
      assessments?.answerExposure !== "excluded-from-participant-pack-before-first-submission") {
    errors.push("Stan保持課題の採点基準は初回提出前のparticipant配布物から除外する必要があります");
  }
  if (assessments?.rubricScale?.thresholdStatus !== "not-fixed-before-pilot" ||
      assessments?.rubricScale?.levels?.map((item) => item.score).join("|") !== "0|1|2") {
    errors.push("Stan保持課題のrubricはpilot前の0・1・2証拠尺度である必要があります");
  }
  if (assessments?.dimensions?.map((item) => item.id).join("|") !== EXPECTED_RETENTION_DIMENSION_IDS.join("|")) {
    errors.push("Stan保持課題の6評価次元が一致しません");
  }
  if (assessments?.dimensions?.some((item) => !item.title || !item.criterion)) {
    errors.push("Stan保持課題の評価次元に名称または判定基準がありません");
  }
  const expectedTaskIds = plan.checkpoints.flatMap((checkpoint) => checkpoint.taskIds);
  const tasks = assessments?.tasks || [];
  if (tasks.map((item) => item.id).join("|") !== expectedTaskIds.join("|") || new Set(expectedTaskIds).size !== 10) {
    errors.push("Stan保持課題は3地点に対応する連続した10課題である必要があります");
  }
  for (const task of tasks) {
    const checkpoint = plan.checkpoints.find((item) => item.id === task.checkpointId);
    if (!checkpoint?.taskIds.includes(task.id)) errors.push(`${task.id}: checkpointIdと計画の配置が一致しません`);
    if (!task.mode || !task.prompt || !task.successEvidence ||
        !Array.isArray(task.sourceUnits) || task.sourceUnits.length < 1 ||
        !Array.isArray(task.evidenceArtifacts) || task.evidenceArtifacts.length < 2 ||
        !Array.isArray(task.rubricDimensions) || task.rubricDimensions.length < 2) {
      errors.push(`${task.id}: 課題・証拠・rubric対応が不完全です`);
    }
    if (task.sourceUnits?.some((id) => !EXPECTED_GRAMMAR_UNIT_IDS.includes(id))) {
      errors.push(`${task.id}: 未定義の文法単元へ依存しています`);
    }
    if (task.sourceCases?.some((id) => !EXPECTED_SYNTAX_ERROR_IDS.includes(id) && !EXPECTED_MODEL_REVIEW_IDS.includes(id))) {
      errors.push(`${task.id}: 未定義のエラーまたはモデルレビューケースへ依存しています`);
    }
    if (task.rubricDimensions?.some((id) => !EXPECTED_RETENTION_DIMENSION_IDS.includes(id))) {
      errors.push(`${task.id}: 未定義の評価次元があります`);
    }
    if (task.checkpointId === "sr41d" && !task.rubricDimensions?.includes("delayed-retention")) {
      errors.push(`${task.id}: 遅延保持を直接評価していません`);
    }
  }

  for (const fragment of [
    "duration_seconds ~ lognormal(mu_log, sigma)",
    "lognormal_lpdf(duration_seconds[n] | mu_log[n], sigma)",
    "lognormal_rng(mu_log[n], sigma)",
  ]) {
    if (!referenceSource.includes(fragment)) errors.push(`未見lognormal参照モデルに「${fragment}」がありません`);
  }
  if (evidence?.schemaVersion !== 1 || evidence?.status !== "PASS" ||
      evidence?.environment?.compiler !== "stanc3" || evidence?.environment?.version !== "2.39.0" ||
      evidence?.reference !== "retention/facilitator/positive-duration-reference.stan" ||
      evidence?.referenceExitCode !== 0 || !Number.isInteger(evidence?.referenceWarningCount)) {
    errors.push("Stan保持課題のfacilitator参照モデル実測証拠がPASSではありません");
  }
  if (evidence?.planSha256 !== sha256(planSource) || evidence?.assessmentsSha256 !== sha256(assessmentSource) ||
      evidence?.referenceSha256 !== sha256(referenceSource)) {
    errors.push("Stan保持計画・課題・参照モデルが実測証拠取得後に変更されています");
  }
  if (!Array.isArray(evidence?.limitations) || evidence.limitations.length < 3) {
    errors.push("Stan保持課題実測証拠の限界が不足しています");
  }
  return errors;
}

export function validateDistributionGrammarLab(markdown, rSource, priorStan, truncatedStan) {
  const errors = [];
  const requiredPhrases = [
    "写経 → 変更 → 白紙再現 → 転移",
    "distribution statement",
    "normal_lupdf",
    "事前予測",
    "ハイパーパラメータ",
    "切断分布",
    "制約・切断・打ち切りは別物",
    "clamping",
    "simulation-summary.csv",
  ];
  for (const phrase of requiredPhrases) {
    if (!markdown.includes(phrase)) errors.push(`分布文法原稿に必須説明「${phrase}」がありません`);
  }
  const displayMathCount = (markdown.match(/\\\[/g) || []).length;
  if (displayMathCount < 8) errors.push("分布文法原稿の数式例が8個未満です");
  const questionCount = (markdown.match(/^### 問\d+/gm) || []).length;
  if (questionCount < 8) errors.push("分布文法原稿の内容理解問題が8問未満です");
  for (const file of ["prior-predictive.stan", "truncated-normal.stan", "simulate-distributions.R"]) {
    if (!markdown.includes(file)) errors.push(`分布文法原稿から実行例${file}への導線がありません`);
  }

  let priorBlocks = [];
  let truncatedBlocks = [];
  try {
    priorBlocks = extractStanBlocks(priorStan).map((block) => block.name);
  } catch (error) {
    errors.push(`事前予測Stanコード: ${error.message}`);
  }
  try {
    truncatedBlocks = extractStanBlocks(truncatedStan).map((block) => block.name);
  } catch (error) {
    errors.push(`切断Stanコード: ${error.message}`);
  }
  if (priorBlocks.join("|") !== "data|generated quantities") {
    errors.push("事前予測Stanコードはdataとgenerated quantitiesだけで構成する必要があります");
  }
  for (const [pattern, message] of [
    [/normal_rng\s*\(/, "事前予測Stanコードにnormal_rngがありません"],
    [/exponential_rng\s*\(/, "事前予測Stanコードにexponential_rngがありません"],
    [/array\s*\[\s*N\s*]\s*real\s+y_sim/, "事前予測StanコードにN個のy_simがありません"],
  ]) requiresMatch(errors, priorStan, pattern, message);

  if (truncatedBlocks.join("|") !== "data|transformed data|parameters|model|generated quantities") {
    errors.push("切断Stanコードのブロック構成が教材契約と一致しません");
  }
  for (const [pattern, message] of [
    [/vector\s*<\s*lower\s*=\s*lower_bound\s*,\s*upper\s*=\s*upper_bound\s*>\s*\[\s*N\s*]\s*y/, "切断Stanコードの観測範囲制約がありません"],
    [/lower_bound\s*>=\s*upper_bound/, "切断Stanコードの境界順序検査がありません"],
    [/y\s*~\s*normal\s*\(\s*mu\s*,\s*sigma\s*\)\s*T\s*\[\s*lower_bound\s*,\s*upper_bound\s*]/, "切断StanコードにT構文がありません"],
    [/log_diff_exp\s*\(/, "切断Stanコードに対数正規化項の確認がありません"],
    [/normal_lcdf\s*\(\s*upper_bound\s*\|/, "切断Stanコードに上限CDFがありません"],
  ]) requiresMatch(errors, truncatedStan, pattern, message);

  for (const [pattern, message] of [
    [/run_distribution_grammar_lab\s*<-\s*function/, "Rシミュレーションが再利用可能な関数になっていません"],
    [/set\.seed\s*\(/, "Rシミュレーションに固定seedがありません"],
    [/\bdnorm\s*\(/, "Rシミュレーションに正規密度がありません"],
    [/\brnorm\s*\(/, "Rシミュレーションに正規乱数がありません"],
    [/\bdbeta\s*\(/, "RシミュレーションにBeta密度がありません"],
    [/\brbeta\s*\(/, "RシミュレーションにBeta乱数がありません"],
    [/\brexp\s*\(/, "Rシミュレーションに指数乱数がありません"],
    [/\bpnorm\s*\(/, "Rシミュレーションに切断CDFがありません"],
    [/\bqnorm\s*\(/, "Rシミュレーションに逆CDFによる切断乱数がありません"],
    [/write\.csv\s*\(/, "Rシミュレーションに理論値との比較出力がありません"],
  ]) requiresMatch(errors, rSource, pattern, message);
  return errors;
}

export function validateWrongNaiveProgram(source) {
  const errors = [];
  let blocks = [];
  try {
    blocks = extractStanBlocks(source).map((block) => block.name);
  } catch (error) {
    return [`意図的な誤答Stanコード: ${error.message}`];
  }
  if (blocks.join("|") !== "data|transformed data|parameters|model") {
    errors.push("意図的な誤答Stanコードのブロック構成が教材契約と一致しません");
  }
  for (const [pattern, message] of [
    [/INTENTIONALLY WRONG FOR THIS SCENARIO/, "誤答Stanコードに使用禁止の警告がありません"],
    [/vector\s*<\s*lower\s*=\s*lower_bound\s*,\s*upper\s*=\s*upper_bound\s*>\s*\[\s*N\s*]\s*y/, "誤答Stanコードの入力範囲制約がありません"],
    [/mu\s*~\s*normal\s*\(\s*0\s*,\s*2\s*\)/, "誤答Stanコードのmu事前分布が比較対象と一致しません"],
    [/sigma\s*~\s*exponential\s*\(\s*1\s*\)/, "誤答Stanコードのsigma事前分布が比較対象と一致しません"],
    [/y\s*~\s*normal\s*\(\s*mu\s*,\s*sigma\s*\)\s*;/, "誤答Stanコードの正規化なし尤度がありません"],
  ]) requiresMatch(errors, source, pattern, message);
  if (/\bT\s*\[/.test(source) || /normal_lc?cdf|log_diff_exp/.test(source)) {
    errors.push("意図的な誤答Stanコードへ切断正規化が混入しています");
  }
  return errors;
}

export function validateScenarioRunner(source) {
  const errors = [];
  const required = [
    [/library\s*\(\s*cmdstanr\s*\)/, "ケース実行コードがcmdstanrを読み込んでいません"],
    [/sample_truncated_normal\s*<-\s*function/, "ケース実行コードに逆CDFの切断乱数関数がありません"],
    [/runif\s*\([^)]*lower_probability[^)]*upper_probability/s, "切断乱数がCDF範囲の一様乱数を使っていません"],
    [/qnorm\s*\(\s*probability/, "切断乱数が逆CDFへ戻されていません"],
    [/"prior-predictive\.stan"/, "ケース実行コードに事前予測Stanモデルがありません"],
    [/"truncated-normal\.stan"/, "ケース実行コードに正しい切断Stanモデルがありません"],
    [/"wrong-naive-bounded-normal\.stan"/, "ケース実行コードに意図的な誤答Stanモデルがありません"],
    [/\$check_syntax\s*\(\s*\)/, "ケース実行コードがStan構文を確認していません"],
    [/\$compile\s*\(\s*\)/, "ケース実行コードがStanモデルをコンパイルしていません"],
    [/fixed_param\s*=\s*TRUE/, "事前予測がfixed-parameter samplerを使っていません"],
    [/chains\s*=\s*4L/, "ケース実行コードの既定chain数が4ではありません"],
    [/iter_warmup\s*=\s*1000L/, "ケース実行コードの既定warmupが1000ではありません"],
    [/iter_sampling\s*=\s*1000L/, "ケース実行コードの既定samplingが1000ではありません"],
    [/prior_iterations\s*=\s*1000L/, "ケース実行コードの事前予測反復数が1000ではありません"],
    [/seed\s*=\s*20260802L/, "ケース実行コードの固定seedが教材契約と一致しません"],
    [/n\s*=\s*2000\b/, "ケース実行コードの合成観測数が2000ではありません"],
    [/truth\s*<-\s*c\(\s*mu\s*=\s*0\.15\s*,\s*sigma\s*=\s*0\.45\s*\)/, "ケース実行コードの真値が教材契約と一致しません"],
    [/correct_truncated/, "ケース実行コードに正答モデルのラベルがありません"],
    [/wrong_naive/, "ケース実行コードに誤答モデルのラベルがありません"],
    [/\$diagnostic_summary\s*\(\s*\)/, "ケース実行コードが計算診断を保存していません"],
    [/\$draws\s*\(\s*"y_rep"/, "ケース実行コードが切断事後予測を取り出していません"],
    [/"model-comparison\.csv"/, "ケース実行コードにモデル比較CSVがありません"],
    [/"03-truncated-posterior-predictive\.png"/, "ケース実行コードに事後予測図がありません"],
  ];
  for (const [pattern, message] of required) requiresMatch(errors, source, pattern, message);
  return errors;
}

export function validateScenarioManuscript(markdown) {
  const errors = [];
  for (const phrase of [
    "これは切断です",
    "約37%がファイルに現れません",
    "もっともらしい誤答",
    "正しい切断モデル",
    "診断が良い誤答",
    "正答1.005、誤答1.003",
    "計算診断が確認するのは",
    "generated quantities",
    "run-distribution-models.R",
    "scenario-validation.json",
  ]) {
    if (!markdown.includes(phrase)) errors.push(`切断ケース原稿に必須説明「${phrase}」がありません`);
  }
  const exerciseCount = (markdown.match(/^### 練習\d+/gm) || []).length;
  if (exerciseCount !== 8) errors.push("切断ケースの段階練習は8件である必要があります");
  const displayMathCount = (markdown.match(/\\\[/g) || []).length;
  if (displayMathCount < 7) errors.push("切断ケースの数式例が7個未満です");
  for (const value of ["0.1499438", "0.4503102", "0.4174342", "0.2941287"]) {
    const rounded = Number(value).toFixed(3);
    if (!markdown.includes(rounded)) errors.push(`切断ケース原稿に実測値${rounded}がありません`);
  }
  return errors;
}

export function validateScenarioEvidence(evidence, sources) {
  const errors = [];
  if (evidence?.schemaVersion !== 1) errors.push("scenario-validation.schemaVersionは1である必要があります");
  if (evidence?.status !== "PASS") errors.push("Stanケース実行証拠はPASSである必要があります");

  for (const [name, source] of Object.entries(sources)) {
    if (evidence?.sourceHashes?.[name] !== sha256(source)) {
      errors.push(`${name}がケース実行証拠取得後に変更されています`);
    }
  }
  for (const [name, expected] of [["r", "4.6.1"], ["cmdstanr", "0.9.0"], ["cmdstan", "2.39.0"]]) {
    if (evidence?.environment?.[name] !== expected) {
      errors.push(`Stanケース実行証拠の${name}版は${expected}である必要があります`);
    }
  }
  for (const check of [
    "syntax", "compile", "fixedParameterPriorPredictive", "correctModelSampling",
    "wrongModelSampling", "diagnosticSummary", "posteriorPrediction", "visualInspection",
  ]) {
    if (evidence?.checks?.[check] !== "PASS") errors.push(`Stanケース実行証拠の${check}がPASSではありません`);
  }

  const scenario = evidence?.scenario || {};
  if (scenario.seed !== 20260802 || scenario.observations !== 2000 ||
      scenario.trueMu !== 0.15 || scenario.trueSigma !== 0.45 ||
      scenario.lowerBound !== 0 || scenario.upperBound !== 1.5) {
    errors.push("Stanケース実行証拠の生成条件が教材コードと一致しません");
  }
  if (!Number.isFinite(scenario.retentionProbability) ||
      Math.abs(scenario.retentionProbability - 0.6292087618) > 1e-9) {
    errors.push("Stanケース実行証拠の保存確率が数式と一致しません");
  }

  if (evidence?.sample?.chains !== 4 || evidence?.sample?.iterWarmup !== 1000 ||
      evidence?.sample?.iterSampling !== 1000 ||
      evidence?.sample?.priorIterationsPerScenario !== 1000 ||
      evidence?.sample?.initialization !== 0) {
    errors.push("Stanケース実行証拠のサンプリング条件が教材コードと一致しません");
  }

  const prior = new Map((evidence?.priorPredictive || []).map((item) => [item.scenario, item]));
  if (!["narrow", "baseline", "wide"].every((name) => prior.has(name))) {
    errors.push("Stanケース実行証拠の事前予測3条件が揃っていません");
  } else if (!(prior.get("narrow").ySd < prior.get("baseline").ySd &&
               prior.get("baseline").ySd < prior.get("wide").ySd &&
               prior.get("narrow").sigmaMean < prior.get("baseline").sigmaMean &&
               prior.get("baseline").sigmaMean < prior.get("wide").sigmaMean)) {
    errors.push("ハイパーパラメータ変更と事前予測の広がりが対応していません");
  }

  for (const [label, diagnostics] of Object.entries(evidence?.diagnostics || {})) {
    if (!diagnostics?.divergentByChain?.every((value) => value === 0)) {
      errors.push(`${label}: divergenceが残っています`);
    }
    if (!diagnostics?.maxTreedepthByChain?.every((value) => value === 0)) {
      errors.push(`${label}: 最大treedepth到達が残っています`);
    }
    if (!diagnostics?.ebfmiByChain?.every((value) => Number.isFinite(value) && value >= 0.3)) {
      errors.push(`${label}: E-BFMIが基準を満たしません`);
    }
    if (!Number.isFinite(diagnostics?.reportedRhatMax) || diagnostics.reportedRhatMax > 1.01) {
      errors.push(`${label}: R-hatが基準を満たしません`);
    }
    if (!Number.isFinite(diagnostics?.reportedEssBulkMin) || diagnostics.reportedEssBulkMin < 400 ||
        !Number.isFinite(diagnostics?.reportedEssTailMin) || diagnostics.reportedEssTailMin < 400) {
      errors.push(`${label}: ESSが基準を満たしません`);
    }
  }
  if (!evidence?.diagnostics?.correctTruncated || !evidence?.diagnostics?.wrongNaive) {
    errors.push("正答・誤答両モデルの計算診断がありません");
  }

  const correct = evidence?.posteriorComparison?.correctTruncated || {};
  const wrong = evidence?.posteriorComparison?.wrongNaive || {};
  if (Math.abs(correct.muMean - scenario.trueMu) > 0.02 ||
      Math.abs(correct.sigmaMean - scenario.trueSigma) > 0.02) {
    errors.push("正しい切断モデルが合成データの真値を回収していません");
  }
  if (Math.abs(wrong.muMean - scenario.trueMu) < 0.2 ||
      Math.abs(wrong.sigmaMean - scenario.trueSigma) < 0.1) {
    errors.push("意図的な誤答モデルの推定ずれが教材比較として不足しています");
  }

  const expectedArtifacts = [
    "scenario-data.csv", "scenario-metadata.csv", "prior-predictive-summary.csv",
    "model-comparison.csv", "diagnostics.csv", "01-stan-prior-predictive.png",
    "02-truncation-estimates.png", "03-truncated-posterior-predictive.png",
  ];
  if ([...(evidence?.artifacts || [])].sort().join("|") !== [...expectedArtifacts].sort().join("|")) {
    errors.push("Stanケース実行証拠の成果物契約が8点と一致しません");
  }
  if (!Array.isArray(evidence?.limitations) || evidence.limitations.length < 5) {
    errors.push("Stanケース実行証拠の限界が十分に記録されていません");
  }
  return errors;
}

export function validateLinkComparisonLab(
  markdown,
  simulationSource,
  comparisonRunner,
  linearStan,
  quadraticStan,
  poissonStan
) {
  const errors = [];
  for (const phrase of [
    "線形予測子", "inverse link", "identity", "logit", "probit", "complementary log-log",
    "offset", "一定の「確率差」", "比較前提", "観測ごとの`log_lik`", "PSIS-LOO",
    "elpd_diff", "se_diff", "Pareto \\(k\\)", "stacking weight", "posterior model probability",
    "事後予測チェック", "同じ観測対象", "leave-future-out",
  ]) {
    if (!markdown.includes(phrase)) errors.push(`リンク関数・比較原稿に必須説明「${phrase}」がありません`);
  }
  const displayMathCount = (markdown.match(/\\\[/g) || []).length;
  if (displayMathCount < 18) errors.push("リンク関数・比較原稿の数式例が18個未満です");
  const questionCount = (markdown.match(/^### 問\d+/gm) || []).length;
  if (questionCount !== 12) errors.push("リンク関数・比較原稿の内容理解問題は12問である必要があります");
  for (const file of [
    "binary-logit-linear.stan", "binary-logit-quadratic.stan", "poisson-log-exposure.stan",
    "simulate-link-functions.R", "run-link-model-comparison.R", "link-comparison-validation.json",
  ]) {
    if (!markdown.includes(file)) errors.push(`リンク関数・比較原稿から${file}への導線がありません`);
  }
  for (const value of ["-231.412", "-212.278", "-19.134", "5.601", "0.158", "0.9999997"]) {
    if (!markdown.includes(value)) errors.push(`リンク関数・比較原稿に実測値${value}がありません`);
  }

  const expectedBinaryBlocks = "data|parameters|transformed parameters|model|generated quantities";
  for (const [label, source] of [["線形logit", linearStan], ["二次logit", quadraticStan]]) {
    let blocks = [];
    try {
      blocks = extractStanBlocks(source).map((block) => block.name);
    } catch (error) {
      errors.push(`${label}Stanコード: ${error.message}`);
    }
    if (blocks.join("|") !== expectedBinaryBlocks) {
      errors.push(`${label}Stanコードのブロック構成が教材契約と一致しません`);
    }
    for (const [pattern, message] of [
      [/array\s*\[\s*N\s*]\s*int\s*<\s*lower\s*=\s*0\s*,\s*upper\s*=\s*1\s*>\s*y/, "二値応答の型がありません"],
      [/y\s*~\s*bernoulli_logit\s*\(\s*eta\s*\)/, "数値的に安定なBernoulli-logit尤度がありません"],
      [/log_lik\s*\[\s*n\s*]\s*=\s*bernoulli_logit_lpmf\s*\(/, "観測別log_likがありません"],
      [/y_rep\s*\[\s*n\s*]\s*=\s*bernoulli_logit_rng\s*\(/, "二値事後予測がありません"],
    ]) requiresMatch(errors, source, pattern, `${label}: ${message}`);
  }
  for (const [pattern, message] of [
    [/beta_square\s*~\s*normal\s*\(/, "二次logitモデルに二次係数の事前分布がありません"],
    [/beta_square\s*\*\s*square\s*\(\s*x\s*\)/, "二次logitモデルの線形予測子に二次項がありません"],
  ]) requiresMatch(errors, quadraticStan, pattern, message);

  let poissonBlocks = [];
  try {
    poissonBlocks = extractStanBlocks(poissonStan).map((block) => block.name);
  } catch (error) {
    errors.push(`Poisson-log Stanコード: ${error.message}`);
  }
  if (poissonBlocks.join("|") !== expectedBinaryBlocks) {
    errors.push("Poisson-log Stanコードのブロック構成が教材契約と一致しません");
  }
  for (const [pattern, message] of [
    [/vector\s*<\s*lower\s*=\s*0\s*>\s*\[\s*N\s*]\s*exposure/, "曝露量の正値データがありません"],
    [/log\s*\(\s*exposure\s*\)\s*\+\s*alpha/, "log曝露量offsetがありません"],
    [/y\s*~\s*poisson_log\s*\(\s*log_rate\s*\)/, "Poisson-log尤度がありません"],
    [/poisson_log_lpmf\s*\(/, "Poisson観測別log_likがありません"],
    [/poisson_log_rng\s*\(/, "Poisson事後予測がありません"],
  ]) requiresMatch(errors, poissonStan, pattern, message);

  for (const [pattern, message] of [
    [/run_link_function_lab\s*<-\s*function/, "リンク可視化が再利用可能な関数ではありません"],
    [/plogis\s*\(/, "logit inverse linkの計算がありません"],
    [/pnorm\s*\(/, "probit inverse linkの計算がありません"],
    [/-expm1\s*\(\s*-exp\s*\(/, "cloglog inverse linkの安定な計算がありません"],
    [/logit-baseline-effects\.csv/, "基準確率別の確率差出力がありません"],
    [/03-poisson-log-exposure\.png/, "Poisson offset可視化がありません"],
  ]) requiresMatch(errors, simulationSource, pattern, message);

  for (const [pattern, message] of [
    [/library\s*\(\s*loo\s*\)/, "looパッケージを読み込んでいません"],
    [/relative_eff\s*\(\s*exp\s*\(/, "MCMC drawのrelative_effを計算していません"],
    [/loo\s*\(\s*value\s*,\s*r_eff\s*=/, "PSIS-LOOをr_eff付きで計算していません"],
    [/loo_compare\s*\(/, "loo_compareを実行していません"],
    [/pareto_k_values\s*\(/, "Pareto kを観測別に保存していません"],
    [/loo_model_weights\s*\([^)]*method\s*=\s*"stacking"/s, "stacking weightを計算していません"],
    [/chains\s*=\s*4L/, "比較ケースの既定chain数が4ではありません"],
    [/iter_warmup\s*=\s*750L/, "比較ケースの既定warmupが750ではありません"],
    [/iter_sampling\s*=\s*750L/, "比較ケースの既定samplingが750ではありません"],
    [/seed\s*=\s*20260802L/, "比較ケースの固定seedが教材契約と一致しません"],
    [/n\s*=\s*400L/, "比較ケースの観測数が400ではありません"],
    [/pointwise-elpd\.csv/, "pointwise ELPD差を保存していません"],
    [/stacking-weights\.csv/, "stacking weightを保存していません"],
  ]) requiresMatch(errors, comparisonRunner, pattern, message);
  return errors;
}

export function validateLinkComparisonEvidence(evidence, sources) {
  const errors = [];
  if (evidence?.schemaVersion !== 1) errors.push("link-comparison-validation.schemaVersionは1である必要があります");
  if (evidence?.status !== "PASS") errors.push("リンク関数・LOO実行証拠はPASSである必要があります");
  for (const [name, source] of Object.entries(sources)) {
    if (evidence?.sourceHashes?.[name] !== sha256(source)) {
      errors.push(`${name}がリンク関数・LOO実行証拠取得後に変更されています`);
    }
  }
  for (const [name, expected] of [
    ["r", "4.6.1"], ["cmdstanr", "0.9.0"], ["cmdstan", "2.39.0"], ["loo", "2.10.1"],
  ]) {
    if (evidence?.environment?.[name] !== expected) {
      errors.push(`リンク関数・LOO実行証拠の${name}版は${expected}である必要があります`);
    }
  }
  for (const check of [
    "linkSimulation", "syntax", "compile", "linearModelSampling", "quadraticModelSampling",
    "diagnosticSummary", "pointwiseLogLikelihood", "psisLoo", "paretoK", "stacking", "visualInspection",
  ]) {
    if (evidence?.checks?.[check] !== "PASS") {
      errors.push(`リンク関数・LOO実行証拠の${check}がPASSではありません`);
    }
  }
  const scenario = evidence?.scenario || {};
  if (scenario.seed !== 20260802 || scenario.observations !== 400 || scenario.successes !== 113 ||
      scenario.trueAlpha !== -0.4 || scenario.trueBetaLinear !== 1.1 || scenario.trueBetaSquare !== -0.9) {
    errors.push("リンク関数・LOO実行証拠の生成条件が教材コードと一致しません");
  }
  if (evidence?.sample?.chains !== 4 || evidence?.sample?.iterWarmup !== 750 ||
      evidence?.sample?.iterSampling !== 750 || evidence?.sample?.posteriorDraws !== 3000) {
    errors.push("リンク関数・LOO実行証拠のサンプリング条件が教材コードと一致しません");
  }
  for (const [label, diagnostics] of Object.entries(evidence?.diagnostics || {})) {
    if (!diagnostics?.divergentByChain?.every((value) => value === 0)) errors.push(`${label}: divergenceが残っています`);
    if (!diagnostics?.maxTreedepthByChain?.every((value) => value === 0)) errors.push(`${label}: 最大treedepth到達が残っています`);
    if (!diagnostics?.ebfmiByChain?.every((value) => Number.isFinite(value) && value >= 0.3)) errors.push(`${label}: E-BFMIが基準を満たしません`);
    if (!Number.isFinite(diagnostics?.reportedRhatMax) || diagnostics.reportedRhatMax > 1.01) errors.push(`${label}: R-hatが基準を満たしません`);
    if (!Number.isFinite(diagnostics?.reportedEssBulkMin) || diagnostics.reportedEssBulkMin < 400 ||
        !Number.isFinite(diagnostics?.reportedEssTailMin) || diagnostics.reportedEssTailMin < 400) {
      errors.push(`${label}: ESSが基準を満たしません`);
    }
  }
  if (!evidence?.diagnostics?.linear || !evidence?.diagnostics?.quadratic) {
    errors.push("線形・二次両モデルの計算診断がありません");
  }
  const comparison = evidence?.modelComparison || {};
  const linear = comparison.linear || {};
  const quadratic = comparison.quadratic || {};
  if (!(quadratic.elpdLoo > linear.elpdLoo && linear.elpdDiff < -10 && linear.seDiff > 0 &&
        Math.abs(linear.elpdDiff) > 2 * linear.seDiff)) {
    errors.push("二次モデルの予測優位とELPD差の不確実性が教材ケースで再現されていません");
  }
  if (comparison.paretoThreshold !== 0.7 || linear.paretoKFlagged !== 0 ||
      quadratic.paretoKFlagged !== 0 || linear.paretoKMax > comparison.paretoThreshold ||
      quadratic.paretoKMax > comparison.paretoThreshold) {
    errors.push("PSIS-LOOのPareto k診断が教材ケース契約を満たしません");
  }
  if (Math.abs(linear.elpdDiff + comparison.pointwiseElpdDifferenceSum) > 1e-6) {
    errors.push("pointwise ELPD差の合計がloo_compareの差と一致しません");
  }
  if (Math.abs(linear.stackingWeight + quadratic.stackingWeight - 1) > 1e-8 ||
      quadratic.stackingWeight < 0.95) {
    errors.push("stacking weightが予測比較結果と一致しません");
  }
  const expectedArtifacts = [
    "link-function-summary.csv", "logit-baseline-effects.csv", "01-binary-inverse-links.png",
    "02-logit-coefficient-baseline.png", "03-poisson-log-exposure.png", "simulated-binary-data.csv",
    "model-comparison.csv", "pareto-k.csv", "stacking-weights.csv", "diagnostics.csv",
    "04-loo-model-predictions.png", "pointwise-elpd.csv", "05-pointwise-elpd.png",
  ];
  if ([...(evidence?.artifacts || [])].sort().join("|") !== [...expectedArtifacts].sort().join("|")) {
    errors.push("リンク関数・LOO実行証拠の成果物契約が13点と一致しません");
  }
  if (!Array.isArray(evidence?.limitations) || evidence.limitations.length < 5) {
    errors.push("リンク関数・LOO実行証拠の限界が十分に記録されていません");
  }
  return errors;
}

export function validateCurriculum(curriculum) {
  const errors = [];
  if (curriculum?.schemaVersion !== 1) errors.push("curriculum.schemaVersionは1である必要があります");
  if (curriculum?.status !== "draft-unpublished") errors.push("Stan教材は公開ゲート通過までdraft-unpublishedである必要があります");
  if (!Array.isArray(curriculum?.lessons)) return [...errors, "curriculum.lessonsがありません"];

  const grammarPractice = curriculum?.grammarPractice;
  if (grammarPractice?.artifact !== "grammar-drills.json" ||
      grammarPractice?.manuscript !== "distribution-grammar-lab.md") {
    errors.push("カリキュラムから分布文法教材への導線がありません");
  }
  if (grammarPractice?.unitIds?.join("|") !== EXPECTED_GRAMMAR_UNIT_IDS.join("|")) {
    errors.push("カリキュラムの文法単元はg01〜g08である必要があります");
  }
  if (grammarPractice?.stageOrder?.join("|") !== EXPECTED_PRACTICE_STAGES.join("|")) {
    errors.push("カリキュラムの文法練習順が4段階設計と一致しません");
  }
  const mappedUnits = Object.values(grammarPractice?.lessonMap || {}).flat();
  if ([...mappedUnits].sort().join("|") !== [...EXPECTED_GRAMMAR_UNIT_IDS].sort().join("|")) {
    errors.push("8つの文法単元がL35〜L40へ一度ずつ対応していません");
  }
  if (!grammarPractice?.masteryPolicy?.includes("白紙再現") ||
      !grammarPractice?.masteryPolicy?.includes("転移")) {
    errors.push("文法練習の合格方針に白紙再現と転移がありません");
  }

  const syntaxSpine = curriculum?.syntaxSpine;
  if (syntaxSpine?.status !== "planned-extension" ||
      syntaxSpine?.start !== "step5-brms-stancode" ||
      syntaxSpine?.end !== "l41-delayed-transfer") {
    errors.push("Stan構文スパインの開始・終了・計画状態が一致しません");
  }
  if (syntaxSpine?.layers?.map((layer) => layer.id).join("|") !== EXPECTED_SYNTAX_LAYER_IDS.join("|") ||
      syntaxSpine?.layers?.some((layer) => !Array.isArray(layer.focus) || layer.focus.length < 4)) {
    errors.push("Stan構文スパインは言語・確率モデル・計算の三層を十分な範囲で定義する必要があります");
  }
  if (syntaxSpine?.encounters?.join("|") !== EXPECTED_SYNTAX_ENCOUNTERS.join("|")) {
    errors.push("Stan構文スパインの反復は読解から遅延転移までの6接触である必要があります");
  }
  if (syntaxSpine?.lessonPlan?.map((item) => item.stage).join("|") !== EXPECTED_SYNTAX_LESSON_STAGES.join("|") ||
      syntaxSpine?.lessonPlan?.some((item) => !item.role)) {
    errors.push("Stan構文スパインがSTEP 5からL41まで連続配置されていません");
  }
  const delayedChecks = syntaxSpine?.delayedChecks || [];
  if (delayedChecks.length !== 3 ||
      delayedChecks.some((check) => !check.after || !check.evidence || !Array.isArray(check.revisit)) ||
      delayedChecks.at(-1)?.revisit?.join("|") !== EXPECTED_GRAMMAR_UNIT_IDS.join("|")) {
    errors.push("Stan構文スパインに累積・遅延想起の評価証拠が不足しています");
  }
  if (syntaxSpine?.releaseGates?.join("|") !== EXPECTED_SYNTAX_RELEASE_GATES.join("|")) {
    errors.push("Stan構文スパインの公開ゲートが構文・説明・転移・遅延保持を分離していません");
  }
  const errorCorpus = syntaxSpine?.errorCorpus;
  if (errorCorpus?.status !== "draft-unpublished" ||
      errorCorpus?.artifact !== "syntax-error-corpus.json" ||
      errorCorpus?.evidence !== "syntax-error-validation.json" ||
      errorCorpus?.runner !== "scripts/verify-stan-syntax-errors.mjs") {
    errors.push("Stan構文スパインからエラーコーパス・実測証拠・検証器への導線がありません");
  }
  if (errorCorpus?.caseIds?.join("|") !== EXPECTED_SYNTAX_ERROR_IDS.join("|") ||
      errorCorpus?.compiler !== "stanc3 2.39.0" || errorCorpus?.coverage?.length !== 8) {
    errors.push("Stan構文エラーコーパスの8分類と固定コンパイラ契約が一致しません");
  }
  const modelReview = syntaxSpine?.modelReview;
  if (modelReview?.status !== "draft-unpublished" ||
      modelReview?.artifact !== "model-review-corpus.json" ||
      modelReview?.evidence !== "model-review-validation.json" ||
      modelReview?.runner !== "scripts/verify-stan-model-review.mjs") {
    errors.push("Stan構文スパインからモデルレビュー正本・実測証拠・検証器への導線がありません");
  }
  if (modelReview?.caseIds?.join("|") !== EXPECTED_MODEL_REVIEW_IDS.join("|") ||
      modelReview?.compiler !== "stanc3 2.39.0" || modelReview?.reviewClasses?.length !== 6) {
    errors.push("Stanモデルレビューの6分類と固定コンパイラ契約が一致しません");
  }
  const retentionPlan = syntaxSpine?.retentionPlan;
  if (retentionPlan?.status !== "draft-unpublished" ||
      retentionPlan?.plan !== "syntax-retention-plan.json" ||
      retentionPlan?.assessments !== "syntax-retention-assessments.json" ||
      retentionPlan?.evidence !== "syntax-retention-validation.json" ||
      retentionPlan?.runner !== "scripts/verify-stan-retention.mjs") {
    errors.push("Stan構文スパインから保持・転移計画、課題、証拠、検証器への導線がありません");
  }
  if (retentionPlan?.checkpointIds?.join("|") !== EXPECTED_RETENTION_CHECKPOINT_IDS.join("|") ||
      retentionPlan?.taskCount !== 10 || retentionPlan?.delayedWindowDays?.join("|") !== "7|14" ||
      retentionPlan?.thresholdStatus !== "not-fixed-before-pilot") {
    errors.push("Stan保持・転移計画の3地点・10課題・暫定遅延窓が一致しません");
  }

  const caseStudy = curriculum?.caseStudies?.find((item) => item.id === "stan-case-truncation-01");
  if (!caseStudy) {
    errors.push("切断モデルの実行ケーススタディがカリキュラムにありません");
  } else {
    if (caseStudy.status !== "draft-unpublished") errors.push("切断ケースは公開ゲート通過まで非公開である必要があります");
    if (caseStudy.manuscript !== "truncation-case-study.md" ||
        caseStudy.runner !== "examples/run-distribution-models.R" ||
        caseStudy.evidence !== "scenario-validation.json") {
      errors.push("切断ケースの原稿・実行コード・証拠への導線が一致しません");
    }
    if (caseStudy.prerequisiteUnits?.join("|") !== "g04|g05|g06") {
      errors.push("切断ケースの文法前提はg04〜g06である必要があります");
    }
    if (!Array.isArray(caseStudy.models) || caseStudy.models.length !== 3 ||
        caseStudy.artifactCount !== 8) {
      errors.push("切断ケースは3モデル・8成果物の契約である必要があります");
    }
  }

  const linkCase = curriculum?.caseStudies?.find((item) => item.id === "stan-case-link-loo-01");
  if (!linkCase) {
    errors.push("リンク関数とLOOの実行ケーススタディがカリキュラムにありません");
  } else {
    if (linkCase.status !== "draft-unpublished") {
      errors.push("リンク関数・LOOケースは公開ゲート通過まで非公開である必要があります");
    }
    if (linkCase.manuscript !== "link-functions-model-comparison.md" ||
        linkCase.runner !== "examples/run-link-model-comparison.R" ||
        linkCase.evidence !== "link-comparison-validation.json") {
      errors.push("リンク関数・LOOケースの原稿・実行コード・証拠への導線が一致しません");
    }
    if (linkCase.prerequisiteUnits?.join("|") !== "g03|g04|g07|g08") {
      errors.push("リンク関数・LOOケースの文法前提が教材設計と一致しません");
    }
    if (!Array.isArray(linkCase.models) || linkCase.models.length !== 3 ||
        linkCase.artifactCount !== 13) {
      errors.push("リンク関数・LOOケースは3モデル・13成果物の契約である必要があります");
    }
  }

  const ids = curriculum.lessons.map((lesson) => lesson.id);
  if (ids.join("|") !== EXPECTED_LESSON_IDS.join("|")) errors.push("Stan編はL34–L41の連続した8レッスンである必要があります");
  if (new Set(ids).size !== ids.length) errors.push("StanレッスンIDが重複しています");
  const positions = new Map(ids.map((id, index) => [id, index]));

  curriculum.lessons.forEach((lesson, index) => {
    if (typeof lesson.title !== "string" || !lesson.title.trim()) errors.push(`${lesson.id}: titleがありません`);
    if (typeof lesson.outcome !== "string" || !lesson.outcome.trim()) errors.push(`${lesson.id}: outcomeがありません`);
    if (!Array.isArray(lesson.concepts) || lesson.concepts.length < 2) errors.push(`${lesson.id}: conceptsが不足しています`);
    if (!Array.isArray(lesson.directEvidence) || lesson.directEvidence.length === 0) errors.push(`${lesson.id}: 直接評価証拠がありません`);
    for (const evidence of lesson.directEvidence || []) {
      if (!evidence.artifact || !evidence.method || !evidence.criterion) errors.push(`${lesson.id}: 評価証拠のartifact・method・criterionが不完全です`);
    }
    for (const prerequisite of lesson.prerequisites || []) {
      if (prerequisite === curriculum.entryPrerequisite && index === 0) continue;
      if (!positions.has(prerequisite)) errors.push(`${lesson.id}: 未知の前提${prerequisite}があります`);
      else if (positions.get(prerequisite) >= index) errors.push(`${lesson.id}: 後続レッスン${prerequisite}へ逆依存しています`);
    }
  });

  if (!Array.isArray(curriculum.officialSources) || curriculum.officialSources.length < 4) {
    errors.push("Stan公式資料が不足しています");
  } else if (curriculum.officialSources.some((url) => !/^https:\/\/mc-stan\.org\//.test(url))) {
    errors.push("Stan教材の技術資料はmc-stan.orgの一次資料へ限定します");
  }
  return errors;
}

export function extractFencedCode(markdown, language) {
  const match = markdown.match(new RegExp("```" + language + "\\r?\\n([\\s\\S]*?)\\r?\\n```"));
  return match?.[1] ?? null;
}

export function validateManuscript(markdown, stanSource, runnerSource) {
  const errors = [];
  const stanBlock = extractFencedCode(markdown, "stan");
  const rBlock = extractFencedCode(markdown, "r");
  if (!stanBlock) errors.push("原稿にStanコードブロックがありません");
  else if (normalizeText(stanBlock) !== normalizeText(stanSource)) errors.push("原稿のStanコードが実行用.stanファイルと一致しません");
  if (!rBlock) errors.push("原稿にRコードブロックがありません");
  else if (normalizeText(rBlock) !== normalizeText(runnerSource)) errors.push("原稿のRコードが実行用Rスクリプトと一致しません");

  for (const phrase of ["データ契約", "`target`", "乱数を代入する命令ではない", "generated quantities", "推定値より先に診断", "事後予測チェック"]) {
    if (!markdown.includes(phrase)) errors.push(`原稿に必須説明「${phrase}」がありません`);
  }
  const exerciseCount = (markdown.match(/^### 課題[A-Z]/gm) || []).length;
  if (exerciseCount < 5) errors.push("直接評価課題が5件未満です");
  return errors;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateRuntimeEvidence(evidence, stanSource, runnerSource) {
  const errors = [];
  if (evidence?.schemaVersion !== 1) errors.push("validation.schemaVersionは1である必要があります");
  if (evidence?.status !== "PASS") errors.push("Stan実行証拠がPASSではありません");
  if (evidence?.sourceHashes?.["linear-regression.stan"] !== sha256(stanSource)) {
    errors.push("Stanコードが実行証拠取得後に変更されています");
  }
  if (evidence?.sourceHashes?.["run-linear-regression.R"] !== sha256(runnerSource)) {
    errors.push("R実行コードが実行証拠取得後に変更されています");
  }
  for (const [name, expected] of [["r", "4.6.1"], ["cmdstanr", "0.9.0"], ["cmdstan", "2.39.0"]]) {
    if (evidence?.environment?.[name] !== expected) errors.push(`実行証拠の${name}版は${expected}である必要があります`);
  }
  for (const check of ["syntax", "compile", "sample", "diagnosticSummary", "posteriorPrediction"]) {
    if (evidence?.checks?.[check] !== "PASS") errors.push(`実行証拠の${check}がPASSではありません`);
  }
  if (evidence?.sample?.seed !== 20260801 || evidence?.sample?.chains !== 4 ||
      evidence?.sample?.iterWarmup !== 1000 || evidence?.sample?.iterSampling !== 1000) {
    errors.push("実行証拠のseed・chain・iteration設定が教材コードと一致しません");
  }
  if (!evidence?.diagnostics?.divergentByChain?.every((value) => value === 0)) errors.push("divergent transitionが残っています");
  if (!evidence?.diagnostics?.maxTreedepthByChain?.every((value) => value === 0)) errors.push("最大treedepth到達が残っています");
  if (!evidence?.diagnostics?.ebfmiByChain?.every((value) => Number.isFinite(value) && value >= 0.3)) errors.push("E-BFMIが診断基準を満たしません");
  if (!Number.isFinite(evidence?.diagnostics?.reportedRhatMax) || evidence.diagnostics.reportedRhatMax > 1.01) errors.push("R-hatが診断基準を満たしません");
  if (!Number.isFinite(evidence?.diagnostics?.reportedEssBulkMin) || evidence.diagnostics.reportedEssBulkMin < 400) errors.push("bulk ESSが診断基準を満たしません");
  if (!Number.isFinite(evidence?.diagnostics?.reportedEssTailMin) || evidence.diagnostics.reportedEssTailMin < 400) errors.push("tail ESSが診断基準を満たしません");
  if (!Array.isArray(evidence?.limitations) || evidence.limitations.length < 2) errors.push("実行証拠の限界が明記されていません");
  return errors;
}

export function loadStanContent(root = process.cwd()) {
  const base = resolve(root, "content", "stan");
  const curriculum = JSON.parse(readFileSync(resolve(base, "curriculum.json"), "utf8"));
  const foundationAssessments = JSON.parse(
    readFileSync(resolve(base, "foundation-assessments.json"), "utf8")
  );
  const lessonManuscripts = Object.fromEntries(
    (curriculum.lessonDelivery?.authoredLessonIds || []).map((lessonId) => {
      const lesson = curriculum.lessons.find((item) => item.id === lessonId);
      return [
        lessonId,
        normalizeLineEndings(readFileSync(resolve(base, lesson.manuscript), "utf8")),
      ];
    })
  );
  const syntaxErrorCorpusSource = normalizeLineEndings(
    readFileSync(resolve(base, "syntax-error-corpus.json"), "utf8")
  );
  const syntaxErrorCorpus = JSON.parse(syntaxErrorCorpusSource);
  const syntaxErrorSources = Object.fromEntries(
    syntaxErrorCorpus.cases.flatMap((item) => [item.broken, item.fixed]).map((relativePath) => [
      relativePath,
      normalizeLineEndings(readFileSync(resolve(base, relativePath), "utf8")),
    ])
  );
  const modelReviewCorpusSource = normalizeLineEndings(
    readFileSync(resolve(base, "model-review-corpus.json"), "utf8")
  );
  const modelReviewCorpus = JSON.parse(modelReviewCorpusSource);
  const modelReviewSources = Object.fromEntries(
    modelReviewCorpus.cases.flatMap((item) => [item.candidate, item.reference]).map((relativePath) => [
      relativePath,
      normalizeLineEndings(readFileSync(resolve(base, relativePath), "utf8")),
    ])
  );
  const syntaxRetentionPlanSource = normalizeLineEndings(
    readFileSync(resolve(base, "syntax-retention-plan.json"), "utf8")
  );
  const syntaxRetentionAssessmentSource = normalizeLineEndings(
    readFileSync(resolve(base, "syntax-retention-assessments.json"), "utf8")
  );
  return {
    curriculum,
    foundationAssessments,
    lessonManuscripts,
    grammarDrills: JSON.parse(readFileSync(resolve(base, "grammar-drills.json"), "utf8")),
    syntaxErrorCorpus,
    syntaxErrorCorpusSource,
    syntaxErrorEvidence: JSON.parse(
      readFileSync(resolve(base, "syntax-error-validation.json"), "utf8")
    ),
    syntaxErrorSources,
    modelReviewCorpus,
    modelReviewCorpusSource,
    modelReviewEvidence: JSON.parse(
      readFileSync(resolve(base, "model-review-validation.json"), "utf8")
    ),
    modelReviewSources,
    syntaxRetentionPlan: JSON.parse(syntaxRetentionPlanSource),
    syntaxRetentionPlanSource,
    syntaxRetentionAssessments: JSON.parse(syntaxRetentionAssessmentSource),
    syntaxRetentionAssessmentSource,
    syntaxRetentionEvidence: JSON.parse(
      readFileSync(resolve(base, "syntax-retention-validation.json"), "utf8")
    ),
    syntaxRetentionReference: normalizeLineEndings(
      readFileSync(resolve(base, "retention", "facilitator", "positive-duration-reference.stan"), "utf8")
    ),
    manuscript: normalizeLineEndings(
      readFileSync(resolve(base, "linear-regression.md"), "utf8")
    ),
    distributionManuscript: normalizeLineEndings(
      readFileSync(resolve(base, "distribution-grammar-lab.md"), "utf8")
    ),
    scenarioManuscript: normalizeLineEndings(
      readFileSync(resolve(base, "truncation-case-study.md"), "utf8")
    ),
    linkComparisonManuscript: normalizeLineEndings(
      readFileSync(resolve(base, "link-functions-model-comparison.md"), "utf8")
    ),
    stanSource: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "linear-regression.stan"), "utf8")
    ),
    priorPredictiveStan: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "prior-predictive.stan"), "utf8")
    ),
    truncatedNormalStan: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "truncated-normal.stan"), "utf8")
    ),
    wrongNaiveStan: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "wrong-naive-bounded-normal.stan"), "utf8")
    ),
    binaryLogitLinearStan: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "binary-logit-linear.stan"), "utf8")
    ),
    binaryLogitQuadraticStan: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "binary-logit-quadratic.stan"), "utf8")
    ),
    poissonLogExposureStan: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "poisson-log-exposure.stan"), "utf8")
    ),
    runnerSource: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "run-linear-regression.R"), "utf8")
    ),
    distributionRunner: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "simulate-distributions.R"), "utf8")
    ),
    scenarioRunner: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "run-distribution-models.R"), "utf8")
    ),
    linkSimulationRunner: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "simulate-link-functions.R"), "utf8")
    ),
    linkComparisonRunner: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "run-link-model-comparison.R"), "utf8")
    ),
    runtimeEvidence: JSON.parse(readFileSync(resolve(base, "validation.json"), "utf8")),
    scenarioEvidence: JSON.parse(readFileSync(resolve(base, "scenario-validation.json"), "utf8")),
    linkComparisonEvidence: JSON.parse(
      readFileSync(resolve(base, "link-comparison-validation.json"), "utf8")
    ),
  };
}

export function validateStanContent(content) {
  return [
    ...validateCurriculum(content.curriculum),
    ...validateFoundationLessons(
      content.curriculum,
      content.foundationAssessments,
      content.lessonManuscripts
    ),
    ...validateGrammarDrills(content.grammarDrills),
    ...validateSyntaxErrorCorpus(
      content.syntaxErrorCorpus,
      content.syntaxErrorEvidence,
      content.syntaxErrorSources,
      content.syntaxErrorCorpusSource
    ),
    ...validateModelReviewCorpus(
      content.modelReviewCorpus,
      content.modelReviewEvidence,
      content.modelReviewSources,
      content.modelReviewCorpusSource
    ),
    ...validateSyntaxRetention(
      content.syntaxRetentionPlan,
      content.syntaxRetentionAssessments,
      content.syntaxRetentionEvidence,
      content.syntaxRetentionReference,
      content.syntaxRetentionPlanSource,
      content.syntaxRetentionAssessmentSource
    ),
    ...validateStanProgram(content.stanSource),
    ...validateCmdStanRunner(content.runnerSource),
    ...validateManuscript(content.manuscript, content.stanSource, content.runnerSource),
    ...validateDistributionGrammarLab(
      content.distributionManuscript,
      content.distributionRunner,
      content.priorPredictiveStan,
      content.truncatedNormalStan
    ),
    ...validateWrongNaiveProgram(content.wrongNaiveStan),
    ...validateScenarioRunner(content.scenarioRunner),
    ...validateScenarioManuscript(content.scenarioManuscript),
    ...validateLinkComparisonLab(
      content.linkComparisonManuscript,
      content.linkSimulationRunner,
      content.linkComparisonRunner,
      content.binaryLogitLinearStan,
      content.binaryLogitQuadraticStan,
      content.poissonLogExposureStan
    ),
    ...validateRuntimeEvidence(content.runtimeEvidence, content.stanSource, content.runnerSource),
    ...validateScenarioEvidence(content.scenarioEvidence, {
      "prior-predictive.stan": content.priorPredictiveStan,
      "truncated-normal.stan": content.truncatedNormalStan,
      "wrong-naive-bounded-normal.stan": content.wrongNaiveStan,
      "run-distribution-models.R": content.scenarioRunner,
    }),
    ...validateLinkComparisonEvidence(content.linkComparisonEvidence, {
      "binary-logit-linear.stan": content.binaryLogitLinearStan,
      "binary-logit-quadratic.stan": content.binaryLogitQuadraticStan,
      "poisson-log-exposure.stan": content.poissonLogExposureStan,
      "simulate-link-functions.R": content.linkSimulationRunner,
      "run-link-model-comparison.R": content.linkComparisonRunner,
    }),
  ];
}

function runCli() {
  let content;
  try {
    content = loadStanContent();
  } catch (error) {
    console.error(`Stan教材を読み込めません: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const errors = validateStanContent(content);
  if (errors.length > 0) {
    console.error("Stan教材の静的検証に失敗しました:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Stan content: PASS (${content.curriculum.lessons.length} draft lessons, ` +
    `${content.curriculum.lessonDelivery.authoredLessonIds.length} authored lesson manuscripts, ` +
    `${content.foundationAssessments.lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0)} foundation assessments, ` +
    `${content.grammarDrills.units.length} grammar units, ` +
    `${content.grammarDrills.units.length * EXPECTED_PRACTICE_STAGES.length} scaffolded drills, ` +
    `${content.syntaxErrorCorpus.cases.length} compiler-error pairs, ` +
    `${content.modelReviewCorpus.cases.length} compile-success review pairs, ` +
    `${content.syntaxRetentionAssessments.tasks.length} retention tasks, ` +
    `7 executable Stan examples, 2 runtime-verified comparison scenarios)`
  );
  console.log(
    `Compiler/runtime evidence: PASS (R ${content.runtimeEvidence.environment.r}, ` +
    `CmdStanR ${content.runtimeEvidence.environment.cmdstanr}, CmdStan ${content.runtimeEvidence.environment.cmdstan})`
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
