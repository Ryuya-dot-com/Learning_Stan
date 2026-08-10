import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STAN_RELEASE_EVIDENCE_IDS = Array.from(
  { length: 10 },
  (_, index) => `SRG${String(index + 1).padStart(2, "0")}`,
);

export const REQUIRED_STAN_RELEASE_EVIDENCE_IDS = [
  "SRG02",
  "SRG03",
  "SRG04",
  "SRG05",
  "SRG09",
  "SRG10",
];

export const ADVISORY_STAN_EVIDENCE_IDS = ["SRG01", "SRG06", "SRG07", "SRG08"];

export const FEEDBACK_SCOPES = [
  "stan-language",
  "statistical-model",
  "learner-material",
];

export const REQUIRED_STAN_STATIC_COMMANDS = [
  "npm test",
  "npm run test:stan-content",
];

export const REQUIRED_STAN_CI_JOBS = ["build", "r-verify", "stan-verify"];

export const REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS = [
  "npm run build",
  "npm run audit:stan-public-scope",
];

const DECISIONS = new Set(["PASS", "FAIL", "BLOCKED"]);
const EVIDENCE_STATES = new Set(["NOT RUN", "PASS", "FAIL", "BLOCKED", "RECORDED"]);
const RUNTIME_STATES = new Set(["NOT RUN", "PASS", "FAIL", "BLOCKED"]);
const FEEDBACK_STATES = new Set(["NOT RUN", "RECORDED"]);
const ISSUE_SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);
const ISSUE_STATES = new Set(["OPEN", "CLOSED"]);
const AUDIT_STATES = new Set(["NOT RUN", "PASS", "FAIL"]);
const CI_EVENTS = new Set(["pull_request", "push", "workflow_dispatch"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value || "");
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(value || "");
}

function hasFinalTarget(status) {
  return /^[0-9a-f]{40}$/.test(status?.target?.commit || "") &&
    /^https:\/\//.test(status?.target?.url || "");
}

function evidenceById(status, id) {
  return (status?.evidence || []).find((item) => item?.id === id);
}

function matchesTargetCommit(status, commit) {
  return /^[0-9a-f]{40}$/.test(commit || "") && commit === status?.target?.commit;
}

function hasStaticVerification(status) {
  const verification = status?.staticVerification;
  return verification?.status === "PASS" &&
    matchesTargetCommit(status, verification?.commit) &&
    hasText(verification?.artifact) &&
    Array.isArray(verification?.commands) &&
    REQUIRED_STAN_STATIC_COMMANDS.every((command) => verification.commands.includes(command));
}

function hasCleanCi(status) {
  const cleanCi = status?.cleanCi;
  return cleanCi?.status === "PASS" &&
    matchesTargetCommit(status, cleanCi?.commit) &&
    /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+$/.test(cleanCi?.runUrl || "") &&
    CI_EVENTS.has(cleanCi?.event) &&
    REQUIRED_STAN_CI_JOBS.every((job) => cleanCi?.jobs?.[job] === "PASS");
}

function hasFoundationPass(status) {
  return status?.foundationGate?.decision === "PASS" &&
    hasText(status?.foundationGate?.artifact);
}

function runtimeScenarioComplete(scenario) {
  return scenario?.status === "PASS" &&
    hasText(scenario?.scenarioId) &&
    hasText(scenario?.artifact);
}

function hasRuntimeComparison(status) {
  const comparison = status?.runtimeComparison;
  const diagnostics = comparison?.diagnostics;
  const environment = comparison?.environment;
  return runtimeScenarioComplete(comparison?.weakInformation) &&
    runtimeScenarioComplete(comparison?.strongInformation) &&
    isSha256(comparison?.sourceHashes?.centered) &&
    isSha256(comparison?.sourceHashes?.noncentered) &&
    comparison.sourceHashes.centered !== comparison.sourceHashes.noncentered &&
    hasText(environment?.rVersion) &&
    hasText(environment?.cmdstanrVersion) &&
    hasText(environment?.cmdstanVersion) &&
    Number.isInteger(diagnostics?.chains) && diagnostics.chains >= 4 &&
    diagnostics?.divergenceChecked === true &&
    diagnostics?.treedepthChecked === true &&
    diagnostics?.ebfmiChecked === true &&
    diagnostics?.rhatChecked === true &&
    diagnostics?.essChecked === true &&
    diagnostics?.mcseChecked === true &&
    diagnostics?.timingChecked === true &&
    diagnostics?.posteriorEquivalenceChecked === true;
}

function hasExistingRuntimeRevalidation(status) {
  const revalidation = status?.existingRuntimeRevalidation;
  return revalidation?.status === "PASS" &&
    hasText(revalidation?.artifact) &&
    hasText(revalidation?.verifier) &&
    revalidation?.scenarios?.linearRegression === "PASS" &&
    revalidation?.scenarios?.truncation === "PASS" &&
    revalidation?.scenarios?.linkLoo === "PASS" &&
    hasText(revalidation?.environment?.rVersion) &&
    hasText(revalidation?.environment?.cmdstanrVersion) &&
    hasText(revalidation?.environment?.cmdstanVersion) &&
    hasText(revalidation?.environment?.looVersion) &&
    revalidation?.sourceHashesChecked === true &&
    revalidation?.diagnosticsChecked === true &&
    revalidation?.teachingConclusionsChecked === true &&
    revalidation?.artifactsChecked === true;
}

function hasExternalFeedback(status) {
  const feedback = status?.externalFeedback;
  return feedback?.status === "RECORDED" &&
    isDate(feedback?.receivedAt) &&
    hasText(feedback?.contributorProfile) &&
    Array.isArray(feedback?.scopes) &&
    feedback.scopes.length > 0 &&
    feedback.scopes.every((scope) => FEEDBACK_SCOPES.includes(scope)) &&
    new Set(feedback.scopes).size === feedback.scopes.length &&
    hasText(feedback?.summaryArtifact);
}

function learnerObservationComplete(status) {
  const observation = status?.learnerObservation;
  return Number.isInteger(observation?.eligibleComplete) &&
    observation.eligibleComplete >= 3 &&
    Array.isArray(observation.records) &&
    observation.records.length === observation.eligibleComplete &&
    observation.records.every(hasText) &&
    new Set(observation.records).size === observation.records.length;
}

function delayedRetentionComplete(status) {
  const retention = status?.delayedRetention;
  return retention?.minimumDays === 7 &&
    retention?.maximumDays === 14 &&
    Number.isInteger(retention?.eligibleComplete) &&
    retention.eligibleComplete >= 3 &&
    Array.isArray(retention.records) &&
    retention.records.length === retention.eligibleComplete &&
    retention.records.every((record) =>
      isRecord(record) &&
      hasText(record.artifact) &&
      Number.isInteger(record.daysAfter) &&
      record.daysAfter >= retention.minimumDays &&
      record.daysAfter <= retention.maximumDays
    ) &&
    new Set(retention.records.map((record) => record.artifact)).size === retention.records.length;
}

function hasPublicScopeConfirmation(status) {
  const confirmation = status?.publicScopeConfirmation;
  return hasText(confirmation?.confirmedByCode) &&
    isDate(confirmation?.confirmedAt) &&
    matchesTargetCommit(status, confirmation?.commit) &&
    Array.isArray(confirmation?.commands) &&
    REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS.every((command) => confirmation.commands.includes(command)) &&
    hasText(confirmation?.artifact) &&
    confirmation?.secretScan === "PASS" &&
    confirmation?.personalDataScan === "PASS" &&
    confirmation?.appScopeConfirmed === "PASS";
}

function openIssues(status, severities) {
  const issues = Array.isArray(status?.issues) ? status.issues : [];
  return issues.filter(
    (issue) => issue.status === "OPEN" && severities.includes(issue.severity),
  );
}

function openP2IsManaged(status) {
  return openIssues(status, ["P2"]).every(
    (issue) => hasText(issue.owner) && isDate(issue.due) && hasText(issue.retest),
  );
}

export function deriveStanReleaseDecision(status) {
  const evidence = Array.isArray(status?.evidence) ? status.evidence : [];
  if (
    evidence.some((item) => item?.status === "FAIL") ||
    status?.foundationGate?.decision === "FAIL" ||
    status?.runtimeComparison?.weakInformation?.status === "FAIL" ||
    status?.runtimeComparison?.strongInformation?.status === "FAIL" ||
    status?.existingRuntimeRevalidation?.status === "FAIL" ||
    status?.publicScopeConfirmation?.secretScan === "FAIL" ||
    status?.publicScopeConfirmation?.personalDataScan === "FAIL" ||
    status?.publicScopeConfirmation?.appScopeConfirmed === "FAIL" ||
    openIssues(status, ["P0", "P1"]).length > 0
  ) return "FAIL";

  const byId = new Map(evidence.map((item) => [item?.id, item]));
  const allRequiredEvidencePasses = REQUIRED_STAN_RELEASE_EVIDENCE_IDS.every(
    (id) => byId.get(id)?.status === "PASS",
  );

  if (
    allRequiredEvidencePasses &&
    hasFinalTarget(status) &&
    hasStaticVerification(status) &&
    hasCleanCi(status) &&
    hasExistingRuntimeRevalidation(status) &&
    hasRuntimeComparison(status) &&
    hasPublicScopeConfirmation(status) &&
    hasText(status?.decisionRecord) &&
    openP2IsManaged(status)
  ) return "PASS";

  return "BLOCKED";
}

function validateStaticVerification(status, errors) {
  const verification = status.staticVerification;
  if (!isRecord(verification) || !RUNTIME_STATES.has(verification?.status)) {
    errors.push("staticVerification.statusが不正です");
    return;
  }
  if (verification.commit !== null && !/^[0-9a-f]{40}$/.test(verification.commit || "")) {
    errors.push("staticVerification.commitは40桁SHAまたはnullです");
  }
  if (!Array.isArray(verification.commands) || verification.commands.some((command) => !hasText(command))) {
    errors.push("staticVerification.commandsは文字列配列である必要があります");
  } else if (new Set(verification.commands).size !== verification.commands.length) {
    errors.push("staticVerification.commandsが重複しています");
  }
  if (verification.artifact !== null && !hasText(verification.artifact)) {
    errors.push("staticVerification.artifactはnullまたは文字列です");
  }
  if (
    verification.status === "PASS" || evidenceById(status, "SRG02")?.status === "PASS"
  ) {
    if (!hasStaticVerification(status)) {
      errors.push("SRG02のPASSには対象commitと一致する必須静的検証コマンドと証拠リンクが必要です");
    }
  }
}

function validateCleanCi(status, errors) {
  const cleanCi = status.cleanCi;
  if (!isRecord(cleanCi) || !RUNTIME_STATES.has(cleanCi?.status)) {
    errors.push("cleanCi.statusが不正です");
    return;
  }
  if (cleanCi.commit !== null && !/^[0-9a-f]{40}$/.test(cleanCi.commit || "")) {
    errors.push("cleanCi.commitは40桁SHAまたはnullです");
  }
  if (cleanCi.runUrl !== null && !hasText(cleanCi.runUrl)) {
    errors.push("cleanCi.runUrlはnullまたは文字列です");
  }
  if (cleanCi.event !== null && !CI_EVENTS.has(cleanCi.event)) {
    errors.push("cleanCi.eventが不正です");
  }
  if (!isRecord(cleanCi.jobs)) {
    errors.push("cleanCi.jobsが必要です");
  } else {
    for (const job of REQUIRED_STAN_CI_JOBS) {
      if (!RUNTIME_STATES.has(cleanCi.jobs[job])) {
        errors.push(`cleanCi.jobs.${job}が不正です`);
      }
    }
  }
  if (cleanCi.status === "PASS" || evidenceById(status, "SRG03")?.status === "PASS") {
    if (!hasCleanCi(status)) {
      errors.push("SRG03のPASSには対象commitと一致するGitHub Actions runとNode・R・Stan各jobの成功が必要です");
    }
  }
}

function validateEvidence(status, errors) {
  if (!Array.isArray(status.evidence)) {
    errors.push("evidenceは配列である必要があります");
    return;
  }

  const ids = status.evidence.map((item) => item?.id);
  if (new Set(ids).size !== ids.length) errors.push("evidence IDが重複しています");
  const missing = STAN_RELEASE_EVIDENCE_IDS.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !STAN_RELEASE_EVIDENCE_IDS.includes(id));
  if (missing.length > 0) errors.push(`evidenceがありません: ${missing.join(", ")}`);
  if (unknown.length > 0) errors.push(`未知のevidenceがあります: ${unknown.join(", ")}`);

  for (const item of status.evidence) {
    if (!isRecord(item) || !EVIDENCE_STATES.has(item.status)) {
      errors.push(`${item?.id || "evidence"}: statusが不正です`);
      continue;
    }
    if (!Array.isArray(item.artifacts) || item.artifacts.some((artifact) => !hasText(artifact))) {
      errors.push(`${item.id}: artifactsは文字列配列である必要があります`);
    }
    if (["PASS", "RECORDED"].includes(item.status) &&
        (!Array.isArray(item.artifacts) || item.artifacts.length === 0)) {
      errors.push(`${item.id}: PASS・RECORDEDには公開可能な証拠リンクが必要です`);
    }
    if (item.status === "RECORDED" && item.id !== "SRG06") {
      errors.push(`${item.id}: RECORDEDは第三者フィードバックSRG06だけに使用します`);
    }
    if (!hasText(item.note)) errors.push(`${item.id}: noteが必要です`);
  }
}

function validateRuntimeComparison(status, errors) {
  const comparison = status.runtimeComparison;
  if (!isRecord(comparison)) {
    errors.push("runtimeComparisonが必要です");
    return;
  }

  for (const key of ["weakInformation", "strongInformation"]) {
    const scenario = comparison[key];
    if (!isRecord(scenario) || !RUNTIME_STATES.has(scenario?.status)) {
      errors.push(`runtimeComparison.${key}.statusが不正です`);
      continue;
    }
    if (scenario.scenarioId !== null && !hasText(scenario.scenarioId)) {
      errors.push(`runtimeComparison.${key}.scenarioIdはnullまたは文字列です`);
    }
    if (scenario.artifact !== null && !hasText(scenario.artifact)) {
      errors.push(`runtimeComparison.${key}.artifactはnullまたは文字列です`);
    }
  }

  if (!isRecord(comparison.sourceHashes)) {
    errors.push("runtimeComparison.sourceHashesが必要です");
  } else {
    for (const key of ["centered", "noncentered"]) {
      const value = comparison.sourceHashes[key];
      if (value !== null && !isSha256(value)) {
        errors.push(`runtimeComparison.sourceHashes.${key}は64桁SHA-256またはnullです`);
      }
    }
  }

  if (!isRecord(comparison.environment)) {
    errors.push("runtimeComparison.environmentが必要です");
  } else {
    for (const key of ["rVersion", "cmdstanrVersion", "cmdstanVersion"]) {
      const value = comparison.environment[key];
      if (value !== null && !hasText(value)) {
        errors.push(`runtimeComparison.environment.${key}はnullまたは文字列です`);
      }
    }
  }

  const diagnostics = comparison.diagnostics;
  const booleanChecks = [
    "divergenceChecked",
    "treedepthChecked",
    "ebfmiChecked",
    "rhatChecked",
    "essChecked",
    "mcseChecked",
    "timingChecked",
    "posteriorEquivalenceChecked",
  ];
  if (!isRecord(diagnostics) || !Number.isInteger(diagnostics?.chains) || diagnostics.chains < 0) {
    errors.push("runtimeComparison.diagnostics.chainsは0以上の整数です");
  } else {
    for (const key of booleanChecks) {
      if (typeof diagnostics[key] !== "boolean") {
        errors.push(`runtimeComparison.diagnostics.${key}はbooleanです`);
      }
    }
  }

  if (evidenceById(status, "SRG05")?.status === "PASS" && !hasRuntimeComparison(status)) {
    errors.push("SRG05のPASSには弱情報・強情報の4-chain実測、環境、診断、source hashが必要です");
  }
}

function validateExistingRuntimeRevalidation(status, errors) {
  const revalidation = status.existingRuntimeRevalidation;
  if (!isRecord(revalidation) || !RUNTIME_STATES.has(revalidation?.status)) {
    errors.push("existingRuntimeRevalidation.statusが不正です");
    return;
  }
  for (const key of ["artifact", "verifier"]) {
    if (revalidation[key] !== null && !hasText(revalidation[key])) {
      errors.push(`existingRuntimeRevalidation.${key}はnullまたは文字列です`);
    }
  }
  if (!isRecord(revalidation.scenarios)) {
    errors.push("existingRuntimeRevalidation.scenariosが必要です");
  } else {
    for (const key of ["linearRegression", "truncation", "linkLoo"]) {
      if (!RUNTIME_STATES.has(revalidation.scenarios[key])) {
        errors.push(`existingRuntimeRevalidation.scenarios.${key}が不正です`);
      }
    }
  }
  if (!isRecord(revalidation.environment)) {
    errors.push("existingRuntimeRevalidation.environmentが必要です");
  } else {
    for (const key of ["rVersion", "cmdstanrVersion", "cmdstanVersion", "looVersion"]) {
      const value = revalidation.environment[key];
      if (value !== null && !hasText(value)) {
        errors.push(`existingRuntimeRevalidation.environment.${key}はnullまたは文字列です`);
      }
    }
  }
  for (const key of [
    "sourceHashesChecked", "diagnosticsChecked", "teachingConclusionsChecked", "artifactsChecked",
  ]) {
    if (typeof revalidation[key] !== "boolean") {
      errors.push(`existingRuntimeRevalidation.${key}はbooleanです`);
    }
  }
  if (evidenceById(status, "SRG04")?.status === "PASS" &&
      !hasExistingRuntimeRevalidation(status)) {
    errors.push("SRG04のPASSには単回帰・切断・リンク/LOOの再実行、環境、source hash、診断、教材結論、成果物が必要です");
  }
}

function validateExternalFeedback(status, errors) {
  const feedback = status.externalFeedback;
  if (!isRecord(feedback) || !FEEDBACK_STATES.has(feedback?.status) || !Array.isArray(feedback?.scopes)) {
    errors.push("externalFeedbackはNOT RUNまたはRECORDEDとscopesを持つ必要があります");
    return;
  }
  const evidenceStatus = evidenceById(status, "SRG06")?.status;
  if (feedback.status !== evidenceStatus) {
    errors.push("SRG06とexternalFeedbackの状態をNOT RUNまたはRECORDEDで一致させる必要があります");
  }
  const unknownScopes = feedback.scopes.filter((scope) => !FEEDBACK_SCOPES.includes(scope));
  if (unknownScopes.length > 0) errors.push(`未知のfeedback scopeがあります: ${unknownScopes.join(", ")}`);
  if (new Set(feedback.scopes).size !== feedback.scopes.length) {
    errors.push("feedback scopeが重複しています");
  }
  for (const key of ["receivedAt", "contributorProfile", "summaryArtifact"]) {
    if (feedback[key] !== null && !hasText(feedback[key])) {
      errors.push(`externalFeedback.${key}はnullまたは文字列です`);
    }
  }
  if (feedback.status === "RECORDED" || evidenceById(status, "SRG06")?.status === "RECORDED") {
    if (!hasExternalFeedback(status)) {
      errors.push("SRG06のRECORDEDには日付・相手の属性・1つ以上のscope・短い要約artifactが必要です");
    }
  }
}

function validateLearnerObservation(status, errors) {
  const observation = status.learnerObservation;
  if (
    !isRecord(observation) ||
    !Number.isInteger(observation?.eligibleComplete) ||
    observation.eligibleComplete < 0 ||
    !Array.isArray(observation?.records)
  ) {
    errors.push("learnerObservationの件数とrecordsが必要です");
    return;
  }
  if (observation.records.length !== observation.eligibleComplete) {
    errors.push("learnerObservationのeligibleCompleteとrecords件数が一致する必要があります");
  }
  if (observation.records.some((record) => !hasText(record))) {
    errors.push("learnerObservation.recordsは空でない文字列です");
  }
  if (new Set(observation.records).size !== observation.records.length) {
    errors.push("初学者観察記録が重複しています");
  }
  if (evidenceById(status, "SRG07")?.status === "PASS" && !learnerObservationComplete(status)) {
    errors.push("SRG07のPASSには適格な初学者観察3件以上が必要です");
  }
}

function validateDelayedRetention(status, errors) {
  const retention = status.delayedRetention;
  if (
    !isRecord(retention) ||
    retention?.minimumDays !== 7 ||
    retention?.maximumDays !== 14 ||
    !Number.isInteger(retention?.eligibleComplete) ||
    retention.eligibleComplete < 0 ||
    !Array.isArray(retention?.records)
  ) {
    errors.push("delayedRetentionは7〜14日、0件以上のrecordsとして記録します");
    return;
  }
  if (retention.records.length !== retention.eligibleComplete) {
    errors.push("delayedRetentionのeligibleCompleteとrecords件数が一致する必要があります");
  }
  const invalidRecords = retention.records.filter((record) =>
    !isRecord(record) ||
    !hasText(record.artifact) ||
    !Number.isInteger(record.daysAfter) ||
    record.daysAfter < 7 ||
    record.daysAfter > 14
  );
  if (invalidRecords.length > 0) {
    errors.push("遅延保持記録には匿名artifactと7〜14日のdaysAfterが必要です");
  }
  const artifacts = retention.records.map((record) => record?.artifact);
  if (new Set(artifacts).size !== artifacts.length) errors.push("遅延保持記録が重複しています");
  if (evidenceById(status, "SRG08")?.status === "PASS" && !delayedRetentionComplete(status)) {
    errors.push("SRG08のPASSには7〜14日後の適格な保持記録3件以上が必要です");
  }
}

function validatePublicScopeConfirmation(status, errors) {
  const confirmation = status.publicScopeConfirmation;
  if (!isRecord(confirmation)) {
    errors.push("publicScopeConfirmationが必要です");
    return;
  }
  for (const key of ["secretScan", "personalDataScan", "appScopeConfirmed"]) {
    if (!AUDIT_STATES.has(confirmation[key])) errors.push(`publicScopeConfirmation.${key}が不正です`);
  }
  if (confirmation.commit !== null && !/^[0-9a-f]{40}$/.test(confirmation.commit || "")) {
    errors.push("publicScopeConfirmation.commitは40桁SHAまたはnullです");
  }
  if (!Array.isArray(confirmation.commands) || confirmation.commands.some((command) => !hasText(command))) {
    errors.push("publicScopeConfirmation.commandsは文字列配列である必要があります");
  } else if (new Set(confirmation.commands).size !== confirmation.commands.length) {
    errors.push("publicScopeConfirmation.commandsが重複しています");
  }
  for (const key of ["confirmedByCode", "confirmedAt", "artifact"]) {
    if (confirmation[key] !== null && !hasText(confirmation[key])) {
      errors.push(`publicScopeConfirmation.${key}はnullまたは文字列です`);
    }
  }
  if (evidenceById(status, "SRG09")?.status === "PASS" && !hasPublicScopeConfirmation(status)) {
    errors.push("SRG09のPASSには対象commitの自動監査とリポジトリ所有者の公開範囲確認が必要です");
  }
}

function validateIssues(status, errors) {
  if (!Array.isArray(status.issues)) {
    errors.push("issuesは配列である必要があります");
    return;
  }
  const ids = status.issues.map((issue) => issue?.id);
  if (new Set(ids).size !== ids.length) errors.push("問題IDが重複しています");
  for (const issue of status.issues) {
    if (!hasText(issue?.id)) errors.push("問題IDが必要です");
    if (!ISSUE_SEVERITIES.has(issue?.severity)) {
      errors.push(`${issue?.id || "issue"}: severityが不正です`);
    }
    if (!ISSUE_STATES.has(issue?.status)) {
      errors.push(`${issue?.id || "issue"}: statusが不正です`);
    }
    if (issue?.status === "OPEN" && issue?.severity === "P2") {
      if (!hasText(issue.owner)) errors.push(`${issue.id}: 未解決P2にownerが必要です`);
      if (!isDate(issue.due)) errors.push(`${issue.id}: 未解決P2にdueが必要です`);
      if (!hasText(issue.retest)) errors.push(`${issue.id}: 未解決P2にretestが必要です`);
    }
  }
}

export function validateStanReleaseStatus(status) {
  const errors = [];
  if (!isRecord(status)) return ["ルートはobjectである必要があります"];
  if (status.schemaVersion !== 2) errors.push("schemaVersionは2である必要があります");
  if (!/^SRG-[A-Z0-9-]+$/.test(status.gateId || "")) {
    errors.push("gateIdはSRG-で始まる必要があります");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(status.updatedAt || "")) {
    errors.push("updatedAtはYYYY-MM-DDで記録します");
  }
  if (!DECISIONS.has(status.decision)) errors.push("decisionが未対応です");
  if (!hasText(status.primaryImplementerCode)) errors.push("primaryImplementerCodeが必要です");

  validateEvidence(status, errors);

  if (
    !isRecord(status.foundationGate) ||
    !DECISIONS.has(status.foundationGate?.decision) ||
    (status.foundationGate.artifact !== null && !hasText(status.foundationGate.artifact))
  ) {
    errors.push("foundationGateのdecisionとartifactが必要です");
  }
  if (evidenceById(status, "SRG01")?.status === "PASS" && !hasFoundationPass(status)) {
    errors.push("SRG01のPASSにはFoundation GateのPASSと証拠リンクが必要です");
  }

  validateStaticVerification(status, errors);
  validateCleanCi(status, errors);
  validateRuntimeComparison(status, errors);
  validateExistingRuntimeRevalidation(status, errors);
  validateExternalFeedback(status, errors);
  validateLearnerObservation(status, errors);
  validateDelayedRetention(status, errors);
  validatePublicScopeConfirmation(status, errors);
  validateIssues(status, errors);

  if (evidenceById(status, "SRG10")?.status === "PASS" && !hasText(status.decisionRecord)) {
    errors.push("SRG10のPASSには最終判断記録が必要です");
  }

  const derived = deriveStanReleaseDecision(status);
  if (DECISIONS.has(status.decision) && status.decision !== derived) {
    errors.push(`decisionは${derived}である必要があります（宣言: ${status.decision}）`);
  }
  if (status.decision === "PASS") {
    if (!hasFinalTarget(status)) errors.push("PASSには40桁commit SHAとHTTPS URLが必要です");
    if (!hasStaticVerification(status)) errors.push("PASSには対象commitのStan静的検証が必要です");
    if (!hasCleanCi(status)) errors.push("PASSには対象commitのクリーンCIが必要です");
    if (!hasExistingRuntimeRevalidation(status)) errors.push("PASSには既存runtime証拠の再検証が必要です");
    if (!hasRuntimeComparison(status)) errors.push("PASSにはL40の弱情報・強情報runtime比較が必要です");
    if (!hasPublicScopeConfirmation(status)) errors.push("PASSには所有者による公開範囲確認が必要です");
    if (!hasText(status.decisionRecord)) errors.push("PASSには最終判断記録が必要です");
  }

  return errors;
}

export function summarizeStanReleaseStatus(status) {
  const count = (ids) => {
    const counts = Object.fromEntries([...EVIDENCE_STATES].map((state) => [state, 0]));
    for (const evidence of status.evidence || []) {
      if (ids.includes(evidence.id) && evidence.status in counts) counts[evidence.status] += 1;
    }
    return counts;
  };
  return {
    decision: deriveStanReleaseDecision(status),
    requiredEvidence: count(REQUIRED_STAN_RELEASE_EVIDENCE_IDS),
    advisoryEvidence: count(ADVISORY_STAN_EVIDENCE_IDS),
    foundation: status.foundationGate?.decision || "UNKNOWN",
    learners: status.learnerObservation?.eligibleComplete || 0,
    delayed: status.delayedRetention?.eligibleComplete || 0,
    openIssues: (status.issues || []).filter((issue) => issue.status === "OPEN").length,
  };
}

export function loadStanReleaseStatus(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runCli() {
  const args = process.argv.slice(2);
  const requirePass = args.includes("--require-pass");
  const pathArg = args.find((arg) => !arg.startsWith("--"));
  const path = resolve(pathArg || "quality/stan-release-gate/status.json");
  let status;
  try {
    status = loadStanReleaseStatus(path);
  } catch (error) {
    console.error(`Stan Release Gate状態を読めません: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const errors = validateStanReleaseStatus(status);
  if (errors.length > 0) {
    console.error("Stan Release Gate状態が不正です:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 2;
    return;
  }

  const summary = summarizeStanReleaseStatus(status);
  console.log(`Stan Release Gate: ${summary.decision}`);
  console.log(
    `Required: PASS ${summary.requiredEvidence.PASS}/${REQUIRED_STAN_RELEASE_EVIDENCE_IDS.length}, ` +
    `FAIL ${summary.requiredEvidence.FAIL}, BLOCKED ${summary.requiredEvidence.BLOCKED}, ` +
    `NOT RUN ${summary.requiredEvidence["NOT RUN"]}`,
  );
  console.log(
    `Advisory: PASS ${summary.advisoryEvidence.PASS}/${ADVISORY_STAN_EVIDENCE_IDS.length}, ` +
    `RECORDED ${summary.advisoryEvidence.RECORDED}, FAIL ${summary.advisoryEvidence.FAIL}, ` +
    `BLOCKED ${summary.advisoryEvidence.BLOCKED}, NOT RUN ${summary.advisoryEvidence["NOT RUN"]}`,
  );
  console.log(
    `Foundation: ${summary.foundation}, learners: ${summary.learners}/3, ` +
    `delayed retention: ${summary.delayed}/3, open issues: ${summary.openIssues}`,
  );
  if (requirePass && summary.decision !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
