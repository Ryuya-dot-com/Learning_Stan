import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_EVIDENCE_IDS,
  deriveGateDecision,
  validateGateStatus,
} from "./foundation-gate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statusPath = join(root, "quality", "foundation-gate", "status.json");
const scriptPath = join(root, "scripts", "foundation-gate.mjs");
const current = JSON.parse(readFileSync(statusPath, "utf8"));

function passingStatus() {
  const status = structuredClone(current);
  status.gateId = "FG-TEST-PASS";
  status.decision = "PASS";
  status.target.commit = "a".repeat(40);
  status.participants = {
    eligibleComplete: 3,
    records: ["P01", "P02", "P03"],
  };
  status.accessibility.records = ["A11Y-WIN", "A11Y-MAC", "A11Y-MOBILE"];
  status.independentReview = {
    reviewerCode: "REVIEWER-01",
    signedAt: "2026-08-02T09:00:00+09:00",
  };
  status.evidence = REQUIRED_EVIDENCE_IDS.map((id) => ({
    id,
    status: "PASS",
    artifacts: [`quality/foundation-gate/evidence/FG-TEST-PASS/${id}.md`],
    note: `${id}の証拠を独立確認済み`,
  }));
  return status;
}

describe("Foundation Gate機械判定", () => {
  it("現在状態を正当なBLOCKEDとして読み取る", () => {
    expect(validateGateStatus(current)).toEqual([]);
    expect(deriveGateDecision(current)).toBe("BLOCKED");
  });

  it("必須証拠の欠落と重複を拒否する", () => {
    const missing = structuredClone(current);
    missing.evidence.pop();
    expect(validateGateStatus(missing).join("\n")).toContain("必須evidence");

    const duplicate = structuredClone(current);
    duplicate.evidence[1].id = duplicate.evidence[0].id;
    expect(validateGateStatus(duplicate).join("\n")).toContain("重複");
  });

  it("壊れた配列を例外終了せず検証エラーとして返す", () => {
    const broken = structuredClone(current);
    broken.evidence[0].status = "PASS";
    broken.evidence[0].artifacts = null;
    broken.issues = {};

    expect(() => validateGateStatus(broken)).not.toThrow();
    const errors = validateGateStatus(broken).join("\n");
    expect(errors).toContain("artifactsは文字列配列");
    expect(errors).toContain("issuesは配列");
  });

  it("証拠なしのPASS宣言を拒否する", () => {
    const dishonest = structuredClone(current);
    dishonest.decision = "PASS";
    const errors = validateGateStatus(dishonest).join("\n");

    expect(errors).toContain("decisionはBLOCKED");
    expect(errors).toContain("40桁commit SHA");
    expect(errors).toContain("完走記録3件以上");
    expect(errors).toContain("必須実機監査");
    expect(errors).toContain("独立レビュー署名");
  });

  it("証拠FAILまたは未解決P1が1件でもあればFAILにする", () => {
    const evidenceFailure = structuredClone(current);
    evidenceFailure.evidence[0].status = "FAIL";
    evidenceFailure.decision = "FAIL";
    expect(validateGateStatus(evidenceFailure)).toEqual([]);
    expect(deriveGateDecision(evidenceFailure)).toBe("FAIL");

    const issueFailure = passingStatus();
    issueFailure.decision = "FAIL";
    issueFailure.issues.push({ id: "ISSUE-1", severity: "P1", status: "OPEN" });
    expect(validateGateStatus(issueFailure)).toEqual([]);
    expect(deriveGateDecision(issueFailure)).toBe("FAIL");
  });

  it("未解決P2には所有者・期限・再検証条件を要求する", () => {
    const status = passingStatus();
    status.decision = "BLOCKED";
    status.issues.push({ id: "ISSUE-2", severity: "P2", status: "OPEN" });
    const errors = validateGateStatus(status).join("\n");
    expect(errors).toContain("owner");
    expect(errors).toContain("due");
    expect(errors).toContain("retest");

    status.decision = "PASS";
    Object.assign(status.issues[0], {
      owner: "OWNER-01",
      due: "2026-08-15",
      retest: "修正後に該当経路を再実行する",
    });
    expect(validateGateStatus(status)).toEqual([]);
  });

  it("全証拠・3名・3実機構成・独立レビューが揃った場合だけPASSにする", () => {
    const status = passingStatus();
    expect(validateGateStatus(status)).toEqual([]);
    expect(deriveGateDecision(status)).toBe("PASS");

    status.independentReview.reviewerCode = status.primaryImplementerCode;
    expect(deriveGateDecision(status)).toBe("BLOCKED");
    expect(validateGateStatus(status).join("\n")).toContain("decisionはBLOCKED");
  });

  it("status CLIはBLOCKEDを報告し、--require-passだけを失敗終了する", () => {
    const report = spawnSync(process.execPath, [scriptPath, statusPath], { encoding: "utf8" });
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("Foundation Gate: BLOCKED");

    const gate = spawnSync(process.execPath, [scriptPath, statusPath, "--require-pass"], { encoding: "utf8" });
    expect(gate.status).toBe(1);
    expect(gate.stdout).toContain("PASS 0/14");
  });
});
