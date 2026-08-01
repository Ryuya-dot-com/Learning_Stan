import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_EVIDENCE_IDS = Array.from({ length: 14 }, (_, index) =>
  `G${String(index + 1).padStart(2, "0")}`
);

const DECISIONS = new Set(["PASS", "FAIL", "BLOCKED"]);
const EVIDENCE_STATES = new Set(["NOT RUN", "PASS", "FAIL", "BLOCKED"]);
const ISSUE_SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);
const ISSUE_STATES = new Set(["OPEN", "CLOSED"]);
const REQUIRED_A11Y_RECORDS = ["A11Y-WIN", "A11Y-MAC", "A11Y-MOBILE"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasFinalTarget(status) {
  return /^[0-9a-f]{40}$/.test(status?.target?.commit || "") &&
    /^https:\/\//.test(status?.target?.url || "");
}

function hasIndependentReview(status) {
  const reviewer = status?.independentReview?.reviewerCode;
  return hasText(reviewer) &&
    reviewer !== status?.primaryImplementerCode &&
    /^\d{4}-\d{2}-\d{2}/.test(status?.independentReview?.signedAt || "");
}

function participantRecordsComplete(status) {
  const records = status?.participants?.records;
  return Number.isInteger(status?.participants?.eligibleComplete) &&
    status.participants.eligibleComplete >= 3 &&
    Array.isArray(records) &&
    records.length === status.participants.eligibleComplete &&
    new Set(records).size === records.length;
}

function accessibilityRecordsComplete(status) {
  const records = status?.accessibility?.records;
  return Array.isArray(records) &&
    REQUIRED_A11Y_RECORDS.every((required) => records.includes(required)) &&
    new Set(records).size === records.length;
}

function openIssues(status, severities) {
  const issues = Array.isArray(status?.issues) ? status.issues : [];
  return issues.filter(
    (issue) => issue.status === "OPEN" && severities.includes(issue.severity)
  );
}

export function deriveGateDecision(status) {
  const evidence = Array.isArray(status?.evidence) ? status.evidence : [];
  if (evidence.some((item) => item.status === "FAIL") || openIssues(status, ["P0", "P1"]).length > 0) {
    return "FAIL";
  }

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const allEvidencePasses = REQUIRED_EVIDENCE_IDS.every(
    (id) => evidenceById.get(id)?.status === "PASS"
  );
  const openP2IsManaged = openIssues(status, ["P2"]).every(
    (issue) => hasText(issue.owner) && /^\d{4}-\d{2}-\d{2}$/.test(issue.due || "") && hasText(issue.retest)
  );

  if (
    allEvidencePasses &&
    hasFinalTarget(status) &&
    participantRecordsComplete(status) &&
    accessibilityRecordsComplete(status) &&
    hasIndependentReview(status) &&
    openP2IsManaged
  ) return "PASS";

  return "BLOCKED";
}

export function validateGateStatus(status) {
  const errors = [];
  if (!isRecord(status)) return ["ルートはobjectである必要があります"];
  if (status.schemaVersion !== 1) errors.push("schemaVersionは1である必要があります");
  if (!/^FG-[A-Z0-9-]+$/.test(status.gateId || "")) errors.push("gateIdはFG-で始まる必要があります");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(status.updatedAt || "")) errors.push("updatedAtはYYYY-MM-DDで記録します");
  if (!DECISIONS.has(status.decision)) errors.push("decisionが未対応です");
  if (!hasText(status.primaryImplementerCode)) errors.push("primaryImplementerCodeが必要です");

  if (!Array.isArray(status.evidence)) {
    errors.push("evidenceは配列である必要があります");
  } else {
    const ids = status.evidence.map((item) => item?.id);
    if (new Set(ids).size !== ids.length) errors.push("evidence IDが重複しています");
    const missing = REQUIRED_EVIDENCE_IDS.filter((id) => !ids.includes(id));
    const unknown = ids.filter((id) => !REQUIRED_EVIDENCE_IDS.includes(id));
    if (missing.length > 0) errors.push(`必須evidenceがありません: ${missing.join(", ")}`);
    if (unknown.length > 0) errors.push(`未知のevidenceがあります: ${unknown.join(", ")}`);

    for (const item of status.evidence) {
      if (!isRecord(item) || !EVIDENCE_STATES.has(item.status)) {
        errors.push(`${item?.id || "evidence"}: statusが不正です`);
        continue;
      }
      if (!Array.isArray(item.artifacts) || item.artifacts.some((artifact) => !hasText(artifact))) {
        errors.push(`${item.id}: artifactsは文字列配列である必要があります`);
      }
      if (item.status === "PASS" && (!Array.isArray(item.artifacts) || item.artifacts.length === 0)) {
        errors.push(`${item.id}: PASSには証拠リンクが必要です`);
      }
      if (!hasText(item.note)) errors.push(`${item.id}: noteが必要です`);
    }
  }

  if (!isRecord(status.participants) || !Number.isInteger(status.participants.eligibleComplete) ||
      status.participants.eligibleComplete < 0 || !Array.isArray(status.participants.records)) {
    errors.push("participantsの件数とrecordsが必要です");
  } else if (new Set(status.participants.records).size !== status.participants.records.length) {
    errors.push("参加者記録が重複しています");
  }

  if (!isRecord(status.accessibility) || !Array.isArray(status.accessibility.records)) {
    errors.push("accessibility.recordsが必要です");
  } else if (new Set(status.accessibility.records).size !== status.accessibility.records.length) {
    errors.push("アクセシビリティ記録が重複しています");
  }

  if (!Array.isArray(status.issues)) {
    errors.push("issuesは配列である必要があります");
  } else {
    const issueIds = status.issues.map((issue) => issue?.id);
    if (new Set(issueIds).size !== issueIds.length) errors.push("問題IDが重複しています");
    for (const issue of status.issues) {
      if (!hasText(issue?.id)) errors.push("問題IDが必要です");
      if (!ISSUE_SEVERITIES.has(issue?.severity)) errors.push(`${issue?.id || "issue"}: severityが不正です`);
      if (!ISSUE_STATES.has(issue?.status)) errors.push(`${issue?.id || "issue"}: statusが不正です`);
      if (issue?.status === "OPEN" && issue?.severity === "P2") {
        if (!hasText(issue.owner)) errors.push(`${issue.id}: 未解決P2にownerが必要です`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(issue.due || "")) errors.push(`${issue.id}: 未解決P2にdueが必要です`);
        if (!hasText(issue.retest)) errors.push(`${issue.id}: 未解決P2にretestが必要です`);
      }
    }
  }

  const derived = deriveGateDecision(status);
  if (DECISIONS.has(status.decision) && status.decision !== derived) {
    errors.push(`decisionは${derived}である必要があります（宣言: ${status.decision}）`);
  }
  if (status.decision === "PASS") {
    if (!hasFinalTarget(status)) errors.push("PASSには40桁commit SHAとHTTPS URLが必要です");
    if (!participantRecordsComplete(status)) errors.push("PASSには適格な完走記録3件以上が必要です");
    if (!accessibilityRecordsComplete(status)) errors.push("PASSには3つの必須実機監査が必要です");
    if (!hasIndependentReview(status)) errors.push("PASSには主実装者と異なる独立レビュー署名が必要です");
  }

  return errors;
}

export function summarizeGateStatus(status) {
  const counts = Object.fromEntries([...EVIDENCE_STATES].map((state) => [state, 0]));
  for (const evidence of status.evidence || []) {
    if (evidence.status in counts) counts[evidence.status] += 1;
  }
  return {
    decision: deriveGateDecision(status),
    evidence: counts,
    participants: status.participants?.eligibleComplete || 0,
    accessibilityRecords: status.accessibility?.records?.length || 0,
    openIssues: (status.issues || []).filter((issue) => issue.status === "OPEN").length,
  };
}

export function loadGateStatus(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runCli() {
  const args = process.argv.slice(2);
  const requirePass = args.includes("--require-pass");
  const pathArg = args.find((arg) => !arg.startsWith("--"));
  const path = resolve(pathArg || "quality/foundation-gate/status.json");
  let status;
  try {
    status = loadGateStatus(path);
  } catch (error) {
    console.error(`Foundation Gate状態を読めません: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const errors = validateGateStatus(status);
  if (errors.length > 0) {
    console.error("Foundation Gate状態が不正です:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 2;
    return;
  }

  const summary = summarizeGateStatus(status);
  console.log(`Foundation Gate: ${summary.decision}`);
  console.log(
    `Evidence: PASS ${summary.evidence.PASS}/${REQUIRED_EVIDENCE_IDS.length}, ` +
    `FAIL ${summary.evidence.FAIL}, BLOCKED ${summary.evidence.BLOCKED}, NOT RUN ${summary.evidence["NOT RUN"]}`
  );
  console.log(
    `Participants: ${summary.participants}, accessibility records: ${summary.accessibilityRecords}, ` +
    `open issues: ${summary.openIssues}`
  );
  if (requirePass && summary.decision !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
