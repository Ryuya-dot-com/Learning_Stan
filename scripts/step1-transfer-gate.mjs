import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_TRANSFER_EVIDENCE_IDS = Array.from(
  { length: 5 },
  (_, index) => `TR${String(index + 1).padStart(2, "0")}`
);

const DECISIONS = new Set(["NOT RUN", "OBSERVED", "BLOCKED", "INVALID"]);
const EVIDENCE_STATES = new Set(["NOT RUN", "OBSERVED", "BLOCKED", "INVALID"]);
const ISSUE_SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);
const ISSUE_STATES = new Set(["OPEN", "CLOSED"]);

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
  const participants = status?.participants;
  return Number.isInteger(participants?.eligibleComplete) &&
    participants.eligibleComplete >= 3 &&
    Array.isArray(participants.records) &&
    participants.records.length === participants.eligibleComplete &&
    participants.records.every(hasText) &&
    new Set(participants.records).size === participants.records.length;
}

function openIssues(status, severities) {
  const issues = Array.isArray(status?.issues) ? status.issues : [];
  return issues.filter(
    (issue) => issue.status === "OPEN" && severities.includes(issue.severity)
  );
}

function hasStarted(status) {
  return (status?.participants?.eligibleComplete || 0) > 0 ||
    (status?.participants?.blockedSessions || 0) > 0 ||
    (status?.participants?.invalidSessions || 0) > 0 ||
    (status?.evidence || []).some((item) => item.status !== "NOT RUN");
}

export function deriveTransferGateDecision(status) {
  if (status?.protocolValidity?.invalid === true) return "INVALID";

  const evidence = Array.isArray(status?.evidence) ? status.evidence : [];
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const allObserved = REQUIRED_TRANSFER_EVIDENCE_IDS.every(
    (id) => byId.get(id)?.status === "OBSERVED"
  );
  const openP2Managed = openIssues(status, ["P2"]).every(
    (issue) => hasText(issue.owner) &&
      /^\d{4}-\d{2}-\d{2}$/.test(issue.due || "") &&
      hasText(issue.retest)
  );

  if (
    allObserved &&
    participantRecordsComplete(status) &&
    hasFinalTarget(status) &&
    hasIndependentReview(status) &&
    hasText(status?.decisionRecord) &&
    openIssues(status, ["P0", "P1"]).length === 0 &&
    openP2Managed
  ) return "OBSERVED";

  return hasStarted(status) ? "BLOCKED" : "NOT RUN";
}

export function validateTransferGateStatus(status) {
  const errors = [];
  if (!isRecord(status)) return ["ルートはobjectである必要があります"];
  if (status.schemaVersion !== 1) errors.push("schemaVersionは1である必要があります");
  if (!/^STR-[A-Z0-9-]+$/.test(status.gateId || "")) errors.push("gateIdはSTR-で始まる必要があります");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(status.updatedAt || "")) errors.push("updatedAtはYYYY-MM-DDで記録します");
  if (!DECISIONS.has(status.decision)) errors.push("decisionが未対応です");
  if (!hasText(status.primaryImplementerCode)) errors.push("primaryImplementerCodeが必要です");

  if (!Array.isArray(status.evidence)) {
    errors.push("evidenceは配列である必要があります");
  } else {
    const ids = status.evidence.map((item) => item?.id);
    if (new Set(ids).size !== ids.length) errors.push("evidence IDが重複しています");
    const missing = REQUIRED_TRANSFER_EVIDENCE_IDS.filter((id) => !ids.includes(id));
    const unknown = ids.filter((id) => !REQUIRED_TRANSFER_EVIDENCE_IDS.includes(id));
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
      if (item.status === "OBSERVED" && (!Array.isArray(item.artifacts) || item.artifacts.length === 0)) {
        errors.push(`${item.id}: OBSERVEDには匿名証拠リンクが必要です`);
      }
      if (!hasText(item.note)) errors.push(`${item.id}: noteが必要です`);
    }
  }

  const participants = status.participants;
  if (
    !isRecord(participants) ||
    !Number.isInteger(participants.eligibleComplete) || participants.eligibleComplete < 0 ||
    !Number.isInteger(participants.blockedSessions) || participants.blockedSessions < 0 ||
    !Number.isInteger(participants.invalidSessions) || participants.invalidSessions < 0 ||
    !Array.isArray(participants.records)
  ) {
    errors.push("participantsの件数とrecordsが必要です");
  } else {
    if (participants.records.length !== participants.eligibleComplete) {
      errors.push("eligibleCompleteとrecords件数が一致する必要があります");
    }
    if (participants.records.some((record) => !hasText(record))) {
      errors.push("参加者記録は空でない文字列である必要があります");
    }
    if (new Set(participants.records).size !== participants.records.length) {
      errors.push("参加者記録が重複しています");
    }
  }

  if (!isRecord(status.protocolValidity) || typeof status.protocolValidity.invalid !== "boolean") {
    errors.push("protocolValidity.invalidが必要です");
  } else if (status.protocolValidity.invalid && !hasText(status.protocolValidity.reason)) {
    errors.push("INVALIDにはprotocolValidity.reasonが必要です");
  }

  if (!Array.isArray(status.issues)) {
    errors.push("issuesは配列である必要があります");
  } else {
    const ids = status.issues.map((issue) => issue?.id);
    if (new Set(ids).size !== ids.length) errors.push("問題IDが重複しています");
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

  const derived = deriveTransferGateDecision(status);
  if (DECISIONS.has(status.decision) && status.decision !== derived) {
    errors.push(`decisionは${derived}である必要があります（宣言: ${status.decision}）`);
  }
  if (status.decision === "OBSERVED") {
    if (!hasFinalTarget(status)) errors.push("OBSERVEDには40桁commit SHAとHTTPS URLが必要です");
    if (!participantRecordsComplete(status)) errors.push("OBSERVEDには適格な匿名観察記録3件以上が必要です");
    if (!hasIndependentReview(status)) errors.push("OBSERVEDには主実装者と異なる独立レビュー署名が必要です");
    if (!hasText(status.decisionRecord)) errors.push("OBSERVEDにはコホート判断記録が必要です");
    if (openIssues(status, ["P0", "P1"]).length > 0) errors.push("OBSERVEDには未解決P0・P1が0件である必要があります");
  }

  return errors;
}

export function summarizeTransferGateStatus(status) {
  const evidence = Object.fromEntries([...EVIDENCE_STATES].map((state) => [state, 0]));
  for (const item of status.evidence || []) {
    if (item.status in evidence) evidence[item.status] += 1;
  }
  return {
    decision: deriveTransferGateDecision(status),
    evidence,
    participants: status.participants?.eligibleComplete || 0,
    blockedSessions: status.participants?.blockedSessions || 0,
    invalidSessions: status.participants?.invalidSessions || 0,
    openIssues: (status.issues || []).filter((issue) => issue.status === "OPEN").length,
  };
}

export function loadTransferGateStatus(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runCli() {
  const args = process.argv.slice(2);
  const requireObserved = args.includes("--require-observed");
  const pathArg = args.find((arg) => !arg.startsWith("--"));
  const path = resolve(pathArg || "quality/step1-transfer-gate/status.json");
  let status;
  try {
    status = loadTransferGateStatus(path);
  } catch (error) {
    console.error(`STEP 1独立転移観察の状態を読めません: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const errors = validateTransferGateStatus(status);
  if (errors.length > 0) {
    console.error("STEP 1独立転移観察の状態が不正です:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 2;
    return;
  }

  const summary = summarizeTransferGateStatus(status);
  console.log(`STEP 1 Transfer Observation: ${summary.decision}`);
  console.log(
    `Evidence: OBSERVED ${summary.evidence.OBSERVED}/${REQUIRED_TRANSFER_EVIDENCE_IDS.length}, ` +
    `BLOCKED ${summary.evidence.BLOCKED}, INVALID ${summary.evidence.INVALID}, ` +
    `NOT RUN ${summary.evidence["NOT RUN"]}`
  );
  console.log(
    `Participants: valid ${summary.participants}/3, blocked ${summary.blockedSessions}, ` +
    `invalid ${summary.invalidSessions}, open issues ${summary.openIssues}`
  );
  if (requireObserved && summary.decision !== "OBSERVED") process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
