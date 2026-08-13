import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  FEEDBACK_CATEGORY_IDS,
  deriveFeedbackStatus,
  validateFeedbackStatus,
} from "./foundation-feedback.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statusPath = join(root, "quality", "foundation-gate", "status.json");
const scriptPath = join(root, "scripts", "foundation-feedback.mjs");
const current = JSON.parse(readFileSync(statusPath, "utf8"));

function recordedStatus() {
  const status = structuredClone(current);
  status.feedbackId = "FF-TEST-RECORDED";
  status.feedbackStatus = "RECORDED";
  status.participants.records = ["feedback/FF-TEST-RECORDED/learner-P01.md"];
  status.evidence = [{
    id: "G09",
    status: "RECORDED",
    artifacts: ["feedback/FF-TEST-RECORDED/G09.md"],
    note: "公開後の匿名化した学習者フィードバックを記録した",
  }];
  return status;
}

describe("Foundation 公開後フィードバックの記録検証", () => {
  it("現在状態を正当な未実施フィードバックとして読み取る", () => {
    expect(validateFeedbackStatus(current)).toEqual([]);
    expect(deriveFeedbackStatus(current)).toBe("NOT RUN");
  });

  it("フィードバック種別は任意で、全カテゴリの実施や参加者数を要求しない", () => {
    const status = recordedStatus();
    expect(validateFeedbackStatus(status)).toEqual([]);
    expect(deriveFeedbackStatus(status)).toBe("RECORDED");
    expect(status.evidence.length).toBeLessThan(FEEDBACK_CATEGORY_IDS.length);
    expect(status.participants.records).toHaveLength(1);
  });

  it("重複した種別と根拠のない記録を拒否する", () => {
    const duplicate = recordedStatus();
    duplicate.evidence.push(structuredClone(duplicate.evidence[0]));
    expect(validateFeedbackStatus(duplicate).join("\n")).toContain("重複");

    const ungrounded = recordedStatus();
    ungrounded.evidence[0].artifacts = [];
    expect(validateFeedbackStatus(ungrounded).join("\n")).toContain("匿名化した記録");
  });

  it("改善が必要な問題は公開を止める判定ではなく追跡状態にする", () => {
    const status = recordedStatus();
    status.feedbackStatus = "NEEDS FOLLOW-UP";
    status.issues.push({ id: "FF-ISSUE-1", severity: "P1", status: "OPEN" });
    expect(validateFeedbackStatus(status)).toEqual([]);
    expect(deriveFeedbackStatus(status)).toBe("NEEDS FOLLOW-UP");
  });

  it("status CLIは未実施を終了コード0で報告する", () => {
    const report = spawnSync(process.execPath, [scriptPath, statusPath], { encoding: "utf8" });
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("Foundation feedback: NOT RUN");
    expect(report.stdout).toContain("RECORDED 0/14");
  });
});
