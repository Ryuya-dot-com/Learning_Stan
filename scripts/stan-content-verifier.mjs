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
  return {
    curriculum: JSON.parse(readFileSync(resolve(base, "curriculum.json"), "utf8")),
    grammarDrills: JSON.parse(readFileSync(resolve(base, "grammar-drills.json"), "utf8")),
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
    ...validateGrammarDrills(content.grammarDrills),
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
    `${content.grammarDrills.units.length} grammar units, ` +
    `${content.grammarDrills.units.length * EXPECTED_PRACTICE_STAGES.length} scaffolded drills, ` +
    `7 executable Stan examples, 2 runtime-verified comparison scenarios)`
  );
  console.log(
    `Compiler/runtime evidence: PASS (R ${content.runtimeEvidence.environment.r}, ` +
    `CmdStanR ${content.runtimeEvidence.environment.cmdstanr}, CmdStan ${content.runtimeEvidence.environment.cmdstan})`
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
