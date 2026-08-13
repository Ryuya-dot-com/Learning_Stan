import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lessonDir = path.join(root, "content", "bayes-methods", "lessons");

const expectedFiles = [
  "01-regression-prediction-residuals.md",
  "02-factors-contrasts-interactions.md",
  "03-probability-and-simulation.md",
  "04-likelihood-and-response-distributions.md",
  "05-bayesian-updating-posterior.md",
  "06-prior-predictive-sensitivity.md",
  "07-brms-continuous-workflow.md",
  "08-brms-diagnostics-prediction.md",
  "09-repeated-measures-partial-pooling.md",
  "10-binary-ordinal-outcomes.md",
  "11-counts-offset-overdispersion.md",
  "12-reaction-time-models.md",
  "13-read-generated-stan-code.md",
  "14-missing-data-measurement-error.md",
  "15-prediction-units-recovery-sbc.md",
];

const requiredSections = [
  "## この回のゴール",
  "## 前提",
  "## 研究場面",
  "## 理解問題",
  "## 4段階練習",
  "## 一次資料",
];

describe("ベイズ・Stan前提教材", () => {
  it("15レッスンが順序どおり揃っている", () => {
    const actualFiles = readdirSync(lessonDir)
      .filter((file) => file.endsWith(".md"))
      .sort();

    expect(actualFiles).toEqual(expectedFiles);
  });

  it.each(expectedFiles)("%s が説明・評価・復習の共通構造を持つ", (file) => {
    const content = readFileSync(path.join(lessonDir, file), "utf8");
    const lessonNumber = file.slice(0, 2);

    expect(content).toMatch(new RegExp(`^# ${lessonNumber} `));
    for (const section of requiredSections) {
      expect(content).toContain(section);
    }
    expect(content).toMatch(/^## 典型的(?:な)?誤解$/m);
    expect(content).toMatch(/^## (?:歯応えある)?任意課題$/m);

    for (const questionType of ["選択", "出力予測", "記述", "レビュー", "主張境界"]) {
      expect(content).toContain(questionType);
    }

    const answerCount = (content.match(/\*\*(?:解答|rubric|採点基準)/g) ?? []).length;
    expect(answerCount).toBeGreaterThanOrEqual(5);

    for (const stage of ["まねる", "一つ変える", "見ずに作る", "未見転移"]) {
      expect(content).toContain(stage);
    }

    expect(content).toMatch(/https:\/\//);
    expect(content).not.toMatch(/公開ゲート|初学者観察|レビュー待ち|問題ID|執筆者|担当者|draft/i);

    const backtickFenceCount = (content.match(/```/g) ?? []).length;
    const tildeFenceCount = (content.match(/~~~/g) ?? []).length;
    expect(backtickFenceCount % 2).toBe(0);
    expect(tildeFenceCount % 2).toBe(0);
  });

  it("案内ページが全レッスンへリンクしている", () => {
    const readme = readFileSync(
      path.join(root, "content", "bayes-methods", "README.md"),
      "utf8",
    );

    for (const file of expectedFiles) {
      expect(readme).toContain(`lessons/${file}`);
    }
  });
});
