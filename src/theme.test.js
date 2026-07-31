// theme.js の色キーと、実際にソースで参照されているキーの整合を保証する。
// 配色のキー名を変更したとき、置換漏れをデプロイ前に検出する。
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { C } from "./theme.js";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("配色定義", () => {
  it("参照されている色キーがすべて theme.js に定義されている", () => {
    const files = readdirSync(srcDir).filter((f) => /\.jsx$/.test(f));
    const defined = new Set(Object.keys(C));
    const missing = [];
    for (const f of files) {
      const src = readFileSync(join(srcDir, f), "utf8");
      for (const m of src.matchAll(/\bC\.([A-Za-z][A-Za-z0-9]*)/g)) {
        if (!defined.has(m[1])) missing.push(`${f}: C.${m[1]}`);
      }
    }
    expect(missing, `theme.js に未定義の色キーが参照されている`).toEqual([]);
  });

  it("Julia版の色キーが残っていない", () => {
    const legacy = ["purple", "purpleDeep", "purpleSoft", "green", "greenText", "greenSoft", "red", "redText", "redSoft"];
    expect(legacy.filter((k) => k in C), "Julia版のキー名が残っている").toEqual([]);
  });
});
