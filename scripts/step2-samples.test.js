import { describe, expect, it } from "vitest";
import {
  SEED,
  generateStep2Rows,
  serializeStep2Rows,
} from "./generate-step2-samples.mjs";

describe("STEP 2合成パイロットデータ", () => {
  it("24名×2条件×20試行を固定seedで再生成できる", () => {
    const rows = generateStep2Rows();
    expect(rows).toHaveLength(960);
    expect(new Set(rows.map((row) => row.id)).size).toBe(24);
    expect(new Set(rows.map((row) => row.condition))).toEqual(new Set(["cong", "incong"]));
    expect(generateStep2Rows()).toEqual(generateStep2Rows(SEED));
  });

  it("各参加者・条件に1〜20試行が1回ずつある", () => {
    const rows = generateStep2Rows();
    const cells = new Map();
    for (const row of rows) {
      const key = `${row.id}:${row.condition}`;
      const trials = cells.get(key) ?? [];
      trials.push(row.trial);
      cells.set(key, trials);
    }

    expect(cells.size).toBe(48);
    for (const trials of cells.values()) {
      expect(trials).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    }
  });

  it("反応時間と正誤が教材のデータ契約を満たす", () => {
    for (const row of generateStep2Rows()) {
      expect(Number.isInteger(row.rt_ms)).toBe(true);
      expect(row.rt_ms).toBeGreaterThanOrEqual(250);
      expect(row.rt_ms).toBeLessThanOrEqual(1500);
      expect(typeof row.correct).toBe("boolean");
    }
  });

  it("CSVは固定列順・LF終端で生成される", () => {
    const csv = serializeStep2Rows(generateStep2Rows());
    expect(csv.startsWith("id,condition,trial,rt_ms,correct\n")).toBe(true);
    expect(csv.endsWith("\n")).toBe(true);
    expect(csv).not.toContain("\r");
    expect(csv.trimEnd().split("\n")).toHaveLength(961);
  });
});
