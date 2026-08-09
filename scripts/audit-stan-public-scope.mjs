import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PUBLIC_SCOPE_AUDIT_SCHEMA_VERSION = 1;

const PRIVATE_PATH_RULES = [
  {
    id: "private-observation-path",
    pattern: /^quality\/[^/]+\/(?:private|raw|recordings|filled-records)(?:\/|$)/i,
  },
  {
    id: "private-variant-path",
    pattern: /^content\/.*\/private-variants(?:\/|$)/i,
  },
];

const SENSITIVE_FILE_RULES = [
  { id: "environment-file", pattern: /(^|\/)\.env(?:\.|$)/i },
  { id: "private-key-file", pattern: /\.(?:pem|key|p12|pfx)$/i },
  { id: "ssh-key-file", pattern: /(^|\/)id_(?:rsa|ed25519)(?:\.pub)?$/i },
  {
    id: "credential-file",
    pattern: /(^|\/)(?:credentials?|secrets?)\.(?:json|ya?ml)$/i,
  },
  { id: "npm-credential-file", pattern: /(^|\/)\.npmrc$/i },
];

const SECRET_CONTENT_RULES = [
  { id: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { id: "github-fine-grained-token", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { id: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { id: "slack-token", pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g },
  { id: "openai-api-key", pattern: /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/g },
  {
    id: "assigned-credential",
    pattern: /\b(?:api[_-]?key|access[_-]?token|password|client[_-]?secret)\s*[:=]\s*["'][^"'\s]{12,}["']/gi,
  },
];

const PERSONAL_DATA_RULES = [
  {
    id: "email-address",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    id: "unix-user-path",
    pattern: /\/(?:Users|home)\/(?!\.\.\.|<|me(?:\/|\b)|user(?:name)?(?:\/|\b))[^/\s"'`]+/gi,
  },
  {
    id: "windows-user-path",
    pattern: /\b[A-Z]:[\\/]Users[\\/](?!\.\.\.|<|me(?:[\\/]|\b)|user(?:name)?(?:[\\/]|\b))[^\\/\s"'`]+/gi,
  },
];

// npmの固定依存メタデータに含まれる公開済みmaintainer連絡先は参加者情報ではない。
// secret規則はpackage-lock.jsonにも引き続き適用する。
const PERSONAL_DATA_EXCLUDED_PATHS = new Set(["package-lock.json"]);

const APP_SOURCE_PATH_PATTERN = /^src\/data\/lessons\/7-stan(?:\/|$)/i;
const APP_SOURCE_CONTENT_RULES = [
  { id: "stan-lesson-id", pattern: /\bid\s*:\s*["'](?:l(?:3[4-9]|4[01])|stan-l(?:3[4-9]|4[01])[^"']*)["']/gi },
  { id: "stan-content-import", pattern: /content\/stan\/(?:lessons|examples)\//gi },
];
const APP_BUILD_CONTENT_RULES = [
  { id: "built-stan-assessment", pattern: /stan-l(?:3[4-9]|4[01])-/gi },
  { id: "built-stan-lesson-source", pattern: /l(?:3[4-9]|4[01])-[a-z0-9-]+\.md/gi },
  { id: "built-stan-first-lesson", pattern: /L34 RからStanへ/g },
];

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function lineForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8_192));
  return sample.includes(0);
}

function findingsForRules(path, text, rules, category) {
  const findings = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      findings.push({
        category,
        rule: rule.id,
        path,
        line: lineForIndex(text, match.index || 0),
      });
    }
  }
  return findings;
}

export function auditTrackedEntries(entries) {
  const findings = [];
  let textFilesScanned = 0;
  let binaryFilesSkipped = 0;

  for (const entry of entries) {
    const path = normalizePath(entry.path);
    for (const rule of [...PRIVATE_PATH_RULES, ...SENSITIVE_FILE_RULES]) {
      if (rule.pattern.test(path)) {
        findings.push({ category: "secret", rule: rule.id, path, line: null });
      }
    }

    const buffer = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, "utf8");
    if (isProbablyBinary(buffer)) {
      binaryFilesSkipped += 1;
      continue;
    }

    textFilesScanned += 1;
    const text = buffer.toString("utf8");
    findings.push(...findingsForRules(path, text, SECRET_CONTENT_RULES, "secret"));
    if (!PERSONAL_DATA_EXCLUDED_PATHS.has(path)) {
      findings.push(...findingsForRules(path, text, PERSONAL_DATA_RULES, "personal-data"));
    }

    if (path.startsWith("src/")) {
      if (APP_SOURCE_PATH_PATTERN.test(path)) {
        findings.push({ category: "app-scope", rule: "stan-lesson-source-path", path, line: null });
      }
      findings.push(...findingsForRules(path, text, APP_SOURCE_CONTENT_RULES, "app-scope"));
    }
  }

  return { findings, textFilesScanned, binaryFilesSkipped };
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walkFiles(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

export function auditBuiltApp(root) {
  const distRoot = join(root, "dist");
  if (!existsSync(distRoot)) {
    return {
      findings: [{ category: "app-scope", rule: "missing-dist-build", path: "dist", line: null }],
      filesScanned: 0,
    };
  }

  const findings = [];
  let filesScanned = 0;
  for (const absolutePath of walkFiles(distRoot)) {
    const path = normalizePath(relative(root, absolutePath));
    const distRelative = normalizePath(relative(distRoot, absolutePath));
    if (distRelative === "roadmap.html") continue;
    if (/(^|\/)stan(?:\/|$)/i.test(distRelative) || extname(distRelative).toLowerCase() === ".stan") {
      findings.push({ category: "app-scope", rule: "built-stan-path", path, line: null });
    }

    const buffer = readFileSync(absolutePath);
    if (isProbablyBinary(buffer)) continue;
    filesScanned += 1;
    findings.push(...findingsForRules(path, buffer.toString("utf8"), APP_BUILD_CONTENT_RULES, "app-scope"));
  }

  return { findings, filesScanned };
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

export function auditRepository(root, { allowDirty = false } = {}) {
  const trackedPaths = git(root, ["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath);
  const tracked = auditTrackedEntries(
    trackedPaths.map((path) => ({ path, content: readFileSync(join(root, path)) })),
  );
  const built = auditBuiltApp(root);
  const dirty = git(root, ["status", "--porcelain", "--untracked-files=no"]).length > 0;
  const findings = [...tracked.findings, ...built.findings];
  if (dirty && !allowDirty) {
    findings.push({ category: "commit", rule: "dirty-worktree", path: ".", line: null });
  }

  const categoryPass = (category) => !findings.some((finding) => finding.category === category);
  return {
    schemaVersion: PUBLIC_SCOPE_AUDIT_SCHEMA_VERSION,
    auditId: "stan-public-scope",
    status: findings.length === 0 ? "PASS" : "FAIL",
    commit: git(root, ["rev-parse", "HEAD"]),
    commitBound: !dirty,
    checks: {
      secretScan: categoryPass("secret") ? "PASS" : "FAIL",
      personalDataScan: categoryPass("personal-data") ? "PASS" : "FAIL",
      appScopeConfirmed: categoryPass("app-scope") ? "PASS" : "FAIL",
    },
    trackedFiles: trackedPaths.length,
    textFilesScanned: tracked.textFilesScanned,
    binaryFilesSkipped: tracked.binaryFilesSkipped,
    builtTextFilesScanned: built.filesScanned,
    findings,
  };
}

function runCli() {
  const args = new Set(process.argv.slice(2));
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let report;
  try {
    report = auditRepository(root, { allowDirty: args.has("--allow-dirty") });
  } catch (error) {
    console.error(`Stan公開範囲監査を実行できません: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (args.has("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Stan public scope audit: ${report.status}`);
    console.log(`Commit: ${report.commit}${report.commitBound ? "" : " (dirty; evidenceには使用不可)"}`);
    console.log(
      `Checks: secret ${report.checks.secretScan}, personal data ${report.checks.personalDataScan}, ` +
      `app scope ${report.checks.appScopeConfirmed}`,
    );
    console.log(
      `Scanned: tracked ${report.trackedFiles}, text ${report.textFilesScanned}, ` +
      `built text ${report.builtTextFilesScanned}, binary skipped ${report.binaryFilesSkipped}`,
    );
    for (const finding of report.findings) {
      const location = finding.line == null ? finding.path : `${finding.path}:${finding.line}`;
      console.error(`- ${finding.category}/${finding.rule}: ${location}`);
    }
  }

  if (report.status !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
