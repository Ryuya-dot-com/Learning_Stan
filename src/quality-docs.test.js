import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const qualityRoot = join(root, "quality", "foundation-gate");
const read = (name) => readFileSync(join(qualityRoot, name), "utf8");

describe("Foundation Gate実施キット", () => {
  it("実施手順・監査票・観察票・判定票を追跡可能な場所に持つ", () => {
    const hub = read("README.md");

    for (const file of [
      "ACCESSIBILITY_AUDIT.md",
      "LEARNER_OBSERVATION_PROTOCOL.md",
      "LEARNER_OBSERVATION_RECORD.md",
      "GATE_DECISION.md",
    ]) {
      expect(hub).toContain(`(${file})`);
      expect(read(file).length).toBeGreaterThan(500);
    }
  });

  it("実機監査に対象版・NVDA・VoiceOver・モバイル・WCAG基準がある", () => {
    const audit = read("ACCESSIBILITY_AUDIT.md");

    for (const required of [
      "対象commit SHA",
      "NVDA",
      "VoiceOver",
      "A11Y-MOBILE",
      "320 CSS px",
      "4.5:1",
      "WCAG 2.2",
    ]) expect(audit).toContain(required);
  });

  it("観察プロトコルが少人数結果を一般化せず、支援と外部要因を分離する", () => {
    const protocol = read("LEARNER_OBSERVATION_PROTOCOL.md");

    expect(protocol).toContain("達成率を母集団へ一般化しません");
    expect(protocol).toContain("正式な研究、論文、学会発表");
    expect(protocol).toContain("H3");
    expect(protocol).toContain("外部要因");
    for (let index = 1; index <= 7; index += 1) {
      expect(protocol).toContain(`T${String(index).padStart(2, "0")}`);
    }
  });

  it("匿名記録票が直接識別子を禁止し、観察事実と仮説を分ける", () => {
    const record = read("LEARNER_OBSERVATION_RECORD.md");

    expect(record).toContain("氏名・学籍番号・メール・成績・診断情報を記録しない");
    expect(record).toContain("観察した事実");
    expect(record).toContain("観察者の仮説");
    expect(record).toContain("支援水準を過小申告していない");
  });

  it("Gate判定が未実施を合格にせず、全証拠と重大問題ゼロを要求する", () => {
    const gate = read("GATE_DECISION.md");

    expect(gate).toContain("G01–G14がすべて`PASS`");
    expect(gate).toContain("未解決のP0・P1が0件");
    expect(gate).toContain("初学者3名以上");
    expect(gate).toContain("D-001");
    expect(gate).toContain("D-005");
    expect(gate).toContain("未実施を`FAIL`や`PASS`へ丸めません");
    expect(gate).toContain("主実装者とは別のレビュー者");
  });

  it("README・ロードマップ・実施キットの相対リンクが実在する", () => {
    const sources = [
      join(root, "README.md"),
      join(root, "ROADMAP.md"),
      ...[
        "README.md",
        "ACCESSIBILITY_AUDIT.md",
        "LEARNER_OBSERVATION_PROTOCOL.md",
        "LEARNER_OBSERVATION_RECORD.md",
        "GATE_DECISION.md",
      ].map((name) => join(qualityRoot, name)),
    ];

    for (const source of sources) {
      const markdown = readFileSync(source, "utf8");
      const targets = [...markdown.matchAll(/\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !/^(?:https?:|#)/.test(target))
        .map((target) => target.split("#")[0]);

      for (const target of targets) {
        expect(existsSync(join(dirname(source), target)), `${source}: ${target}`).toBe(true);
      }
    }
  });
});
