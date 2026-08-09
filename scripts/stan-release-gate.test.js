import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_STAN_CI_JOBS,
  REQUIRED_REVIEW_SCOPES,
  REQUIRED_STAN_RELEASE_EVIDENCE_IDS,
  REQUIRED_STAN_STATIC_COMMANDS,
  REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS,
  deriveStanReleaseDecision,
  validateStanReleaseStatus,
} from "./stan-release-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statusPath = join(root, "quality", "stan-release-gate", "status.json");
const scriptPath = join(root, "scripts", "stan-release-gate.mjs");
const current = JSON.parse(readFileSync(statusPath, "utf8"));

function passingStatus() {
  const status = structuredClone(current);
  status.gateId = "SRG-TEST-PASS";
  status.decision = "PASS";
  status.target.commit = "c".repeat(40);
  status.target.url = "https://example.test/Learning_Stan/commit/candidate";
  status.foundationGate = {
    decision: "PASS",
    artifact: "evidence/SRG-TEST/foundation-gate.json",
  };
  status.staticVerification = {
    status: "PASS",
    commit: status.target.commit,
    commands: [...REQUIRED_STAN_STATIC_COMMANDS],
    artifact: "evidence/SRG-TEST/static-verification.json",
  };
  status.cleanCi = {
    status: "PASS",
    commit: status.target.commit,
    runUrl: "https://github.com/example/Learning_Stan/actions/runs/123456",
    event: "pull_request",
    jobs: Object.fromEntries(REQUIRED_STAN_CI_JOBS.map((job) => [job, "PASS"])),
  };
  status.runtimeComparison = {
    weakInformation: {
      status: "PASS",
      scenarioId: "weak-groups-v1",
      artifact: "evidence/SRG-TEST/l40-weak-runtime.json",
    },
    strongInformation: {
      status: "PASS",
      scenarioId: "strong-groups-v1",
      artifact: "evidence/SRG-TEST/l40-strong-runtime.json",
    },
    sourceHashes: {
      centered: "a".repeat(64),
      noncentered: "b".repeat(64),
    },
    environment: {
      rVersion: "4.6.1",
      cmdstanrVersion: "0.9.0",
      cmdstanVersion: "2.39.0",
    },
    diagnostics: {
      chains: 4,
      divergenceChecked: true,
      treedepthChecked: true,
      ebfmiChecked: true,
      rhatChecked: true,
      essChecked: true,
      mcseChecked: true,
      timingChecked: true,
      posteriorEquivalenceChecked: true,
    },
  };
  status.independentReview = {
    reviewerCode: "STAN-REVIEWER-02",
    signedAt: "2026-08-20T10:00:00+09:00",
    scopes: [...REQUIRED_REVIEW_SCOPES],
  };
  status.learnerObservation = {
    eligibleComplete: 3,
    records: [
      "evidence/SRG-TEST/learner-P01.md",
      "evidence/SRG-TEST/learner-P02.md",
      "evidence/SRG-TEST/learner-P03.md",
    ],
  };
  status.delayedRetention = {
    minimumDays: 7,
    maximumDays: 14,
    eligibleComplete: 3,
    records: [
      { artifact: "evidence/SRG-TEST/sr41d-P01.md", daysAfter: 7 },
      { artifact: "evidence/SRG-TEST/sr41d-P02.md", daysAfter: 10 },
      { artifact: "evidence/SRG-TEST/sr41d-P03.md", daysAfter: 14 },
    ],
  };
  status.publicScopeReview = {
    reviewerCode: "RELEASE-02",
    signedAt: "2026-08-21T10:00:00+09:00",
    commit: status.target.commit,
    commands: [...REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS],
    artifact: "evidence/SRG-TEST/public-scope.md",
    secretScan: "PASS",
    personalDataScan: "PASS",
    appScopeConfirmed: "PASS",
  };
  status.decisionRecord = "evidence/SRG-TEST/decision.md";
  status.evidence = REQUIRED_STAN_RELEASE_EVIDENCE_IDS.map((id) => ({
    id,
    status: "PASS",
    artifacts: [`evidence/SRG-TEST/${id}.md`],
    note: `${id}を対象commitで確認済み`,
  }));
  status.issues = [];
  return status;
}

describe("Stan Release Gateの機械判定", () => {
  it("現在状態を正当なBLOCKEDとして読み取る", () => {
    expect(validateStanReleaseStatus(current)).toEqual([]);
    expect(deriveStanReleaseDecision(current)).toBe("BLOCKED");
  });

  it("残る付帯証拠なしのPASS宣言を拒否する", () => {
    const dishonest = structuredClone(current);
    dishonest.decision = "PASS";
    const errors = validateStanReleaseStatus(dishonest).join("\n");
    expect(errors).toContain("decisionはBLOCKED");
    expect(errors).toContain("40桁commit SHA");
    expect(errors).toContain("独立レビュー");
    expect(errors).toContain("初学者観察3件以上");
    expect(errors).toContain("保持記録3件以上");
  });

  it("SRG01〜SRG10の欠落・重複・未知IDを拒否する", () => {
    const missing = structuredClone(current);
    missing.evidence.pop();
    expect(validateStanReleaseStatus(missing).join("\n")).toContain("必須evidence");

    const duplicate = structuredClone(current);
    duplicate.evidence[1].id = duplicate.evidence[0].id;
    expect(validateStanReleaseStatus(duplicate).join("\n")).toContain("重複");

    const unknown = structuredClone(current);
    unknown.evidence[0].id = "SRG99";
    expect(validateStanReleaseStatus(unknown).join("\n")).toContain("未知のevidence");
  });

  it("PASS証拠にはartifactを要求する", () => {
    const status = passingStatus();
    status.decision = "BLOCKED";
    status.evidence[1].artifacts = [];
    const errors = validateStanReleaseStatus(status).join("\n");
    expect(errors).toContain("SRG02: PASSには匿名化された証拠リンク");
  });

  it("SRG02は対象commitと必須静的検証コマンドの一致を要求する", () => {
    const wrongCommit = passingStatus();
    wrongCommit.decision = "BLOCKED";
    wrongCommit.staticVerification.commit = "d".repeat(40);
    expect(validateStanReleaseStatus(wrongCommit).join("\n")).toContain("SRG02のPASS");
    expect(deriveStanReleaseDecision(wrongCommit)).toBe("BLOCKED");

    const missingCommand = passingStatus();
    missingCommand.decision = "BLOCKED";
    missingCommand.staticVerification.commands.pop();
    expect(validateStanReleaseStatus(missingCommand).join("\n")).toContain("必須静的検証コマンド");
  });

  it("SRG03は対象commitのGitHub runとNode・R・Stan全job成功を要求する", () => {
    const wrongCommit = passingStatus();
    wrongCommit.decision = "BLOCKED";
    wrongCommit.cleanCi.commit = "d".repeat(40);
    expect(validateStanReleaseStatus(wrongCommit).join("\n")).toContain("SRG03のPASS");
    expect(deriveStanReleaseDecision(wrongCommit)).toBe("BLOCKED");

    const failedStan = passingStatus();
    failedStan.decision = "BLOCKED";
    failedStan.cleanCi.jobs["stan-verify"] = "FAIL";
    expect(validateStanReleaseStatus(failedStan).join("\n")).toContain("Node・R・Stan各job");
  });

  it("全10証拠と付帯条件が揃った場合だけPASSにする", () => {
    const status = passingStatus();
    expect(validateStanReleaseStatus(status)).toEqual([]);
    expect(deriveStanReleaseDecision(status)).toBe("PASS");
  });

  it("Foundation Gateの宣言だけを偽装できない", () => {
    const status = passingStatus();
    status.decision = "BLOCKED";
    status.foundationGate.decision = "BLOCKED";
    const errors = validateStanReleaseStatus(status).join("\n");
    expect(deriveStanReleaseDecision(status)).toBe("BLOCKED");
    expect(errors).toContain("SRG01のPASSにはFoundation GateのPASS");
  });

  it("L40は弱情報・強情報、4 chain、全診断、異なるsource hashを要求する", () => {
    const missingScenario = passingStatus();
    missingScenario.decision = "BLOCKED";
    missingScenario.runtimeComparison.strongInformation.status = "NOT RUN";
    expect(validateStanReleaseStatus(missingScenario).join("\n")).toContain("SRG05のPASS");

    const oneChain = passingStatus();
    oneChain.decision = "BLOCKED";
    oneChain.runtimeComparison.diagnostics.chains = 1;
    expect(deriveStanReleaseDecision(oneChain)).toBe("BLOCKED");

    const sameHash = passingStatus();
    sameHash.decision = "BLOCKED";
    sameHash.runtimeComparison.sourceHashes.noncentered = "a".repeat(64);
    expect(validateStanReleaseStatus(sameHash).join("\n")).toContain("SRG05のPASS");
  });

  it("SRG04は3つの既存runtime、環境、hash、診断、教材結論、成果物を要求する", () => {
    const missingLoo = passingStatus();
    missingLoo.decision = "BLOCKED";
    missingLoo.existingRuntimeRevalidation.scenarios.linkLoo = "NOT RUN";
    expect(validateStanReleaseStatus(missingLoo).join("\n")).toContain("SRG04のPASS");
    expect(deriveStanReleaseDecision(missingLoo)).toBe("BLOCKED");

    const uncheckedHashes = passingStatus();
    uncheckedHashes.decision = "BLOCKED";
    uncheckedHashes.existingRuntimeRevalidation.sourceHashesChecked = false;
    expect(validateStanReleaseStatus(uncheckedHashes).join("\n")).toContain("SRG04のPASS");
  });

  it("自己レビューとscope不足を独立レビューとして扱わない", () => {
    const selfReview = passingStatus();
    selfReview.decision = "BLOCKED";
    selfReview.independentReview.reviewerCode = selfReview.primaryImplementerCode;
    expect(validateStanReleaseStatus(selfReview).join("\n")).toContain("主実装者と異なる独立レビュー");

    const missingScope = passingStatus();
    missingScope.decision = "BLOCKED";
    missingScope.independentReview.scopes.pop();
    expect(deriveStanReleaseDecision(missingScope)).toBe("BLOCKED");
  });

  it("初学者記録の重複と7〜14日外の保持記録を拒否する", () => {
    const duplicate = passingStatus();
    duplicate.decision = "BLOCKED";
    duplicate.learnerObservation.records[2] = duplicate.learnerObservation.records[1];
    expect(validateStanReleaseStatus(duplicate).join("\n")).toContain("初学者観察記録が重複");

    const tooEarly = passingStatus();
    tooEarly.decision = "BLOCKED";
    tooEarly.delayedRetention.records[0].daysAfter = 6;
    expect(validateStanReleaseStatus(tooEarly).join("\n")).toContain("7〜14日のdaysAfter");
  });

  it("SRG09は対象commitの自動監査と主実装者以外の署名を要求する", () => {
    const wrongCommit = passingStatus();
    wrongCommit.decision = "BLOCKED";
    wrongCommit.publicScopeReview.commit = "d".repeat(40);
    expect(validateStanReleaseStatus(wrongCommit).join("\n")).toContain("SRG09のPASS");
    expect(deriveStanReleaseDecision(wrongCommit)).toBe("BLOCKED");

    const missingCommand = passingStatus();
    missingCommand.decision = "BLOCKED";
    missingCommand.publicScopeReview.commands.pop();
    expect(validateStanReleaseStatus(missingCommand).join("\n")).toContain("対象commitの自動監査");

    const selfReview = passingStatus();
    selfReview.decision = "BLOCKED";
    selfReview.publicScopeReview.reviewerCode = selfReview.primaryImplementerCode;
    expect(validateStanReleaseStatus(selfReview).join("\n")).toContain("主実装者以外");
  });

  it("失敗証拠と未解決P1をFAILにし、管理済みP2だけを許容する", () => {
    const failed = passingStatus();
    failed.decision = "FAIL";
    failed.evidence[3].status = "FAIL";
    expect(validateStanReleaseStatus(failed)).toEqual([]);
    expect(deriveStanReleaseDecision(failed)).toBe("FAIL");

    const p1 = passingStatus();
    p1.decision = "FAIL";
    p1.issues.push({ id: "SRG-ISSUE-1", severity: "P1", status: "OPEN" });
    expect(validateStanReleaseStatus(p1)).toEqual([]);
    expect(deriveStanReleaseDecision(p1)).toBe("FAIL");

    const p2 = passingStatus();
    p2.issues.push({
      id: "SRG-ISSUE-2",
      severity: "P2",
      status: "OPEN",
      owner: "OWNER-02",
      due: "2026-09-01",
      retest: "対象レッスンの修正後にSRG07を再確認する",
    });
    expect(validateStanReleaseStatus(p2)).toEqual([]);
    expect(deriveStanReleaseDecision(p2)).toBe("PASS");

    p2.decision = "BLOCKED";
    delete p2.issues[0].owner;
    expect(validateStanReleaseStatus(p2).join("\n")).toContain("owner");
  });

  it("CLIはBLOCKEDを報告し、require-passだけを失敗終了する", () => {
    const report = spawnSync(process.execPath, [scriptPath, statusPath], { encoding: "utf8" });
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("Stan Release Gate: BLOCKED");
    expect(report.stdout).toContain("PASS 2/10");
    expect(report.stdout).toContain("learners: 0/3");
    expect(report.stdout).toContain("delayed retention: 0/3");

    const gate = spawnSync(
      process.execPath,
      [scriptPath, statusPath, "--require-pass"],
      { encoding: "utf8" },
    );
    expect(gate.status).toBe(1);
    expect(gate.stdout).toContain("Foundation: BLOCKED");
  });
});
