import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const contentRoot = resolve(root, "content", "stan");
const corpusPath = resolve(contentRoot, "syntax-error-corpus.json");
const evidencePath = resolve(contentRoot, "syntax-error-validation.json");

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

function runStanc(stanc, flags, sourcePath, outputPath) {
  const result = spawnSync(stanc, [...flags, `--o=${outputPath}`, sourcePath], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return {
    exitCode: result.status,
    diagnostic: normalizeLineEndings(`${result.stdout || ""}\n${result.stderr || ""}`).trim(),
  };
}

function compilerIdentity(stanc) {
  const result = spawnSync(stanc, ["--version"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  const output = normalizeLineEndings(`${result.stdout || ""}\n${result.stderr || ""}`).trim();
  const match = output.match(/stanc3 v([^\s]+)(?: \(([^)]+)\))?/);
  if (!match) throw new Error(`stanc3の版を解析できません: ${output}`);
  return { compiler: "stanc3", version: match[1], target: match[2] || "unknown" };
}

function sourceRecord(relativePath) {
  const source = normalizeLineEndings(readFileSync(resolve(contentRoot, relativePath), "utf8"));
  return { relativePath, source, sha256: sha256(source) };
}

function compareEvidence(actual, expected) {
  const errors = [];
  if (expected?.schemaVersion !== 1 || expected?.status !== "PASS") {
    errors.push("保存済み構文エラー証拠のschemaまたは状態が不正です");
  }
  if (expected?.environment?.compiler !== actual.environment.compiler ||
      expected?.environment?.version !== actual.environment.version) {
    errors.push("保存済み証拠と実行中のstanc3版が一致しません");
  }
  if (expected?.corpusSha256 !== actual.corpusSha256) {
    errors.push("構文エラーコーパスが証拠取得後に変更されています");
  }
  const expectedCases = new Map((expected?.cases || []).map((item) => [item.id, item]));
  for (const item of actual.cases) {
    const saved = expectedCases.get(item.id);
    if (!saved || saved.brokenSha256 !== item.brokenSha256 ||
        saved.fixedSha256 !== item.fixedSha256 || saved.brokenExitCode !== 1 ||
        saved.fixedExitCode !== 0) {
      errors.push(`${item.id}: 保存済み証拠のhashまたは終了コードが一致しません`);
    }
  }
  if (expectedCases.size !== actual.cases.length) {
    errors.push("保存済み証拠のケース数が現コーパスと一致しません");
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

  const corpusText = normalizeLineEndings(readFileSync(corpusPath, "utf8"));
  const corpus = JSON.parse(corpusText);
  const identity = compilerIdentity(stanc);
  if (identity.version !== corpus.compilerContract.cmdstanVersion) {
    console.error(`stanc3 ${corpus.compilerContract.cmdstanVersion}が必要ですが、${identity.version}でした。`);
    process.exitCode = 2;
    return;
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "learning-stan-syntax-errors-"));
  const errors = [];
  const caseEvidence = [];
  try {
    for (const item of corpus.cases) {
      const broken = sourceRecord(item.broken);
      const fixed = sourceRecord(item.fixed);
      const brokenResult = runStanc(
        stanc,
        corpus.compilerContract.flags,
        resolve(contentRoot, item.broken),
        resolve(temporaryDirectory, `${item.id}-broken.hpp`)
      );
      const fixedResult = runStanc(
        stanc,
        corpus.compilerContract.flags,
        resolve(contentRoot, item.fixed),
        resolve(temporaryDirectory, `${item.id}-fixed.hpp`)
      );

      if (brokenResult.exitCode !== 1) {
        errors.push(`${item.id}: 壊れた例の終了コードが1ではなく${brokenResult.exitCode}です`);
      }
      if (fixedResult.exitCode !== 0) {
        errors.push(`${item.id}: 修正版の構文確認が失敗しました: ${fixedResult.diagnostic}`);
      }
      for (const fragment of item.expectedDiagnosticFragments) {
        if (!brokenResult.diagnostic.includes(fragment)) {
          errors.push(`${item.id}: 診断に期待断片「${fragment}」がありません`);
        }
      }
      caseEvidence.push({
        id: item.id,
        broken: basename(item.broken),
        fixed: basename(item.fixed),
        brokenSha256: broken.sha256,
        fixedSha256: fixed.sha256,
        brokenExitCode: brokenResult.exitCode,
        fixedExitCode: fixedResult.exitCode,
      });
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  const actualEvidence = {
    schemaVersion: 1,
    status: errors.length === 0 ? "PASS" : "FAIL",
    verifiedAt: projectDate(),
    environment: identity,
    flags: corpus.compilerContract.flags,
    corpusSha256: sha256(corpusText),
    cases: caseEvidence,
    limitations: [
      "固定版stanc3の構文・意味解析だけを検証し、C++コンパイル、データ読込、サンプリングは実行しない",
      "診断文の完全一致は要求せず、教材上必要な分類・期待型・実際型を示す安定断片を検証する",
      "動的な次元不一致や、コンパイルは通る統計的誤指定はSTAN-009の実行・レビュー課題へ分離する"
    ]
  };

  if (errors.length > 0) {
    console.error("Stan構文エラーコーパスの実測検証に失敗しました:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--print-evidence")) {
    console.log(JSON.stringify(actualEvidence, null, 2));
    return;
  }

  const savedEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const evidenceErrors = compareEvidence(actualEvidence, savedEvidence);
  if (evidenceErrors.length > 0) {
    console.error("Stan構文エラーコーパスの保存証拠が一致しません:");
    evidenceErrors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Stan syntax errors: PASS (${actualEvidence.cases.length} broken/fixed pairs, ` +
    `${identity.compiler} ${identity.version} ${identity.target})`
  );
}

main();
