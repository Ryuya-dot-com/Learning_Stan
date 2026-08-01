import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  PACK_FILES,
  PACK_PATH,
  PACK_ROOT,
  buildTransferObservationPack,
  verifyTransferObservationPack,
} from "./generate-step1-transfer-observation-pack.mjs";

describe("STEP 1独立転移・観察用ZIP", () => {
  it("固定マニフェストの参加者用3ファイルだけを含む", async () => {
    const published = await readFile(PACK_PATH);
    await expect(verifyTransferObservationPack(published)).resolves.toEqual({
      files: PACK_FILES.length,
      root: PACK_ROOT,
    });
  });

  it("完成版・採点キー・自己チェッカー・隠し期待値を露出しない", async () => {
    const zip = await JSZip.loadAsync(await readFile(PACK_PATH));
    const names = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name.toLowerCase());
    const task = await zip.file(`${PACK_ROOT}/PARTICIPANT_TASK.md`).async("string");

    for (const forbidden of [
      "step1_analysis",
      "nb1-data",
      "step1-transfer.qmd",
      "step1_transfer_check",
      "facilitator",
    ]) expect(names.every((name) => !name.includes(forbidden))).toBe(true);
    for (const forbidden of [
      "55e3056af5bda9a8cf86c19df9b0ad6f",
      "21入力行",
      "16行",
      "| A01 | 420 | 500 | 80 |",
      "TRANSFER PASS",
    ]) expect(task).not.toContain(forbidden);
  });

  it("同じ入力からバイト単位で同じZIPを再生成できる", async () => {
    const [published, generated] = await Promise.all([
      readFile(PACK_PATH),
      buildTransferObservationPack(),
    ]);
    expect(generated.equals(published)).toBe(true);
  });
});
