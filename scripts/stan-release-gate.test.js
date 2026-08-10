import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  FEEDBACK_SCOPES,
  REQUIRED_STAN_CI_JOBS,
  REQUIRED_STAN_RELEASE_EVIDENCE_IDS,
  REQUIRED_STAN_STATIC_COMMANDS,
  REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS,
  STAN_RELEASE_EVIDENCE_IDS,
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
  status.publicScopeConfirmation = {
    confirmedByCode: "OWNER-01",
    confirmedAt: "2026-08-21T10:00:00+09:00",
    commit: status.target.commit,
    commands: [...REQUIRED_STAN_PUBLIC_SCOPE_COMMANDS],
    artifact: "evidence/SRG-TEST/public-scope.md",
    secretScan: "PASS",
    personalDataScan: "PASS",
    appScopeConfirmed: "PASS",
  };
  status.decisionRecord = "evidence/SRG-TEST/decision.md";
  status.evidence = STAN_RELEASE_EVIDENCE_IDS.map((id) => ({
    id,
    status: REQUIRED_STAN_RELEASE_EVIDENCE_IDS.includes(id) ? "PASS" : "NOT RUN",
    artifacts: REQUIRED_STAN_RELEASE_EVIDENCE_IDS.includes(id)
      ? [`evidence/SRG-TEST/${id}.md`]
      : [],
    note: REQUIRED_STAN_RELEASE_EVIDENCE_IDS.includes(id)
      ? `${id}を対象commitで確認済み`
      : `${id}は任意の改善証拠として未実施`,
  }));
  status.externalFeedback = {
    status: "NOT RUN",
    receivedAt: null,
    contributorProfile: null,
    scopes: [],
    summaryArtifact: null,
  };
  status.issues = [];
  return status;
}

describe("Stan Release Gateの機械判定", () => {
  it("現在状態を正当なPASSとして読み取る", () => {
    expect(validateStanReleaseStatus(current)).toEqual([]);
    expect(deriveStanReleaseDecision(current)).toBe("PASS");
  });

  it("現在のSRG02証拠を対象commitと必須コマンドへ固定する", () => {
    const artifactPath = join(root, current.staticVerification.artifact);
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

    expect(artifact.evidenceId).toBe("SRG02");
    expect(artifact.targetCommit).toBe(current.target.commit);
    expect(artifact.targetUrl).toBe(current.target.url);
    expect(artifact.commands.map(({ command }) => command)).toEqual(REQUIRED_STAN_STATIC_COMMANDS);
    expect(artifact.commands.every(({ status }) => status === "PASS")).toBe(true);
  });

  it("対象と所有者判断なしのPASS宣言を拒否する", () => {
    const dishonest = structuredClone(current);
    dishonest.decision = "PASS";
    dishonest.target.commit = null;
    dishonest.publicScopeConfirmation.confirmedByCode = null;
    dishonest.decisionRecord = null;
    const errors = validateStanReleaseStatus(dishonest).join("\n");
    expect(errors).toContain("decisionはBLOCKED");
    expect(errors).toContain("40桁commit SHA");
    expect(errors).toContain("所有者による公開範囲確認");
    expect(errors).toContain("最終判断記録");
  });

  it("SRG01〜SRG10の欠落・重複・未知IDを拒否する", () => {
    const missing = structuredClone(current);
    missing.evidence.pop();
    expect(validateStanReleaseStatus(missing).join("\n")).toContain("evidenceがありません");

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
    expect(errors).toContain("SRG02: PASS・RECORDEDには公開可能な証拠リンク");
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

  it("必須6証拠が揃えば改善証拠が未実施でもPASSにする", () => {
    const status = passingStatus();
    expect(validateStanReleaseStatus(status)).toEqual([]);
    expect(deriveStanReleaseDecision(status)).toBe("PASS");
    expect(status.foundationGate.decision).toBe("BLOCKED");
    expect(status.learnerObservation.eligibleComplete).toBe(0);
    expect(status.delayedRetention.eligibleComplete).toBe(0);
  });

  it("Foundation Gateは改善証拠として記録するが未完了でも公開を止めない", () => {
    const status = passingStatus();
    status.foundationGate.decision = "BLOCKED";
    status.evidence[0].status = "NOT RUN";
    expect(validateStanReleaseStatus(status)).toEqual([]);
    expect(deriveStanReleaseDecision(status)).toBe("PASS");
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

  it("口頭を含む第三者感想は短い要約として任意記録できる", () => {
    const recorded = passingStatus();
    recorded.externalFeedback = {
      status: "RECORDED",
      receivedAt: "2026-08-20",
      contributorProfile: "Stanを利用した経験のある教育関係者",
      scopes: [FEEDBACK_SCOPES[0]],
      summaryArtifact: "quality/stan-release-gate/feedback/example.md",
    };
    recorded.evidence.find(({ id }) => id === "SRG06").status = "RECORDED";
    recorded.evidence.find(({ id }) => id === "SRG06").artifacts = [recorded.externalFeedback.summaryArtifact];
    expect(validateStanReleaseStatus(recorded)).toEqual([]);
    expect(deriveStanReleaseDecision(recorded)).toBe("PASS");

    const missingSummary = structuredClone(recorded);
    missingSummary.externalFeedback.summaryArtifact = null;
    expect(validateStanReleaseStatus(missingSummary).join("\n")).toContain("短い要約artifact");

    const mismatched = structuredClone(recorded);
    mismatched.evidence.find(({ id }) => id === "SRG06").status = "NOT RUN";
    expect(validateStanReleaseStatus(mismatched).join("\n")).toContain("状態をNOT RUNまたはRECORDEDで一致");
  });

  it("初学者記録の重複と7〜14日外の保持記録を拒否する", () => {
    const duplicate = passingStatus();
    duplicate.learnerObservation = {
      eligibleComplete: 3,
      records: ["feedback/P01.md", "feedback/P02.md", "feedback/P02.md"],
    };
    expect(validateStanReleaseStatus(duplicate).join("\n")).toContain("初学者観察記録が重複");

    const tooEarly = passingStatus();
    tooEarly.delayedRetention = {
      minimumDays: 7,
      maximumDays: 14,
      eligibleComplete: 1,
      records: [{ artifact: "feedback/sr41d-P01.md", daysAfter: 6 }],
    };
    expect(validateStanReleaseStatus(tooEarly).join("\n")).toContain("7〜14日のdaysAfter");
  });

  it("SRG09は対象commitの自動監査と所有者確認を要求する", () => {
    const wrongCommit = passingStatus();
    wrongCommit.decision = "BLOCKED";
    wrongCommit.publicScopeConfirmation.commit = "d".repeat(40);
    expect(validateStanReleaseStatus(wrongCommit).join("\n")).toContain("SRG09のPASS");
    expect(deriveStanReleaseDecision(wrongCommit)).toBe("BLOCKED");

    const missingCommand = passingStatus();
    missingCommand.decision = "BLOCKED";
    missingCommand.publicScopeConfirmation.commands.pop();
    expect(validateStanReleaseStatus(missingCommand).join("\n")).toContain("対象commitの自動監査");

    const ownerConfirmation = passingStatus();
    ownerConfirmation.publicScopeConfirmation.confirmedByCode = ownerConfirmation.primaryImplementerCode;
    expect(validateStanReleaseStatus(ownerConfirmation)).toEqual([]);
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

  it("CLIはPASS 6/6と記録済みフィードバックを報告し、require-passも成功する", () => {
    const report = spawnSync(process.execPath, [scriptPath, statusPath], { encoding: "utf8" });
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("Stan Release Gate: PASS");
    expect(report.stdout).toContain("Required: PASS 6/6");
    expect(report.stdout).toContain("Advisory: PASS 0/4, RECORDED 1");
    expect(report.stdout).toContain("learners: 0/3");
    expect(report.stdout).toContain("delayed retention: 0/3");

    const gate = spawnSync(
      process.execPath,
      [scriptPath, statusPath, "--require-pass"],
      { encoding: "utf8" },
    );
    expect(gate.status).toBe(0);
    expect(gate.stdout).toContain("Stan Release Gate: PASS");
    expect(gate.stdout).toContain("Foundation: BLOCKED");
  });
});
