import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyBlock,
  collectExamples,
  compareOutput,
  loadLessons,
  normalizeOutput,
} from "./r-example-verifier.mjs";

describe("Rコード例の分類", () => {
  it("期待出力付きの例は既定でexactになる", () => {
    expect(classifyBlock({ code: "1 + 1", out: "[1] 2" }, "sample")).toEqual({ mode: "exact" });
  });

  it("manualには理由を必須とする", () => {
    expect(() => classifyBlock({ code: "> 1 + 1", verify: { mode: "manual" } }, "sample")).toThrow(/reason/);
    expect(() => classifyBlock({ code: "1 + 1", verify: { mode: "manual", reason: "画面確認", parse: "yes" } }, "sample")).toThrow(/parse/);
    expect(classifyBlock({ code: "1 + 1", verify: { mode: "manual", reason: "画面確認", parse: true } }, "sample")).toEqual({ mode: "manual", reason: "画面確認", parse: true });
  });

  it("教材内の全コード例が分類されている", async () => {
    const examples = collectExamples(await loadLessons(process.cwd()));

    expect(examples.length).toBeGreaterThan(0);
    expect(examples.every((example) => example.verify?.mode)).toBe(true);
    expect(examples.filter((example) => example.verify.mode === "manual").every((example) => example.verify.reason)).toBe(true);
  });

  it("Viteを介さないNode.js実行でもR教材だけを読み込める", () => {
    const verifierUrl = pathToFileURL(`${process.cwd()}/scripts/r-example-verifier.mjs`).href;
    const script = [
      `import { loadLessons } from ${JSON.stringify(verifierUrl)};`,
      "const lessons = await loadLessons(process.cwd());",
      "if (lessons.length === 0) throw new Error('R教材が見つかりません');",
      "if (lessons.some(({ path }) => path.split(/[\\\\/]/).includes('7-stan'))) throw new Error('Stan教材を読み込んでいます');",
    ].join("\n");
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
  });
});

describe("R出力比較", () => {
  it("exactでは改行コードと行末空白だけを正規化する", () => {
    expect(normalizeOutput("[1] 2  \r\n")).toBe("[1] 2");
    expect(normalizeOutput("  [1] 2\n")).toBe("  [1] 2");
    expect(compareOutput({ id: "x", out: "[1] 2", verify: { mode: "exact" } }, "[1] 2  \r\n").ok).toBe(true);
    expect(compareOutput({ id: "x", out: "[1] 2", verify: { mode: "exact" } }, "  [1] 2\n").ok).toBe(false);
    expect(compareOutput({ id: "x", out: "[1] 2", verify: { mode: "exact" } }, "[1] 3").ok).toBe(false);
  });

  it("numericでは非数値構造を保ったまま許容誤差を使う", () => {
    const example = {
      id: "x",
      out: "mean: 1.0000",
      verify: { mode: "numeric", absoluteTolerance: 0.001, relativeTolerance: 0 },
    };

    expect(compareOutput(example, "mean: 1.0005").ok).toBe(true);
    expect(compareOutput(example, "mean: 1.01").ok).toBe(false);
    expect(compareOutput(example, "sd: 1.0005").ok).toBe(false);
  });

  it("stochasticでは指定した数値範囲を検査する", () => {
    const example = {
      id: "x",
      verify: { mode: "stochastic", ranges: [{ index: 0, min: 0.4, max: 0.6, label: "平均" }] },
    };

    expect(compareOutput(example, "[1] 0.5").ok).toBe(true);
    expect(compareOutput(example, "[1] 0.8").ok).toBe(false);
  });
});
