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

export function validateCurriculum(curriculum) {
  const errors = [];
  if (curriculum?.schemaVersion !== 1) errors.push("curriculum.schemaVersionは1である必要があります");
  if (curriculum?.status !== "draft-unpublished") errors.push("Stan教材は公開ゲート通過までdraft-unpublishedである必要があります");
  if (!Array.isArray(curriculum?.lessons)) return [...errors, "curriculum.lessonsがありません"];

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
  return {
    curriculum: JSON.parse(readFileSync(resolve(base, "curriculum.json"), "utf8")),
    manuscript: normalizeLineEndings(
      readFileSync(resolve(base, "linear-regression.md"), "utf8")
    ),
    stanSource: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "linear-regression.stan"), "utf8")
    ),
    runnerSource: normalizeLineEndings(
      readFileSync(resolve(base, "examples", "run-linear-regression.R"), "utf8")
    ),
    runtimeEvidence: JSON.parse(readFileSync(resolve(base, "validation.json"), "utf8")),
  };
}

export function validateStanContent(content) {
  return [
    ...validateCurriculum(content.curriculum),
    ...validateStanProgram(content.stanSource),
    ...validateCmdStanRunner(content.runnerSource),
    ...validateManuscript(content.manuscript, content.stanSource, content.runnerSource),
    ...validateRuntimeEvidence(content.runtimeEvidence, content.stanSource, content.runnerSource),
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
  console.log(`Stan content: PASS (${content.curriculum.lessons.length} draft lessons, 1 synchronized vertical slice)`);
  console.log(
    `Compiler/runtime evidence: PASS (R ${content.runtimeEvidence.environment.r}, ` +
    `CmdStanR ${content.runtimeEvidence.environment.cmdstanr}, CmdStan ${content.runtimeEvidence.environment.cmdstan})`
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
