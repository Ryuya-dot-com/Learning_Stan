import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const contentRoot = resolve(root, "content", "stan");
const corpusPath = resolve(contentRoot, "model-review-corpus.json");
const evidencePath = resolve(contentRoot, "model-review-validation.json");

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
  const executable = process.platform === "win32" ? "stanc.exe" : "stanc";
  const bundled = process.platform === "win32"
    ? "stanc.exe"
    : process.platform === "darwin" ? "mac-stanc" : "linux-stanc";
  const candidates = [
    explicit,
    resolve(homedir(), ".cmdstan", "cmdstan-2.39.0", "bin", executable),
    resolve(root, ".codex-cmdstan", "cmdstan-2.39.0", "bin", executable),
    resolve(root, ".codex-cmdstan", "cmdstan-2.39.0", "bin", bundled),
  ].filter(Boolean);
  return candidates.find((candidate) => {
    if (!existsSync(candidate)) return false;
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }) || null;
}

function runStanc(stanc, flags, sourcePath, outputPath) {
  const result = spawnSync(stanc, [...flags, `--o=${outputPath}`, sourcePath], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  const diagnostic = normalizeLineEndings(`${result.stdout || ""}\n${result.stderr || ""}`).trim();
  return {
    exitCode: result.status,
    diagnostic,
    warningCount: (diagnostic.match(/^Warning in /gm) || []).length,
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

function readSource(relativePath) {
  const source = normalizeLineEndings(readFileSync(resolve(contentRoot, relativePath), "utf8"));
  return { source, sha256: sha256(source) };
}

function compareEvidence(actual, expected) {
  const errors = [];
  if (expected?.schemaVersion !== 1 || expected?.status !== "PASS") {
    errors.push("保存済みモデルレビュー証拠のschemaまたは状態が不正です");
  }
  if (expected?.environment?.compiler !== actual.environment.compiler ||
      expected?.environment?.version !== actual.environment.version) {
    errors.push("保存済み証拠と実行中のstanc3版が一致しません");
  }
  if (expected?.corpusSha256 !== actual.corpusSha256) {
    errors.push("モデルレビューコーパスが証拠取得後に変更されています");
  }
  const expectedCases = new Map((expected?.cases || []).map((item) => [item.id, item]));
  for (const item of actual.cases) {
    const saved = expectedCases.get(item.id);
    if (!saved || saved.candidateSha256 !== item.candidateSha256 ||
        saved.referenceSha256 !== item.referenceSha256 ||
        saved.candidateExitCode !== 0 || saved.referenceExitCode !== 0 ||
        saved.candidateWarningCount !== item.candidateWarningCount ||
        saved.referenceWarningCount !== item.referenceWarningCount) {
      errors.push(`${item.id}: 保存済み証拠のhash・終了コード・警告数が一致しません`);
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

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "learning-stan-model-review-"));
  const errors = [];
  const caseEvidence = [];
  try {
    for (const item of corpus.cases) {
      const candidate = readSource(item.candidate);
      const reference = readSource(item.reference);
      const candidateResult = runStanc(
        stanc,
        corpus.compilerContract.flags,
        resolve(contentRoot, item.candidate),
        resolve(temporaryDirectory, `${item.id}-candidate.hpp`)
      );
      const referenceResult = runStanc(
        stanc,
        corpus.compilerContract.flags,
        resolve(contentRoot, item.reference),
        resolve(temporaryDirectory, `${item.id}-reference.hpp`)
      );
      if (candidateResult.exitCode !== 0) {
        errors.push(`${item.id}: candidateが構文確認を通りません: ${candidateResult.diagnostic}`);
      }
      if (referenceResult.exitCode !== 0) {
        errors.push(`${item.id}: referenceが構文確認を通りません: ${referenceResult.diagnostic}`);
      }
      for (const fragment of item.candidateRequiredFragments) {
        if (!candidate.source.includes(fragment)) errors.push(`${item.id}: candidateに「${fragment}」がありません`);
      }
      for (const fragment of item.referenceRequiredFragments) {
        if (!reference.source.includes(fragment)) errors.push(`${item.id}: referenceに「${fragment}」がありません`);
      }
      caseEvidence.push({
        id: item.id,
        candidate: basename(item.candidate),
        reference: basename(item.reference),
        candidateSha256: candidate.sha256,
        referenceSha256: reference.sha256,
        candidateExitCode: candidateResult.exitCode,
        referenceExitCode: referenceResult.exitCode,
        candidateWarningCount: candidateResult.warningCount,
        referenceWarningCount: referenceResult.warningCount,
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
      "全candidateとreferenceのstanc3構文・意味解析成功だけを確認し、構文成功をモデル妥当性の証拠には数えない",
      "Jacobian、offset、pointwise log_likの判断は数式・生成過程・予測単位のレビューを必要とする",
      "centeredとnon-centeredの比較はデータ条件ごとの複数chain実行・計算診断をSTAN-009の後続実測として残す",
      "切断ケース以外の推定差・計算効率・数値極限はまだ実測証拠を取得していない"
    ]
  };

  if (errors.length > 0) {
    console.error("Stanモデルレビューコーパスの実測検証に失敗しました:");
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
    console.error("Stanモデルレビューコーパスの保存証拠が一致しません:");
    evidenceErrors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Stan model review: PASS (${actualEvidence.cases.length} compile-success pairs, ` +
    `${identity.compiler} ${identity.version} ${identity.target})`
  );
}

main();
