import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  REQUIRED_REVIEW_SCOPES,
  REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS,
  REQUIRED_STAN_STATIC_COMMANDS,
} from "./stan-release-gate.mjs";

const REQUIRED_EVIDENCE_SETS = [...REQUIRED_REVIEW_SCOPES, "public-scope"];
const REQUIRED_COMMANDS = [
  ...REQUIRED_STAN_STATIC_COMMANDS,
  ...REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS,
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRepoPath(root, value, label, errors) {
  if (!hasText(value) || isAbsolute(value) || value.split(/[\\/]/).includes("..")) {
    errors.push(`${label}はrepository内の相対pathである必要があります`);
    return;
  }
  if (!existsSync(resolve(root, value))) errors.push(`${label}が存在しません: ${value}`);
}

export function validateStanReviewPlan(plan, status, root) {
  const errors = [];
  if (!isRecord(plan)) return ["review planはobjectである必要があります"];
  if (plan.schemaVersion !== 1) errors.push("schemaVersionは1である必要があります");
  if (plan.status !== "ready-not-reviewed") {
    errors.push("review planはレビュー未実施のready-not-reviewedである必要があります");
  }
  if (plan.gateId !== status?.gateId) errors.push("gateIdがstatus.jsonと一致しません");
  if (plan.target?.commit !== status?.target?.commit || plan.target?.url !== status?.target?.url) {
    errors.push("review対象がstatus.jsonの対象commit・URLと一致しません");
  }
  if (plan.primaryImplementerCode !== status?.primaryImplementerCode) {
    errors.push("主実装者コードがstatus.jsonと一致しません");
  }
  if (!Array.isArray(plan.requiredReviewScopes)) {
    errors.push("requiredReviewScopesが必要です");
  } else {
    const scopes = new Set(plan.requiredReviewScopes);
    if (scopes.size !== plan.requiredReviewScopes.length ||
        REQUIRED_REVIEW_SCOPES.some((scope) => !scopes.has(scope)) ||
        plan.requiredReviewScopes.some((scope) => !REQUIRED_REVIEW_SCOPES.includes(scope))) {
      errors.push("requiredReviewScopesはStan独立レビューの3 scopeと完全一致する必要があります");
    }
  }

  for (const [key, value] of [["protocol", plan.protocol], ["recordTemplate", plan.recordTemplate]]) {
    validateRepoPath(root, value, key, errors);
  }

  if (!Array.isArray(plan.commands) ||
      REQUIRED_COMMANDS.some((command) => !plan.commands.includes(command))) {
    errors.push("review planに必須の静的検証・公開範囲監査コマンドがありません");
  }

  if (!isRecord(plan.evidenceSets)) {
    errors.push("evidenceSetsが必要です");
  } else {
    for (const setName of REQUIRED_EVIDENCE_SETS) {
      const paths = plan.evidenceSets[setName];
      if (!Array.isArray(paths) || paths.length === 0) {
        errors.push(`evidenceSets.${setName}が必要です`);
        continue;
      }
      if (new Set(paths).size !== paths.length) errors.push(`evidenceSets.${setName}が重複しています`);
      for (const [index, path] of paths.entries()) {
        validateRepoPath(root, path, `evidenceSets.${setName}[${index}]`, errors);
      }
    }
  }

  const ciRun = plan.automatedEvidence?.ciRun;
  if (ciRun !== status?.cleanCi?.runUrl || ciRun !== status?.publicScopeReview?.artifact) {
    errors.push("自動CI証拠がSRG03・SRG09の記録と一致しません");
  }
  if (Object.hasOwn(plan, "reviewerCode") || Object.hasOwn(plan, "signedAt")) {
    errors.push("未実施planへレビュー者や署名を記録しません");
  }
  return errors;
}

export function loadStanReviewPlan(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runCli() {
  const root = resolve(".");
  const planPath = resolve(process.argv[2] || "quality/stan-release-gate/review-plan.json");
  const statusPath = resolve("quality/stan-release-gate/status.json");
  let plan;
  let status;
  try {
    plan = loadStanReviewPlan(planPath);
    status = JSON.parse(readFileSync(statusPath, "utf8"));
  } catch (error) {
    console.error(`Stan review planを読めません: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const errors = validateStanReviewPlan(plan, status, root);
  if (errors.length > 0) {
    console.error("Stan review planが不正です:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 2;
    return;
  }
  console.log(`Stan review packet: READY TO REVIEW (review not completed)`);
  console.log(`Target: ${plan.target.commit}`);
  console.log(`Scopes: ${plan.requiredReviewScopes.join(", ")} + public-scope`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
