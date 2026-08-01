import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_TRANSFER_EVIDENCE_IDS,
  deriveTransferGateDecision,
  validateTransferGateStatus,
} from "./step1-transfer-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statusPath = join(root, "quality", "step1-transfer-gate", "status.json");
const scriptPath = join(root, "scripts", "step1-transfer-gate.mjs");
const current = JSON.parse(readFileSync(statusPath, "utf8"));

function observedStatus() {
  const status = structuredClone(current);
  status.gateId = "STR-TEST-OBSERVED";
  status.decision = "OBSERVED";
  status.target.commit = "b".repeat(40);
  status.participants = {
    eligibleComplete: 3,
    records: ["evidence/STR-TEST/learner-P01.md", "evidence/STR-TEST/learner-P02.md", "evidence/STR-TEST/learner-P03.md"],
    blockedSessions: 0,
    invalidSessions: 0,
  };
  status.independentReview = {
    reviewerCode: "REVIEWER-01",
    signedAt: "2026-08-03T09:00:00+09:00",
  };
  status.decisionRecord = "evidence/STR-TEST/decision.md";
  status.evidence = REQUIRED_TRANSFER_EVIDENCE_IDS.map((id) => ({
    id,
    status: "OBSERVED",
    artifacts: [`evidence/STR-TEST/${id}.md`],
    note: `${id}の匿名観察証拠を独立確認済み`,
  }));
  return status;
}

describe("STEP 1独立転移観察の機械判定", () => {
  it("現在状態を正当なNOT RUNとして読み取る", () => {
    expect(validateTransferGateStatus(current)).toEqual([]);
    expect(deriveTransferGateDecision(current)).toBe("NOT RUN");
  });

  it("必須TR証拠の欠落・重複と参加者件数の不一致を拒否する", () => {
    const missing = structuredClone(current);
    missing.evidence.pop();
    expect(validateTransferGateStatus(missing).join("\n")).toContain("必須evidence");

    const duplicate = structuredClone(current);
    duplicate.evidence[1].id = duplicate.evidence[0].id;
    expect(validateTransferGateStatus(duplicate).join("\n")).toContain("重複");

    const countMismatch = structuredClone(current);
    countMismatch.participants.eligibleComplete = 1;
    expect(validateTransferGateStatus(countMismatch).join("\n")).toContain("records件数");
  });

  it("匿名証拠なしのOBSERVED宣言を拒否する", () => {
    const dishonest = structuredClone(current);
    dishonest.decision = "OBSERVED";
    const errors = validateTransferGateStatus(dishonest).join("\n");

    expect(errors).toContain("decisionはNOT RUN");
    expect(errors).toContain("40桁commit SHA");
    expect(errors).toContain("匿名観察記録3件以上");
    expect(errors).toContain("独立レビュー署名");
    expect(errors).toContain("コホート判断記録");
  });

  it("3名・TR01〜TR05・対象SHA・判断票・独立レビューが揃った場合だけOBSERVEDにする", () => {
    const status = observedStatus();
    expect(validateTransferGateStatus(status)).toEqual([]);
    expect(deriveTransferGateDecision(status)).toBe("OBSERVED");

    status.independentReview.reviewerCode = status.primaryImplementerCode;
    expect(deriveTransferGateDecision(status)).toBe("BLOCKED");
    expect(validateTransferGateStatus(status).join("\n")).toContain("decisionはBLOCKED");
  });

  it("未解決P1はOBSERVEDをBLOCKEDへ戻し、未解決P2には管理情報を要求する", () => {
    const p1 = observedStatus();
    p1.decision = "BLOCKED";
    p1.issues.push({ id: "STR-ISSUE-1", severity: "P1", status: "OPEN" });
    expect(validateTransferGateStatus(p1)).toEqual([]);
    expect(deriveTransferGateDecision(p1)).toBe("BLOCKED");

    const p2 = observedStatus();
    p2.decision = "BLOCKED";
    p2.issues.push({ id: "STR-ISSUE-2", severity: "P2", status: "OPEN" });
    const errors = validateTransferGateStatus(p2).join("\n");
    expect(errors).toContain("owner");
    expect(errors).toContain("due");
    expect(errors).toContain("retest");
  });

  it("プロトコル汚染は理由付きINVALIDとし、通常の未完了と分ける", () => {
    const invalid = structuredClone(current);
    invalid.decision = "INVALID";
    invalid.protocolValidity.invalid = true;
    invalid.protocolValidity.reason = "初回提出前に自己チェッカーが露出した";
    invalid.participants.invalidSessions = 1;
    expect(validateTransferGateStatus(invalid)).toEqual([]);
    expect(deriveTransferGateDecision(invalid)).toBe("INVALID");

    invalid.protocolValidity.reason = null;
    expect(validateTransferGateStatus(invalid).join("\n")).toContain("reason");
  });

  it("status CLIはNOT RUNを報告し、--require-observedだけを失敗終了する", () => {
    const report = spawnSync(process.execPath, [scriptPath, statusPath], { encoding: "utf8" });
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("STEP 1 Transfer Observation: NOT RUN");
    expect(report.stdout).toContain("valid 0/3");

    const gate = spawnSync(process.execPath, [scriptPath, statusPath, "--require-observed"], { encoding: "utf8" });
    expect(gate.status).toBe(1);
    expect(gate.stdout).toContain("OBSERVED 0/5");
  });
});
