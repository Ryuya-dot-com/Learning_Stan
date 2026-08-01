import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  BUNDLE_FILES,
  BUNDLE_PATH,
  BUNDLE_README,
  BUNDLE_ROOT,
  buildStep1Bundle,
  verifyStep1Bundle,
} from "./generate-step1-bundle.mjs";

describe("STEP 1スターターZIP", () => {
  it("公開ZIPが固定マニフェストと元ファイルの内容に一致する", async () => {
    const published = await readFile(BUNDLE_PATH);
    await expect(verifyStep1Bundle(published)).resolves.toEqual({
      files: BUNDLE_FILES.length + 1,
      root: BUNDLE_ROOT,
    });
  });

  it("同じ入力からバイト単位で同じZIPを再生成できる", async () => {
    const [published, generated] = await Promise.all([
      readFile(BUNDLE_PATH),
      buildStep1Bundle(),
    ]);
    expect(generated.equals(published)).toBe(true);
  });

  it("初心者向けREADMEと安全な相対パスだけを含む", async () => {
    const zip = await JSZip.loadAsync(await readFile(BUNDLE_PATH));
    const fileNames = Object.values(zip.files).filter((entry) => !entry.dir).map((entry) => entry.name);

    expect(BUNDLE_README).toContain("File > New Project > Existing Directory");
    expect(BUNDLE_README).toContain("data/にある配布ファイル(raw)は上書きしません");
    expect(fileNames.every((name) => name.startsWith(`${BUNDLE_ROOT}/`))).toBe(true);
    expect(fileNames.every((name) => !name.includes("\\\\") && !name.includes("../"))).toBe(true);
  });
});
