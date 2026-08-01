// レッスンデータの検証テスト（仕様: docs/specs/2026-07-31-r-stan-learning-roadmap-design.md）。
// レッスン追加時のミスをデプロイ前に検出する。CI ではビルド前に実行される。
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LESSONS } from "./lessons/index.js";
import { OUTCOMES } from "./outcomes.js";
import { SECTIONS } from "./sections.js";

// 演習形式の許容値(仕様5節)
const ALLOWED_K = ["choice", "fill", "tf", "reflect"];

const mods = import.meta.glob("./lessons/*/*.js", { eager: true });

describe("セクション定義", () => {
  it("dir が重複していない", () => {
    const dirs = SECTIONS.map((s) => s.dir);
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it("すべてのレッスンファイルが SECTIONS 定義済みのディレクトリに属している", () => {
    const known = new Set(SECTIONS.map((s) => s.dir));
    for (const path of Object.keys(mods)) {
      const dir = path.split("/")[2]; // "./lessons/<dir>/<file>.js"
      expect(known, `${path} のセクション ${dir} が sections.js に未定義`).toContain(dir);
    }
  });

  it("番号なしセクションには mark がある(Home バッジ表示に必要)", () => {
    for (const sec of SECTIONS.filter((s) => !s.numbered)) {
      expect(sec.mark, `${sec.dir} に mark がない`).toBeTruthy();
    }
  });

  it("notebook を持ちレッスンが存在するセクションは、public/notebooks/ に実ファイルがある", () => {
    // 未執筆セクション(レッスン0本)は検査しない——移行時点でテストが恒久失敗しないように(監査指摘)
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    for (const sec of SECTIONS) {
      if (!sec.notebook) continue;
      const hasLessons = LESSONS.some((l) => l.section === sec.dir);
      if (!hasLessons) continue;
      expect(
        existsSync(join(root, "public", "notebooks", sec.notebook)),
        `${sec.dir} のノートブック ${sec.notebook} が public/notebooks/ にない`
      ).toBe(true);
    }
  });
});

describe("レッスンデータ", () => {
  it("id が重複していない", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(LESSONS.map((l) => [l.id, l]))("%s: 必須フィールドと採番規則", (_, l) => {
    expect(l.id).toBeTruthy();
    expect(l.title).toBeTruthy();
    expect(l.tag).toBeTruthy();
    expect(Array.isArray(l.pages) && l.pages.length > 0).toBe(true);
    expect(Array.isArray(l.ex) && l.ex.length > 0).toBe(true);
    const sec = SECTIONS.find((s) => s.dir === l.section);
    if (sec.numbered) {
      expect(typeof l.num).toBe("number");
    } else {
      expect(l.num).toBeNull();
    }
  });

  it("番号付きレッスンの num は 1 からの連番", () => {
    const nums = LESSONS.filter((l) => l.num != null).map((l) => l.num);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });

  it("l3: logical の説明で欠損値 NA を除外しない", () => {
    const lesson = LESSONS.find((l) => l.id === "l3");
    const pageText = lesson.pages.flatMap((p) => [...(p.b || []), ...(p.a || [])]).join("\n");
    const item = lesson.ex.flatMap((ex) => ex.items || []).find((it) => it.s.includes("logical のベクトル"));

    expect(pageText).toContain("NA");
    expect(item?.s).toContain("NA");
    expect(item?.a).toBe(true);
  });

  it("l5: factor の水準順を明示して実行環境による差を避ける", () => {
    const lesson = LESSONS.find((l) => l.id === "l5");
    const factorPage = lesson.pages.find((p) => p.code?.includes("factor("));

    expect(factorPage?.code).toContain('levels = c("易", "難")');
  });

  it.each(LESSONS.map((l) => [l.id, l]))("%s: 先頭ページに到達目標がある", (_, l) => {
    // 仕様4節: 各レッスンの冒頭ページに「このレッスンでは◯◯ができるようになります」を1文で置く
    const first = l.pages[0];
    const body = (first.b || []).join("");
    expect(body, `${l.id} の先頭ページに到達目標がない`).toMatch(/できるようになります/);
  });
});

describe("到達目標―評価対応", () => {
  it("全レッスンに重複のない対応表が1件ずつある", () => {
    expect(OUTCOMES.map((outcome) => outcome.lessonId).sort()).toEqual(
      LESSONS.map((lesson) => lesson.id).sort()
    );
    expect(new Set(OUTCOMES.map((outcome) => outcome.goalId)).size).toBe(OUTCOMES.length);
  });

  it.each(OUTCOMES.map((outcome) => [outcome.lessonId, outcome]))(
    "%s: 目標文と直接評価証拠が整合する",
    (_, outcome) => {
      const lesson = LESSONS.find((item) => item.id === outcome.lessonId);
      const intro = (lesson.pages[0].b || []).join("\n");

      expect(intro).toContain(`このレッスンでは、${outcome.statement}ようになります。`);
      expect(["explain", "apply", "analyze", "perform"]).toContain(outcome.level);
      expect(outcome.evidence.some((evidence) => evidence.strength === "direct")).toBe(true);
      expect(new Set(outcome.dimensions).size).toBe(outcome.dimensions.length);
      const directDimensions = new Set(
        outcome.evidence
          .filter((evidence) => evidence.strength === "direct")
          .flatMap((evidence) => evidence.dimensions)
      );
      expect([...directDimensions].sort()).toEqual([...outcome.dimensions].sort());

      for (const evidence of outcome.evidence) {
        expect(["direct", "supporting"]).toContain(evidence.strength);
        expect(typeof evidence.criterion).toBe("string");
        expect(evidence.criterion.length).toBeGreaterThan(0);
        expect(evidence.dimensions.length).toBeGreaterThan(0);
        expect(evidence.dimensions.every((dimension) => outcome.dimensions.includes(dimension))).toBe(true);

        if (evidence.kind === "exercise") {
          const exercise = lesson.ex[evidence.exerciseIndex];
          expect(exercise, `${lesson.id} 演習${evidence.exerciseIndex + 1}が存在しない`).toBeTruthy();
          expect(evidence.method).toBe(
            ["fill", "reflect"].includes(exercise.k) ? "constructed-response" : "selected-response"
          );
        } else {
          expect(evidence.kind).toBe("practice");
          expect(evidence.method).toBe("self-attested-performance");
          expect(lesson.practice?.items.some((item) => item.id === evidence.itemId)).toBe(true);
        }
      }
    }
  );
});

describe("実践チェック", () => {
  const practiceLessons = LESSONS.filter((lesson) => lesson.practice);

  it("現在公開中の実践チェックはL10にだけあり、Foundation Checkを5項目で測る", () => {
    expect(practiceLessons.map((lesson) => lesson.id)).toEqual(["l10"]);
    expect(practiceLessons[0].practice.items).toHaveLength(5);
  });

  it.each(practiceLessons.map((lesson) => [lesson.id, lesson]))("%s: ID・説明・コード検証方法が完全", (_, lesson) => {
    const ids = lesson.practice.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(lesson.practice.intro.length).toBeGreaterThan(0);

    for (const item of lesson.practice.items) {
      expect(item.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.criterion.length).toBeGreaterThan(0);
      if (item.code) {
        expect(item.out != null || item.verify?.mode === "manual").toBe(true);
      }
    }
  });
});

describe("演習", () => {
  const allEx = LESSONS.flatMap((l) => l.ex.map((ex, i) => [`${l.id} 演習${i + 1}`, ex]));

  it.each(allEx)("%s: 形式と解答の整合", (_, ex) => {
    expect(ALLOWED_K, `k="${ex.k}" は未対応の形式`).toContain(ex.k);
    if (ex.k !== "reflect") expect(typeof ex.hint).toBe("string");
    if (["choice", "fill"].includes(ex.k)) {
      // Feedback が why.length を使うため、choice/fill では why 必須(欠けると正解表示がクラッシュする)
      expect(typeof ex.why).toBe("string");
      expect(ex.why.length).toBeGreaterThan(0);
    }

    if (ex.k === "tf") {
      // tf は3記述固定・各記述に個別の why 必須(項目別フィードバックの開示——仕様5節)
      expect(Array.isArray(ex.items) && ex.items.length === 3, "tf は記述3つ").toBe(true);
      for (const it of ex.items) {
        expect(typeof it.s).toBe("string");
        expect(it.s.length).toBeGreaterThan(0);
        expect(typeof it.a).toBe("boolean");
        expect(typeof it.why).toBe("string");
        expect(it.why.length).toBeGreaterThan(0);
      }
      // 全部○・全部×は当て推量で解けるため禁止
      expect(new Set(ex.items.map((it) => it.a)).size, "○×が混在していない").toBe(2);
    }

    if (ex.k === "choice") {
      expect(Array.isArray(ex.opts) && ex.opts.length >= 2).toBe(true);
      expect(Number.isInteger(ex.ans)).toBe(true);
      expect(ex.ans).toBeGreaterThanOrEqual(0);
      expect(ex.ans).toBeLessThan(ex.opts.length);
      expect(new Set(ex.opts).size, "選択肢が重複").toBe(ex.opts.length);
    }

    if (ex.k === "fill") {
      expect(Array.isArray(ex.accept) && ex.accept.length > 0).toBe(true);
      expect(typeof ex.show).toBe("string");
      // FillEx は入力を NFKC 正規化 + 小文字化して照合する。
      // よって accept の真の不変量は「正規化・小文字化で不変」であること(仕様9節・改訂版)
      for (const a of ex.accept) {
        expect(a, `accept "${a}" が正規化形でない`).toBe(a.normalize("NFKC").toLowerCase());
      }
      expect(ex.accept, `show "${ex.show}" が accept に対応しない`).toContain(
        ex.show.normalize("NFKC").toLowerCase()
      );
    }

    if (ex.k === "reflect") {
      expect(Number.isInteger(ex.minLength) && ex.minLength >= 10).toBe(true);
      expect(Array.isArray(ex.rubric) && ex.rubric.length >= 2).toBe(true);
      expect(ex.rubric.every((criterion) => typeof criterion === "string" && criterion.length > 0)).toBe(true);
      expect(typeof ex.example).toBe("string");
      expect(ex.example.length).toBeGreaterThanOrEqual(ex.minLength);
    }
  });

  it("テキスト中のバッククォートが対で閉じている(T コンポーネントの描画が壊れないこと)", () => {
    const texts = [];
    for (const l of LESSONS) {
      for (const p of l.pages) texts.push(...(p.b || []), ...(p.a || []), p.t);
      for (const ex of l.ex) {
        texts.push(ex.q, ex.why, ex.hint, ...(ex.opts || []));
        for (const it of ex.items || []) texts.push(it.s, it.why);
        texts.push(...(ex.rubric || []), ex.example);
      }
      if (l.practice) {
        texts.push(l.practice.title, l.practice.intro);
        for (const item of l.practice.items) texts.push(item.label, item.criterion);
      }
    }
    for (const t of texts.filter(Boolean)) {
      const count = (String(t).match(/`/g) || []).length;
      expect(count % 2, `バッククォートが奇数個: ${String(t).slice(0, 40)}…`).toBe(0);
    }
  });
});
