import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const FEEDBACK_CATEGORY_IDS = Array.from({ length: 14 }, (_, index) =>
  `G${String(index + 1).padStart(2, "0")}`
);

const FEEDBACK_STATES = new Set(["NOT RUN", "RECORDED", "NEEDS FOLLOW-UP"]);
const EVIDENCE_STATES = new Set(["NOT RUN", "RECORDED", "NEEDS FOLLOW-UP", "INVALID"]);
const ISSUE_SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);
const ISSUE_STATES = new Set(["OPEN", "CLOSED"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function openIssues(status) {
  return Array.isArray(status?.issues)
    ? status.issues.filter((issue) => issue.status === "OPEN")
    : [];
}

export function deriveFeedbackStatus(status) {
  const evidence = Array.isArray(status?.evidence) ? status.evidence : [];
  const needsFollowUp = openIssues(status).length > 0
    || evidence.some((item) => item.status === "NEEDS FOLLOW-UP");

  if (needsFollowUp) return "NEEDS FOLLOW-UP";

  const hasRecords = evidence.some((item) => item.status === "RECORDED")
    || (status?.participants?.records?.length || 0) > 0
    || (status?.accessibility?.records?.length || 0) > 0;

  return hasRecords ? "RECORDED" : "NOT RUN";
}

export function validateFeedbackStatus(status) {
  const errors = [];
  if (!isRecord(status)) return ["ルートはobjectである必要があります"];
  if (status.schemaVersion !== 2) errors.push("schemaVersionは2である必要があります");
  if (!/^FF-[A-Z0-9-]+$/.test(status.feedbackId || "")) errors.push("feedbackIdはFF-で始まる必要があります");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(status.updatedAt || "")) errors.push("updatedAtはYYYY-MM-DDで記録します");
  if (!FEEDBACK_STATES.has(status.feedbackStatus)) errors.push("feedbackStatusが未対応です");
  if (!hasText(status.publicationPolicy) || !status.publicationPolicy.includes("公開")) {
    errors.push("publicationPolicyに公開との関係を明記します");
  }

  if (!Array.isArray(status.evidence)) {
    errors.push("evidenceは配列である必要があります");
  } else {
    const ids = status.evidence.map((item) => item?.id);
    if (new Set(ids).size !== ids.length) errors.push("evidence IDが重複しています");
    const unknown = ids.filter((id) => !FEEDBACK_CATEGORY_IDS.includes(id));
    if (unknown.length > 0) errors.push(`未知のevidenceがあります: ${unknown.join(", ")}`);

    for (const item of status.evidence) {
      if (!isRecord(item) || !EVIDENCE_STATES.has(item.status)) {
        errors.push(`${item?.id || "evidence"}: statusが不正です`);
        continue;
      }
      if (!Array.isArray(item.artifacts) || item.artifacts.some((artifact) => !hasText(artifact))) {
        errors.push(`${item.id}: artifactsは文字列配列である必要があります`);
      }
      if (item.status === "RECORDED" && item.artifacts?.length === 0) {
        errors.push(`${item.id}: RECORDEDには匿名化した記録または根拠リンクが必要です`);
      }
      if (!hasText(item.note)) errors.push(`${item.id}: noteが必要です`);
    }
  }

  for (const section of ["participants", "accessibility"]) {
    const records = status?.[section]?.records;
    if (!Array.isArray(records) || records.some((record) => !hasText(record))) {
      errors.push(`${section}.recordsは空でない文字列の配列である必要があります`);
    } else if (new Set(records).size !== records.length) {
      errors.push(`${section}.recordsが重複しています`);
    }
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
    }
  }

  const derived = deriveFeedbackStatus(status);
  if (FEEDBACK_STATES.has(status.feedbackStatus) && status.feedbackStatus !== derived) {
    errors.push(`feedbackStatusは${derived}である必要があります（宣言: ${status.feedbackStatus}）`);
  }
  return errors;
}

export function summarizeFeedbackStatus(status) {
  const evidence = Object.fromEntries([...EVIDENCE_STATES].map((state) => [state, 0]));
  for (const item of status.evidence || []) {
    if (item.status in evidence) evidence[item.status] += 1;
  }
  return {
    status: deriveFeedbackStatus(status),
    evidence,
    participants: status.participants?.records?.length || 0,
    accessibilityRecords: status.accessibility?.records?.length || 0,
    openIssues: openIssues(status).length,
  };
}

function runCli() {
  const pathArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const statusPath = resolve(pathArg || "quality/foundation-gate/status.json");
  let status;

  try {
    status = JSON.parse(readFileSync(statusPath, "utf8"));
  } catch (error) {
    console.error(`Foundation feedback状態を読めません: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const errors = validateFeedbackStatus(status);
  if (errors.length > 0) {
    console.error("Foundation feedback状態が不正です:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 2;
    return;
  }

  const summary = summarizeFeedbackStatus(status);
  console.log(`Foundation feedback: ${summary.status}`);
  console.log(
    `Evidence: RECORDED ${summary.evidence.RECORDED}/${FEEDBACK_CATEGORY_IDS.length}, `
    + `NEEDS FOLLOW-UP ${summary.evidence["NEEDS FOLLOW-UP"]}, INVALID ${summary.evidence.INVALID}, `
    + `NOT RUN ${summary.evidence["NOT RUN"]}`
  );
  console.log(
    `Feedback records: learners ${summary.participants}, accessibility ${summary.accessibilityRecords}, `
    + `open improvement items ${summary.openIssues}`
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
