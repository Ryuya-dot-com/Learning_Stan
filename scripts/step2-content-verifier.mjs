import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content", "step2");

function readUtf8(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function parseCsv(source) {
  const lines = source.trimEnd().split(/\r?\n/);
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
  return { headers, rows };
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function quantileType7(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function summarizeRows(rows) {
  const correct = rows.filter((row) => row.correct === "true");
  const cells = new Map();
  for (const row of correct) {
    const key = `${row.id}:${row.condition}`;
    const values = cells.get(key) ?? [];
    values.push(Number(row.rt_ms));
    cells.set(key, values);
  }

  const participantCondition = [...cells.entries()].map(([key, values]) => {
    const [id, condition] = key.split(":");
    return {
      id,
      condition,
      nCorrect: values.length,
      meanRt: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
  });

  const conditionStatistics = ["cong", "incong"].map((condition) => {
    const selected = participantCondition.filter((row) => row.condition === condition);
    const means = selected.map((row) => row.meanRt);
    const q1 = quantileType7(means, 0.25);
    const q3 = quantileType7(means, 0.75);
    return {
      condition,
      nParticipants: selected.length,
      nCorrectTrials: selected.reduce((sum, row) => sum + row.nCorrect, 0),
      meanOfParticipantMeans: means.reduce((sum, value) => sum + value, 0) / means.length,
      medianOfParticipantMeans: quantileType7(means, 0.5),
      q1,
      q3,
      iqr: q3 - q1,
    };
  });

  const byParticipant = new Map();
  for (const row of participantCondition) {
    const current = byParticipant.get(row.id) ?? {};
    current[row.condition] = row.meanRt;
    byParticipant.set(row.id, current);
  }
  const differences = [...byParticipant.values()].map((row) => row.incong - row.cong);

  return { correct, participantCondition, conditionStatistics, differences };
}

function loadStep2Content(rootDir = ROOT) {
  const directory = join(rootDir, "content", "step2");
  const dataSource = readUtf8(join(directory, "data", "expanded_pilot_trials.csv"));
  return {
    rootDir,
    readme: readUtf8(join(directory, "README.md")),
    curriculum: JSON.parse(readUtf8(join(directory, "curriculum.json"))),
    scenario: readUtf8(join(directory, "scenario.md")),
    manuscript: readUtf8(join(directory, "l17-descriptive-statistics.md")),
    l18Manuscript: readUtf8(join(directory, "l18-grammar-of-graphics.md")),
    l19Manuscript: readUtf8(join(directory, "l19-individual-differences.md")),
    rSource: readUtf8(join(directory, "examples", "step2_descriptive.R")),
    l18RSource: readUtf8(join(directory, "examples", "step2_condition_plot.R")),
    l19RSource: readUtf8(
      join(directory, "examples", "step2_participant_differences_plot.R"),
    ),
    l20Manuscript: readUtf8(join(directory, "l20-report-and-transfer.md")),
    l20RSource: readUtf8(
      join(directory, "examples", "step2_report_and_transfer.R"),
    ),
    validation: JSON.parse(readUtf8(join(directory, "validation.json"))),
    dataSource,
    data: parseCsv(dataSource),
  };
}

function validateCurriculum(curriculum) {
  const errors = [];
  if (curriculum.status !== "draft-unpublished") {
    errors.push("STEP 2教材は観察完了までdraft-unpublishedでなければなりません");
  }
  if (curriculum.entryPrerequisite !== "l16") {
    errors.push("STEP 2の入口前提はl16でなければなりません");
  }

  const expectedGates = new Map([
    ["foundation", "PASS"],
    ["step1-data-quality", "OBSERVED"],
    ["step1-independent-transfer", "OBSERVED"],
    ["step2-learning-observation", "OBSERVED"],
  ]);
  for (const requirement of curriculum.releasePrerequisites ?? []) {
    if (expectedGates.get(requirement.gate) === requirement.requiredDecision) {
      expectedGates.delete(requirement.gate);
    }
  }
  for (const gate of expectedGates.keys()) {
    errors.push(`公開前提${gate}がありません`);
  }

  const lessons = curriculum.lessons ?? [];
  const ids = new Set();
  lessons.forEach((lesson, index) => {
    if (!/^step2-[a-z0-9-]+$/.test(lesson.id ?? "")) {
      errors.push(`${lesson.id ?? `index ${index}`}: 永続IDが意味キー形式ではありません`);
    }
    if (ids.has(lesson.id)) errors.push(`${lesson.id}: IDが重複しています`);
    ids.add(lesson.id);
    if (lesson.displayNumber !== 17 + index) {
      errors.push(`${lesson.id}: displayNumberがL${17 + index}ではありません`);
    }
    if (!lesson.outcome || !(lesson.directEvidence?.length > 0)) {
      errors.push(`${lesson.id}: 到達目標または直接評価証拠がありません`);
    }
    const expectedPrerequisite = index === 0 ? "l16" : lessons[index - 1].id;
    if (lesson.prerequisites?.length !== 1 || lesson.prerequisites[0] !== expectedPrerequisite) {
      errors.push(`${lesson.id}: 前提は${expectedPrerequisite}でなければなりません`);
    }
  });
  if (lessons.length !== 4) errors.push("STEP 2はL17–L20の4レッスンでなければなりません");

  if (curriculum.scenario?.analysisUnit !== "participant") {
    errors.push("分析単位がparticipantとして固定されていません");
  }
  if (curriculum.scenario?.dataOrigin !== "synthetic") {
    errors.push("データ由来がsyntheticとして固定されていません");
  }
  const expectedDeliverables = [
    "output/participant_condition_summary.csv",
    "output/descriptive_statistics.csv",
    "output/participant_differences.csv",
    "output/condition_distributions.png",
    "output/participant_differences.png",
    "output/exploratory_note.txt",
  ];
  if (
    JSON.stringify(curriculum.scenario?.deliverables) !==
    JSON.stringify(expectedDeliverables)
  ) {
    errors.push("STEP 2の最終成果物6件が契約どおりではありません");
  }
  if (curriculum.nextStage !== "bridge-linear-model") {
    errors.push("STEP 2の次段階が回帰ブリッジではありません");
  }
  return errors;
}

function validateData(dataSource, data, validation) {
  const errors = [];
  const expectedHeaders = ["id", "condition", "trial", "rt_ms", "correct"];
  if (JSON.stringify(data.headers) !== JSON.stringify(expectedHeaders)) {
    errors.push("STEP 2 CSVの列順が不正です");
  }
  if (sha256(dataSource) !== validation.data.sha256) {
    errors.push("STEP 2 CSVのSHA-256が検証契約と一致しません");
  }
  if (data.rows.length !== validation.data.rows) {
    errors.push(`STEP 2 CSVは${validation.data.rows}行ではありません`);
  }

  const participants = new Set(data.rows.map((row) => row.id));
  if (participants.size !== validation.data.participants) {
    errors.push("STEP 2 CSVの参加者数が不正です");
  }

  const cells = new Map();
  for (const row of data.rows) {
    if (!validation.data.conditions.includes(row.condition)) {
      errors.push(`${row.id}: 不正な条件${row.condition}があります`);
    }
    const trial = Number(row.trial);
    const rt = Number(row.rt_ms);
    if (!Number.isInteger(trial) || trial < 1 || trial > 20) {
      errors.push(`${row.id}:${row.condition}: 試行番号が不正です`);
    }
    if (!Number.isInteger(rt) || rt < 250 || rt > 1500) {
      errors.push(`${row.id}:${row.condition}:${trial}: 反応時間が範囲外です`);
    }
    if (!['true', 'false'].includes(row.correct)) {
      errors.push(`${row.id}:${row.condition}:${trial}: correctが論理値ではありません`);
    }
    const key = `${row.id}:${row.condition}`;
    const trials = cells.get(key) ?? [];
    trials.push(trial);
    cells.set(key, trials);
  }
  if (cells.size !== 48 || [...cells.values()].some((trials) => trials.length !== 20)) {
    errors.push("各参加者・条件が20試行になっていません");
  }

  const summary = summarizeRows(data.rows);
  if (summary.correct.length !== validation.data.correctTrials.total) {
    errors.push("正答試行の総数が検証契約と一致しません");
  }
  if (summary.participantCondition.length !== validation.expected.participantConditionRows) {
    errors.push("参加者×条件の要約行数が検証契約と一致しません");
  }

  const tolerance = 1e-9;
  summary.conditionStatistics.forEach((actual, index) => {
    const expected = validation.expected.conditionStatistics[index];
    if (
      actual.condition !== expected.condition ||
      actual.nParticipants !== validation.data.participants ||
      actual.nCorrectTrials !== validation.data.correctTrials[actual.condition]
    ) {
      errors.push(`${actual.condition}: 人数または正答試行数が検証契約と一致しません`);
    }
    for (const key of [
      "meanOfParticipantMeans",
      "medianOfParticipantMeans",
      "q1",
      "q3",
      "iqr",
    ]) {
      if (Math.abs(actual[key] - expected[key]) > tolerance) {
        errors.push(`${actual.condition}: ${key}が検証契約と一致しません`);
      }
    }
  });

  const sortedDifferences = [...summary.differences].sort((a, b) => a - b);
  const differenceContract = validation.expected.participantDifferences;
  const actualDifferences = {
    rows: sortedDifferences.length,
    positive: sortedDifferences.filter((value) => value > 0).length,
    median: quantileType7(sortedDifferences, 0.5),
    min: sortedDifferences[0],
    max: sortedDifferences.at(-1),
  };
  for (const key of ["rows", "positive", "median", "min", "max"]) {
    if (Math.abs(actualDifferences[key] - differenceContract[key]) > tolerance) {
      errors.push(`参加者内差の${key}が検証契約と一致しません`);
    }
  }
  return errors;
}

function validateDocuments(content) {
  const errors = [];
  const requiredReadmePhrases = [
    "draft-unpublished",
    "Foundation Gate",
    "STEP 1観察",
    "公開アプリへ組み込む前",
  ];
  for (const phrase of requiredReadmePhrases) {
    if (!content.readme.includes(phrase)) errors.push(`READMEに「${phrase}」がありません`);
  }

  const requiredScenarioPhrases = [
    "合成データ",
    "参加者単位",
    "884正答試行",
    "p値",
    "母集団",
  ];
  for (const phrase of requiredScenarioPhrases) {
    if (!content.scenario.includes(phrase)) errors.push(`シナリオに「${phrase}」がありません`);
  }

  const requiredManuscriptPhrases = [
    "960 884  24",
    "参加者×条件",
    "type = 7",
    "合成データ",
    "## 直接評価",
  ];
  for (const phrase of requiredManuscriptPhrases) {
    if (!content.manuscript.includes(phrase)) errors.push(`L17原稿に「${phrase}」がありません`);
  }

  const requiredRFragments = [
    "dplyr::group_by(id, condition)",
    "median_of_participant_means = median(mean_rt)",
    "q1 = quantile(mean_rt, 0.25, names = FALSE)",
    "iqr = IQR(mean_rt)",
    "output/participant_condition_summary.csv",
    "output/descriptive_statistics.csv",
    "output/participant_differences.csv",
    "output/exploratory_note.txt",
  ];
  for (const fragment of requiredRFragments) {
    if (!content.rSource.includes(fragment)) errors.push(`L17 Rコードに「${fragment}」がありません`);
  }
  if (/\b(?:t\.test|cor\.test)\s*\(/.test(content.rSource)) {
    errors.push("L17完成版が推測統計を先取りしています");
  }

  const requiredL18Phrases = [
    "48 24  2",
    "aes(color = \"condition\")",
    "outlier.shape = NA",
    "seed = 20260802",
    "2100×1500 px",
    "図だけから有意差、母集団差、因果効果を結論しません",
    "## 内容理解問題",
    "step2-l18-q5-transfer-yield",
  ];
  for (const phrase of requiredL18Phrases) {
    if (!content.l18Manuscript.includes(phrase)) errors.push(`L18原稿に「${phrase}」がありません`);
  }
  const requiredL18RFragments = [
    "output/participant_condition_summary.csv",
    "ggplot2::aes(x = condition, y = mean_rt)",
    "ggplot2::geom_boxplot(",
    "ggplot2::geom_point(",
    "ggplot2::position_jitter(",
    "seed = 20260802",
    "outlier.shape = NA",
    "plot = condition_plot",
    "width = 7",
    "height = 5",
    "dpi = 300",
    "Synthetic teaching data.",
  ];
  for (const fragment of requiredL18RFragments) {
    if (!content.l18RSource.includes(fragment)) errors.push(`L18 Rコードに「${fragment}」がありません`);
  }
  if (/\b(?:t\.test|cor\.test)\s*\(/.test(content.l18RSource)) {
    errors.push("L18完成版が推測統計を先取りしています");
  }

  const figure = content.validation.expected?.figures?.conditionDistributions;
  const expectedFigure = {
    path: "output/condition_distributions.png",
    input: "output/participant_condition_summary.csv",
    boxGroups: 2,
    pointRows: 48,
    jitterSeed: 20260802,
    widthIn: 7,
    heightIn: 5,
    dpi: 300,
    widthPx: 2100,
    heightPx: 1500,
    dataOriginLabel: "Synthetic teaching data.",
  };
  if (JSON.stringify(figure) !== JSON.stringify(expectedFigure)) {
    errors.push("L18条件別分布図の検証契約が不正です");
  }

  const requiredL19Phrases = [
    "48 24 24 24",
    "group = id",
    "24本の線と48点",
    "33.79〜108.77 ms",
    "step2-l19-q5-transfer-blood-pressure",
    "## 内容理解問題",
  ];
  for (const phrase of requiredL19Phrases) {
    if (!content.l19Manuscript.includes(phrase)) errors.push(`L19原稿に「${phrase}」がありません`);
  }
  const requiredL19RFragments = [
    "output/participant_condition_summary.csv",
    "output/participant_differences.csv",
    "ggplot2::aes(group = id)",
    "ggplot2::geom_line(",
    "ggplot2::geom_point(",
    "plot = paired_plot",
    "width = 7",
    "height = 5",
    "dpi = 300",
    "Synthetic teaching data.",
  ];
  for (const fragment of requiredL19RFragments) {
    if (!content.l19RSource.includes(fragment)) errors.push(`L19 Rコードに「${fragment}」がありません`);
  }
  if (/\b(?:t\.test|cor\.test)\s*\(/.test(content.l19RSource)) {
    errors.push("L19完成版が推測統計を先取りしています");
  }

  const pairedFigure = content.validation.expected?.figures?.participantDifferences;
  const expectedPairedFigure = {
    path: "output/participant_differences.png",
    inputs: [
      "output/participant_condition_summary.csv",
      "output/participant_differences.csv",
    ],
    lineGroups: 24,
    pointRows: 48,
    widthIn: 7,
    heightIn: 5,
    dpi: 300,
    widthPx: 2100,
    heightPx: 1500,
    dataOriginLabel: "Synthetic teaching data.",
  };
  if (JSON.stringify(pairedFigure) !== JSON.stringify(expectedPairedFigure)) {
    errors.push("L19参加者内対応図の検証契約が不正です");
  }

  const requiredL20Phrases = [
    "2図・3CSV・探索メモ",
    "2100×1500 px",
    "入口を1本にする",
    "チェックサムが一致しても",
    "観察と主張を分けて書く",
    "step2-l20-q5-transfer-sleep",
    "## 内容理解問題",
  ];
  for (const phrase of requiredL20Phrases) {
    if (!content.l20Manuscript.includes(phrase)) errors.push(`L20原稿に「${phrase}」がありません`);
  }
  const requiredL20RFragments = [
    'input_path <- "data/expanded_pilot_trials.csv"',
    '"step2_descriptive.R"',
    '"step2_condition_plot.R"',
    '"step2_participant_differences_plot.R"',
    'new.env(parent = asNamespace("stats"))',
    "local = analysis_environment",
    'encoding = "UTF-8"',
    "tools::md5sum(input_path)",
    "expected_outputs <- c(",
    '"output/exploratory_note.txt"',
    "portfolio_manifest <- data.frame(",
    "データの由来:",
    "解釈の限界:",
    "再生成手順:",
  ];
  for (const fragment of requiredL20RFragments) {
    if (!content.l20RSource.includes(fragment)) errors.push(`L20 Rコードに「${fragment}」がありません`);
  }
  if (/\b(?:t\.test|cor\.test)\s*\(/.test(content.l20RSource)) {
    errors.push("L20完成版が推測統計を先取りしています");
  }

  const finalPortfolio = content.validation.expected?.finalPortfolio;
  const expectedFinalPortfolio = {
    entryPoint: "step2_report_and_transfer.R",
    analysisScripts: [
      "step2_descriptive.R",
      "step2_condition_plot.R",
      "step2_participant_differences_plot.R",
    ],
    input: "data/expanded_pilot_trials.csv",
    outputs: [
      "output/participant_condition_summary.csv",
      "output/descriptive_statistics.csv",
      "output/participant_differences.csv",
      "output/condition_distributions.png",
      "output/participant_differences.png",
      "output/exploratory_note.txt",
    ],
    noteSections: [
      "データの由来:",
      "分析対象:",
      "図の選択理由（条件別分布）:",
      "図の選択理由（参加者内対応）:",
      "観察結果:",
      "解釈の限界:",
      "再生成手順:",
    ],
    outputCount: 6,
  };
  if (JSON.stringify(finalPortfolio) !== JSON.stringify(expectedFinalPortfolio)) {
    errors.push("L20最終分析パックの検証契約が不正です");
  }
  if (existsSync(join(content.rootDir, "src", "data", "lessons", "3-stats"))) {
    errors.push("非公開STEP 2が公開レッスンディレクトリへ配置されています");
  }
  return errors;
}

function validateStep2Content(content = loadStep2Content()) {
  return [
    ...validateCurriculum(content.curriculum),
    ...validateData(content.dataSource, content.data, content.validation),
    ...validateDocuments(content),
  ];
}

function main() {
  const errors = validateStep2Content();
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("STEP 2 draft verified: 4 lessons, 24 participants, 960 trials");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export {
  loadStep2Content,
  parseCsv,
  quantileType7,
  summarizeRows,
  validateCurriculum,
  validateData,
  validateDocuments,
  validateStep2Content,
};
