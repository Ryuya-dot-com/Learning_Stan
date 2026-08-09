import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const contentRoot = resolve(root, "content", "stan");
const planPath = resolve(contentRoot, "syntax-retention-plan.json");
const assessmentsPath = resolve(contentRoot, "syntax-retention-assessments.json");
const referenceRelativePath = "retention/facilitator/positive-duration-reference.stan";
const referencePath = resolve(contentRoot, referenceRelativePath);
const evidencePath = resolve(contentRoot, "syntax-retention-validation.json");

function normalizeLineEndings(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function projectDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function argumentValue(name) {
  const direct = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function findStanc() {
  const explicit = argumentValue("--stanc") || process.env.LEARNING_STAN_STANC;
  const candidates = [
    explicit,
    resolve(root, ".codex-cmdstan", "cmdstan-2.39.0", "bin", "stanc.exe"),
    resolve(root, ".codex-cmdstan", "cmdstan-2.39.0", "bin", "linux-stanc"),
    resolve(root, ".codex-cmdstan", "cmdstan-2.39.0", "bin", "mac-stanc"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function compilerIdentity(stanc) {
  const result = spawnSync(stanc, ["--version"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  const output = normalizeLineEndings(`${result.stdout || ""}\n${result.stderr || ""}`).trim();
  const match = output.match(/stanc3 v([^\s]+)(?: \(([^)]+)\))?/);
  if (!match) throw new Error(`stanc3の版を解析できません: ${output}`);
  return { compiler: "stanc3", version: match[1], target: match[2] || "unknown" };
}

function compareEvidence(actual, expected) {
  const errors = [];
  if (expected?.schemaVersion !== 1 || expected?.status !== "PASS") {
    errors.push("保存済み保持課題証拠のschemaまたは状態が不正です");
  }
  if (expected?.environment?.compiler !== actual.environment.compiler ||
      expected?.environment?.version !== actual.environment.version) {
    errors.push("保存済み証拠と実行中のstanc3版が一致しません");
  }
  for (const key of ["planSha256", "assessmentsSha256", "referenceSha256"]) {
    if (expected?.[key] !== actual[key]) errors.push(`${key}が保存済み証拠と一致しません`);
  }
  if (expected?.referenceExitCode !== 0 || actual.referenceExitCode !== 0 ||
      expected?.referenceWarningCount !== actual.referenceWarningCount) {
    errors.push("未見lognormal参照モデルの終了コードまたは警告数が一致しません");
  }
  return errors;
}

function main() {
  const stanc = findStanc();
  if (!stanc) {
    console.error("stanc3が見つかりません。--stancまたはLEARNING_STAN_STANCで指定してください。");
    process.exitCode = 2;
    return;
  }
  const identity = compilerIdentity(stanc);
  if (identity.version !== "2.39.0") {
    console.error(`stanc3 2.39.0が必要ですが、${identity.version}でした。`);
    process.exitCode = 2;
    return;
  }

  const planSource = normalizeLineEndings(readFileSync(planPath, "utf8"));
  const assessmentSource = normalizeLineEndings(readFileSync(assessmentsPath, "utf8"));
  const referenceSource = normalizeLineEndings(readFileSync(referencePath, "utf8"));
  JSON.parse(planSource);
  JSON.parse(assessmentSource);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "learning-stan-retention-"));
  let result;
  try {
    result = spawnSync(stanc, ["--warn-pedantic", `--o=${resolve(temporaryDirectory, "positive-duration.hpp")}`, referencePath], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error) throw result.error;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  const diagnostic = normalizeLineEndings(`${result.stdout || ""}\n${result.stderr || ""}`).trim();
  const warningCount = (diagnostic.match(/^Warning in /gm) || []).length;
  if (result.status !== 0) {
    console.error(`未見lognormal参照モデルが構文確認を通りません: ${diagnostic}`);
    process.exitCode = 1;
    return;
  }

  const actualEvidence = {
    schemaVersion: 1,
    status: "PASS",
    verifiedAt: projectDate(),
    environment: identity,
    flags: ["--warn-pedantic"],
    planSha256: sha256(planSource),
    assessmentsSha256: sha256(assessmentSource),
    reference: referenceRelativePath,
    referenceSha256: sha256(referenceSource),
    referenceExitCode: result.status,
    referenceWarningCount: warningCount,
    limitations: [
      "未見lognormal課題のfacilitator参照モデルが構文確認を通ることだけを検証し、学習者の保持・転移はまだ測定していない",
      "7〜14日の間隔とrubric閾値はpilot前の暫定設計であり、適格な初学者観察後に固定する",
      "参照モデルは模範解答の唯一性を意味せず、同じ生成過程・予測契約を満たす別実装を許容する"
    ]
  };

  if (process.argv.includes("--print-evidence")) {
    console.log(JSON.stringify(actualEvidence, null, 2));
    return;
  }
  const savedEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const errors = compareEvidence(actualEvidence, savedEvidence);
  if (errors.length > 0) {
    console.error("Stan保持・転移課題の保存証拠が一致しません:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Stan retention: PASS (3 checkpoints, 10 tasks, 1 facilitator reference, ` +
    `${identity.compiler} ${identity.version} ${identity.target})`
  );
}

main();
