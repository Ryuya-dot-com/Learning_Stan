// theme.js の色キーと、実際にソースで参照されているキーの整合を保証する。
// 配色のキー名を変更したとき、置換漏れをデプロイ前に検出する。
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { C, THEME_CSS_VARS, GLOBAL_CSS } from "./theme.js";

const srcDir = dirname(fileURLToPath(import.meta.url));
const WHITE = "#FFFFFF";

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9A-Fa-f]{2}/g).map((value) => parseInt(value, 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function expectContrast(pairs, minimum) {
  const failures = pairs
    .map(([name, foreground, background]) => ({
      name,
      ratio: contrastRatio(foreground, background),
    }))
    .filter(({ ratio }) => ratio + Number.EPSILON < minimum)
    .map(({ name, ratio }) => `${name}: ${ratio.toFixed(2)}:1 < ${minimum}:1`);
  expect(failures).toEqual([]);
}

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

  it("CSSへ渡す変数が配色と書体の正本を参照する", () => {
    expect(THEME_CSS_VARS["--c-accent"]).toBe(C.accent);
    expect(THEME_CSS_VARS["--c-accent-deep"]).toBe(C.accentDeep);
    expect(THEME_CSS_VARS["--c-stan"]).toBe(C.stan);
    expect(THEME_CSS_VARS["--font-jp"]).toContain("Hiragino Sans");
    expect(THEME_CSS_VARS["--font-mono"]).toContain("ui-monospace");
  });

  it("Julia版の色キーが残っていない", () => {
    const legacy = ["purple", "purpleDeep", "purpleSoft", "green", "greenText", "greenSoft", "red", "redText", "redSoft"];
    expect(legacy.filter((k) => k in C), "Julia版のキー名が残っている").toEqual([]);
  });

  // 上の検査は「C.xxx が定義済みか」しか見ないため、JSX に16進数を直書きすると素通りしてしまう。
  // 実際、誤答フィードバックの琥珀色一式(#FFF7E8/#82590F/#7A5A1A ほか)が theme.js の外にあり、
  // 「文字色はすべてコントラスト確認済み」という theme.js の宣言の範囲外にこぼれていた(監査指摘)。
  // 色を1か所に集約し続けるため、直書きそのものを禁止する。
  it("JSX に色の直書きがない(#FFFFFF を除く)", () => {
    const files = readdirSync(srcDir).filter((f) => /\.jsx$/.test(f));
    const hits = [];
    for (const f of files) {
      readFileSync(join(srcDir, f), "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const m of line.matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
            if (m[0].toUpperCase() !== "#FFFFFF") hits.push(`${f}:${i + 1} の ${m[0]} は theme.js に移すこと`);
          }
        });
    }
    expect(hits, "JSX に色が直書きされている").toEqual([]);
  });

  it("実際に使う文字色と背景色がWCAG AAの4.5:1を満たす", () => {
    expectContrast([
      ["ink / paper", C.ink, C.paper],
      ["ink / white", C.ink, WHITE],
      ["body / paper", C.body, C.paper],
      ["body / white", C.body, WHITE],
      ["body / accentSoft", C.body, C.accentSoft],
      ["sub / paper", C.sub, C.paper],
      ["sub / white", C.sub, WHITE],
      ["faint / paper", C.faint, C.paper],
      ["faint / white", C.faint, WHITE],
      ["accent / white", C.accent, WHITE],
      ["accentDeep / paper", C.accentDeep, C.paper],
      ["accentDeep / white", C.accentDeep, WHITE],
      ["accentDeep / accentSoft", C.accentDeep, C.accentSoft],
      ["accentDeep / chip", C.accentDeep, C.chip],
      ["okText / paper", C.okText, C.paper],
      ["okText / white", C.okText, WHITE],
      ["okText / okSoft", C.okText, C.okSoft],
      ["okDeep / okSoft", C.okDeep, C.okSoft],
      ["alert / white", C.alert, WHITE],
      ["alertText / paper", C.alertText, C.paper],
      ["alertText / white", C.alertText, WHITE],
      ["alertText / alertSoft", C.alertText, C.alertSoft],
      ["warnText / warnSoft", C.warnText, C.warnSoft],
      ["warnBody / warnSoft", C.warnBody, C.warnSoft],
      ["caseText / caseSoft", C.caseText, C.caseSoft],
      ["caseText / white", C.caseText, WHITE],
      ["sub / caseSoft", C.sub, C.caseSoft],
      ["stan / white", C.stan, WHITE],
      ["dim / night", C.dim, C.night],
      ["white / accent", WHITE, C.accent],
      ["white / accentDeep", WHITE, C.accentDeep],
      ["white / okText", WHITE, C.okText],
      ["white / alert", WHITE, C.alert],
    ], 4.5);
  });

  it("入力境界とフォーカス色が3:1を満たし、CSSはtheme値を参照する", () => {
    expectContrast([
      ["edge / white", C.edge, WHITE],
      ["edge / paper", C.edge, C.paper],
      ["focus / white", C.accentDeep, WHITE],
      ["focus / paper", C.accentDeep, C.paper],
      ["focus / accentSoft", C.accentDeep, C.accentSoft],
      ["focus / okSoft", C.accentDeep, C.okSoft],
      ["focus / alertSoft", C.accentDeep, C.alertSoft],
      ["focus / warnSoft", C.accentDeep, C.warnSoft],
      ["focus / caseSoft", C.accentDeep, C.caseSoft],
    ], 3);
    expect(GLOBAL_CSS).toContain(`color: ${C.sub}`);
    expect(GLOBAL_CSS).toContain(`outline: 3px solid ${C.accentDeep}`);
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
