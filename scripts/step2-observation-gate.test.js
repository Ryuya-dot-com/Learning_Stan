import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_STEP2_EVIDENCE_IDS,
  deriveStep2ObservationDecision,
  validateStep2ObservationStatus,
} from "./step2-observation-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statusPath = join(root, "quality", "step2-observation-gate", "status.json");
const scriptPath = join(root, "scripts", "step2-observation-gate.mjs");
const current = JSON.parse(readFileSync(statusPath, "utf8"));

function observedStatus() {
  const status = structuredClone(current);
  status.gateId = "S2O-TEST-OBSERVED";
  status.decision = "OBSERVED";
  status.target.commit = "c".repeat(40);
  status.participants = {
    eligibleComplete: 3,
    records: [
      "evidence/S2O-TEST/learner-P01.md",
      "evidence/S2O-TEST/learner-P02.md",
      "evidence/S2O-TEST/learner-P03.md",
    ],
    blockedSessions: 0,
    invalidSessions: 0,
  };
  status.independentReview = {
    reviewerCode: "REVIEWER-02",
    signedAt: "2026-08-04T09:00:00+09:00",
  };
  status.decisionRecord = "evidence/S2O-TEST/decision.md";
  status.evidence = REQUIRED_STEP2_EVIDENCE_IDS.map((id) => ({
    id,
    status: "OBSERVED",
    artifacts: [`evidence/S2O-TEST/${id}.md`],
    note: `${id}の匿名観察証拠を独立確認済み`,
  }));
  return status;
}

describe("STEP 2初心者観察の機械判定", () => {
  it("現在状態を正当なNOT RUNとして読み取る", () => {
    expect(validateStep2ObservationStatus(current)).toEqual([]);
    expect(deriveStep2ObservationDecision(current)).toBe("NOT RUN");
  });

  it("S201〜S205の欠落・重複と参加者件数不一致を拒否する", () => {
    const missing = structuredClone(current);
    missing.evidence.pop();
    expect(validateStep2ObservationStatus(missing).join("\n")).toContain("必須evidence");

    const duplicate = structuredClone(current);
    duplicate.evidence[1].id = duplicate.evidence[0].id;
    expect(validateStep2ObservationStatus(duplicate).join("\n")).toContain("重複");

    const countMismatch = structuredClone(current);
    countMismatch.participants.eligibleComplete = 1;
    expect(validateStep2ObservationStatus(countMismatch).join("\n")).toContain("records件数");
  });

  it("匿名証拠なしのOBSERVED宣言を拒否する", () => {
    const dishonest = structuredClone(current);
    dishonest.decision = "OBSERVED";
    const errors = validateStep2ObservationStatus(dishonest).join("\n");
    expect(errors).toContain("decisionはNOT RUN");
    expect(errors).toContain("40桁commit SHA");
    expect(errors).toContain("匿名観察記録3件以上");
    expect(errors).toContain("独立レビュー署名");
    expect(errors).toContain("コホート判断記録");
  });

  it("3名・5タスク・対象SHA・判断票・独立レビューが揃った場合だけOBSERVEDにする", () => {
    const status = observedStatus();
    expect(validateStep2ObservationStatus(status)).toEqual([]);
    expect(deriveStep2ObservationDecision(status)).toBe("OBSERVED");

    status.independentReview.reviewerCode = status.primaryImplementerCode;
    expect(deriveStep2ObservationDecision(status)).toBe("BLOCKED");
    expect(validateStep2ObservationStatus(status).join("\n")).toContain("decisionはBLOCKED");
  });

  it("未解決P1はBLOCKEDへ戻し、未解決P2には管理情報を要求する", () => {
    const p1 = observedStatus();
    p1.decision = "BLOCKED";
    p1.issues.push({ id: "S2O-ISSUE-1", severity: "P1", status: "OPEN" });
    expect(validateStep2ObservationStatus(p1)).toEqual([]);
    expect(deriveStep2ObservationDecision(p1)).toBe("BLOCKED");

    const p2 = observedStatus();
    p2.decision = "BLOCKED";
    p2.issues.push({ id: "S2O-ISSUE-2", severity: "P2", status: "OPEN" });
    const errors = validateStep2ObservationStatus(p2).join("\n");
    expect(errors).toContain("owner");
    expect(errors).toContain("due");
    expect(errors).toContain("retest");
  });

  it("プロトコル汚染は理由付きINVALIDにする", () => {
    const invalid = structuredClone(current);
    invalid.decision = "INVALID";
    invalid.protocolValidity.invalid = true;
    invalid.protocolValidity.reason = "初回提出前にL20完成コードが露出した";
    invalid.participants.invalidSessions = 1;
    expect(validateStep2ObservationStatus(invalid)).toEqual([]);
    expect(deriveStep2ObservationDecision(invalid)).toBe("INVALID");

    invalid.protocolValidity.reason = null;
    expect(validateStep2ObservationStatus(invalid).join("\n")).toContain("reason");
  });

  it("CLIはNOT RUNを報告し、require-observedだけを失敗終了する", () => {
    const report = spawnSync(process.execPath, [scriptPath, statusPath], { encoding: "utf8" });
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("STEP 2 Learning Observation: NOT RUN");
    expect(report.stdout).toContain("valid 0/3");

    const gate = spawnSync(
      process.execPath,
      [scriptPath, statusPath, "--require-observed"],
      { encoding: "utf8" },
    );
    expect(gate.status).toBe(1);
    expect(gate.stdout).toContain("OBSERVED 0/5");
  });
});
