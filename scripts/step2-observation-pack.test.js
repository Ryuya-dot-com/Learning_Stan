import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  DATA_PATH,
  PACK_PATH,
  PACK_ROOT,
  buildStep2ObservationPack,
  generateDeviceLoadCsv,
  sha256,
  verifyStep2ObservationPack,
} from "./generate-step2-observation-pack.mjs";

describe("STEP 2初心者観察用ZIP", () => {
  it("課題票と未見CSVの2ファイルだけを含む", async () => {
    const published = await readFile(PACK_PATH);
    await expect(verifyStep2ObservationPack(published)).resolves.toEqual({
      files: 2,
      root: PACK_ROOT,
      rows: 384,
      sha256: "60ec20716259cb01eb2faf9e6f6de4d601a740042f312765db6f834445c56289",
    });
  });

  it("完成コード・採点キー・チェッカー・隠し期待値を露出しない", async () => {
    const zip = await JSZip.loadAsync(await readFile(PACK_PATH));
    const names = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name.toLowerCase());
    const task = await zip.file(`${PACK_ROOT}/PARTICIPANT_TASK.md`).async("string");

    for (const forbidden of [
      "checker",
      "facilitator",
      "decision",
      "status.json",
      "report_and_transfer",
    ]) expect(names.every((name) => !name.includes(forbidden))).toBe(true);
    for (const forbidden of [
      "STEP 2 TRANSFER PASS",
      "device_condition_summary.csvは32行",
      "device_differences.csvは16行",
      "全16台でhigh_load",
    ]) expect(task).not.toContain(forbidden);
  });

  it("未見CSVの行・キー・条件・valid構造を固定する", async () => {
    const source = await readFile(DATA_PATH);
    expect(source.equals(generateDeviceLoadCsv())).toBe(true);
    expect(sha256(source)).toBe(
      "60ec20716259cb01eb2faf9e6f6de4d601a740042f312765db6f834445c56289",
    );
    const lines = source.toString("utf8").trimEnd().split("\n");
    expect(lines[0]).toBe("device_id,load_condition,reading,latency_ms,valid");
    expect(lines).toHaveLength(385);
    expect(lines.slice(1).filter((line) => line.endsWith(",true"))).toHaveLength(352);
    expect(new Set(lines.slice(1).map((line) => line.split(",")[0])).size).toBe(16);
  });

  it("同じ入力からバイト単位で同じZIPを再生成できる", async () => {
    const [published, generated] = await Promise.all([
      readFile(PACK_PATH),
      buildStep2ObservationPack(),
    ]);
    expect(generated.equals(published)).toBe(true);
  });
});
