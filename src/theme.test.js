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

// public/roadmap.html は後からアプリと切り離して追加されたページで、上の検査(src/*.jsx のみ走査)では
// 見つけられない。過去にJuliaの紫が取り残っていた実例(roadmap.htmlの --purple:#9558B2 ほか)があるため、
// リポジトリ全体を対象に別途検査する。
describe("Julia由来の紫の混入検査（リポジトリ全体）", () => {
  // 過去に除去したJulia由来の紫。src/highlight.js の TOK_COLOR.kw に使われている #C792EA は
  // シンタックスハイライトの構文色であってブランド色ではないため、あえてこのリストに含めない。
  const LEGACY_PURPLES = ["#9558B2", "#DCC9E8", "#5A3B6E", "#5A4470"];

  const repoRoot = join(srcDir, "..");

  // src/ 配下の .js / .jsx を再帰的に集める。テストファイル自身は、このリストの16進数値を
  // 文字列リテラルとして含むため対象から除外する。
  function collectSourceFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...collectSourceFiles(full));
      } else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it("src/ と public/roadmap.html にJulia由来の紫が残っていない", () => {
    const targets = [...collectSourceFiles(srcDir), join(repoRoot, "public", "roadmap.html")];
    const hits = [];
    for (const file of targets) {
      const lines = readFileSync(file, "utf8").split("\n");
      const rel = file.slice(repoRoot.length + 1);
      lines.forEach((line, idx) => {
        for (const hex of LEGACY_PURPLES) {
          if (line.toUpperCase().includes(hex)) {
            hits.push(`${rel}:${idx + 1} に ${hex} が見つかりました`);
          }
        }
      });
    }
    expect(hits, "Julia由来の紫の混入が見つかった").toEqual([]);
  });

  it("シンタックスハイライトの構文色 #C792EA は検査対象に含めていない", () => {
    // src/highlight.js の TOK_COLOR.kw で使う #C792EA はブランド色ではないため、
    // このテストが誤検出しないことを明示的に確認する。
    expect(LEGACY_PURPLES).not.toContain("#C792EA");
  });
});
