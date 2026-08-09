import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateStanReviewPlan } from "./stan-review-plan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(readFileSync(join(root, "quality", "stan-release-gate", "review-plan.json"), "utf8"));
const status = JSON.parse(readFileSync(join(root, "quality", "stan-release-gate", "status.json"), "utf8"));
const script = join(root, "scripts", "stan-review-plan.mjs");

describe("Stan独立レビューパック", () => {
  it("対象SHA・3 scope・自動証拠・repository内artifactを固定する", () => {
    expect(validateStanReviewPlan(plan, status, root)).toEqual([]);
  });

  it("対象SHAのずれとscope欠落を拒否する", () => {
    const wrongTarget = structuredClone(plan);
    wrongTarget.target.commit = "a".repeat(40);
    expect(validateStanReviewPlan(wrongTarget, status, root).join("\n")).toContain("対象commit");

    const missingScope = structuredClone(plan);
    missingScope.requiredReviewScopes.pop();
    expect(validateStanReviewPlan(missingScope, status, root).join("\n")).toContain("3 scope");
  });

  it("存在しない・repository外の証拠pathを拒否する", () => {
    const outside = structuredClone(plan);
    outside.evidenceSets["stan-language"][0] = "../private/review.md";
    expect(validateStanReviewPlan(outside, status, root).join("\n")).toContain("相対path");
  });

  it("CLIはレビュー完了ではなく実施準備完了と報告する", () => {
    const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("READY TO REVIEW");
    expect(result.stdout).toContain("review not completed");
  });
});
