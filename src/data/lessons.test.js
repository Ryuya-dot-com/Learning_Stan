// レッスンデータの検証テスト（仕様: docs/specs/2026-07-31-r-stan-learning-roadmap-design.md）。
// レッスン追加時のミスをデプロイ前に検出する。CI ではビルド前に実行される。
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LESSONS } from "./lessons/index.js";
import { OUTCOMES } from "./outcomes.js";
import { SECTIONS } from "./sections.js";
import { JOURNEY_STAGES } from "../learningPath.js";

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

  it("公開中のSTEP 1を合成データ教材として誤解なく案内する", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const dataStage = JOURNEY_STAGES.find((stage) => stage.id === "data");
    const dataSection = SECTIONS.find((section) => section.dir === "2-data");
    const notebook = readFileSync(join(root, "public", "notebooks", "nb1-data.qmd"), "utf8");
    const publicRoadmap = readFileSync(join(root, "public", "roadmap.html"), "utf8");

    expect(dataStage.title).toBe("表形式データを読み、整える");
    expect(dataSection.sub).toBe(dataStage.title);
    expect(notebook).toContain('title: "NB1: 合成データを読み、整え、保存する"');
    expect(publicRoadmap).toContain("表形式データを読み、整える");
    expect([dataStage.title, dataSection.sub, notebook, publicRoadmap].join("\n")).not.toContain("実データを読み");
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

  it("L9・L10と検索向け説明が公開中の学習経路に追随する", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const prerequisiteText = ["l9", "l10"]
      .map((id) => LESSONS.find((lesson) => lesson.id === id))
      .flatMap((lesson) => lesson.pages)
      .flatMap((page) => [...(page.b || []), ...(page.a || [])])
      .join("\n");
    const indexHtml = readFileSync(join(root, "index.html"), "utf8");

    expect(prerequisiteText).not.toContain("今後公開予定のSTEP 1");
    expect(prerequisiteText).toContain("Foundation Checkの後に進むSTEP 1");
    expect(indexHtml).toContain("回帰、確率、ベイズ更新、brmsを順に学び、Stanでの実装・診断・予測・報告まで進みます");
  });

  it("STEP 2は各5問にV2以降の累積復習を加えて公開する", () => {
    const step2Lessons = LESSONS.filter((lesson) => lesson.section === "3-stats");

    expect(step2Lessons.map((lesson) => lesson.id)).toEqual([
      "step2-describe-distributions",
      "step2-grammar-of-graphics",
      "step2-show-individuals",
      "step2-report-and-transfer",
    ]);
    for (const [index, lesson] of step2Lessons.entries()) {
      expect(lesson.ex.filter((exercise) => !exercise.reviewLabel)).toHaveLength(5);
      expect(lesson.ex.filter((exercise) => exercise.reviewLabel)).toHaveLength(index === 0 ? 0 : 1);
      expect(lesson.practiceLadder.steps).toHaveLength(4);
      expect(lesson.practice.items).toHaveLength(
        lesson.id === "step2-report-and-transfer" ? 2 : 3
      );
    }
  });

  it("STEP 2の画面へ教材制作側のID・公開判定・内部パスを出さない", () => {
    const internalMarkers = [
      ["公開前の状態", /draft-unpublished|非公開ドラフト|公開ゲート|releasePrerequisites/i],
      ["観察を公開条件にする文言", /初心者観察|初学者観察|学習者観察ゲート/],
      ["教材制作側の問題ID", /step2-l(?:17|18|19|20)-q\d|問題の正本|assessments\.json/i],
      ["旧内部レッスン番号", /\bL(?:17|18|19|20)\b/],
      ["教材制作側の検査用語", /自動検証|自動検査|検証契約/],
      ["内部ファイルパス", /(?:src\/data|content\/step2|examples\/step2)/i],
    ];

    for (const lesson of LESSONS.filter((item) => item.section === "3-stats")) {
      const visibleText = [
        lesson.title,
        lesson.tag,
        ...lesson.pages.flatMap((page) => [page.t, ...(page.b || []), page.code, ...(page.a || [])]),
        ...lesson.ex.flatMap((exercise) => [
          exercise.q,
          exercise.code,
          ...(exercise.opts || []),
          exercise.why,
          exercise.hint,
          ...(exercise.rubric || []),
          exercise.example,
        ]),
        lesson.practice?.title,
        lesson.practice?.intro,
        ...(lesson.practice?.items || []).flatMap((item) => [item.label, item.criterion]),
        lesson.practiceLadder?.title,
        lesson.practiceLadder?.intro,
        ...(lesson.practiceLadder?.steps || []).flatMap((step) => [
          step.label,
          step.support,
          step.task,
          step.criterion,
        ]),
        lesson.challenge?.title,
        lesson.challenge?.scenario,
        lesson.challenge?.task,
        lesson.challenge?.code,
        ...(lesson.challenge?.hints || []),
        ...(lesson.challenge?.rubric || []),
        lesson.challenge?.example,
      ].filter(Boolean).join("\n");

      for (const [label, pattern] of internalMarkers) {
        expect(visibleText, `${lesson.id} に${label}が表示されています`).not.toMatch(pattern);
      }
    }
  });

  it("STEP 3〜5を各5問・4段階練習・3成果物・任意チャレンジで公開する", () => {
    const expected = {
      "4-sim": ["l21", "l22", "l23"],
      "5-bayes": ["l24", "l25", "l26"],
      "6-brms": ["l27", "l28", "l29", "l30", "l31", "l32", "l33"],
    };

    for (const [section, ids] of Object.entries(expected)) {
      const lessons = LESSONS.filter((lesson) => lesson.section === section);
      expect(lessons.map((lesson) => lesson.id)).toEqual(ids);
      for (const lesson of lessons) {
        expect(lesson.ex).toHaveLength(5);
        expect(lesson.practiceLadder.steps).toHaveLength(4);
        expect(lesson.practice.items).toHaveLength(3);
        expect(lesson.challenge).toMatchObject({
          title: expect.any(String),
          scenario: expect.any(String),
          task: expect.any(String),
          hints: expect.any(Array),
          rubric: expect.any(Array),
          example: expect.any(String),
        });
        expect(lesson.challenge.hints.length).toBeGreaterThanOrEqual(2);
        expect(lesson.challenge.rubric.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("STEP 3〜5の画面へ教材制作側の文言を出さない", () => {
    const internalMarkers = [
      /非公開ドラフト|公開ゲート|releasePrerequisites|学習者観察ゲート|初学者観察/,
      /content\/bayes-methods|src\/data\/lessons|curriculum\.json|assessments\.json/i,
      /\bL(?:2[1-9]|3[0-3])\b/,
    ];

    for (const lesson of LESSONS.filter((item) => ["4-sim", "5-bayes", "6-brms"].includes(item.section))) {
      const visibleText = JSON.stringify({
        title: lesson.title,
        tag: lesson.tag,
        pages: lesson.pages,
        exercises: lesson.ex,
        practice: lesson.practice,
        practiceLadder: lesson.practiceLadder,
        challenge: lesson.challenge,
      });
      for (const pattern of internalMarkers) {
        expect(visibleText, `${lesson.id} に教材制作側の文言が表示されています`).not.toMatch(pattern);
      }
    }
  });

  it("StanベータはL34〜L41を各5問・4段階練習・3成果物で公開する", () => {
    const stanLessons = LESSONS.filter((lesson) => lesson.section === "7-stan");

    expect(stanLessons.map((lesson) => lesson.id)).toEqual([
      "l34", "l35", "l36", "l37", "l38", "l39", "l40", "l41",
    ]);
    for (const lesson of stanLessons) {
      expect(lesson.ex).toHaveLength(5);
      expect(lesson.practiceLadder.steps).toHaveLength(4);
      expect(lesson.practice.items).toHaveLength(3);
      const text = lesson.pages.flatMap((page) => [...page.b, ...page.a]).join("\n");
      expect(text).not.toContain("非公開ドラフト");
    }
  });

  it("Stanベータの画面へ教材制作側のID・公開判定・証跡ファイル名を出さない", () => {
    const internalMarkers = [
      ["内部課題ID", /\b(?:sr\d{2}[a-z]?|mr\d{2})\b/i],
      ["教材制作・観察用語", /\b(?:beta-public|pilot|facilitator|delayed retention)\b/i],
      ["公開判定用語", /Release Gate|対象commit|クリーンCI|runtime証拠|未解決P[01]|学習者観察/],
      ["内部証跡ファイル", /(?:validation\.json|scripts\/verify-stan|model-review\/)/i],
    ];

    for (const lesson of LESSONS.filter((item) => item.section === "7-stan")) {
      const visibleText = [
        lesson.title,
        lesson.tag,
        ...lesson.pages.flatMap((page) => [page.t, ...page.b, page.code, ...page.a]),
        ...lesson.ex.flatMap((exercise) => [
          exercise.q,
          exercise.code,
          ...(exercise.opts || []),
          exercise.why,
          exercise.hint,
          ...(exercise.rubric || []),
          exercise.example,
        ]),
        lesson.practice?.title,
        lesson.practice?.intro,
        ...(lesson.practice?.items || []).flatMap((item) => [item.label, item.criterion]),
        lesson.practiceLadder?.title,
        lesson.practiceLadder?.intro,
        ...(lesson.practiceLadder?.steps || []).flatMap((step) => [
          step.label,
          step.support,
          step.task,
          step.criterion,
        ]),
      ]
        .filter(Boolean)
        .join("\n");
      for (const [label, pattern] of internalMarkers) {
        expect(visibleText, `${lesson.id} に${label}が表示されています`).not.toMatch(pattern);
      }
    }
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

  it("Foundation Check・STEP 1〜6の成果物を実機で確認する", () => {
    expect(practiceLessons.map((lesson) => lesson.id)).toEqual([
      "l10",
      "l16",
      "step2-describe-distributions",
      "step2-grammar-of-graphics",
      "step2-show-individuals",
      "step2-report-and-transfer",
      "l21", "l22", "l23",
      "l24", "l25", "l26",
      "l27", "l28", "l29", "l30", "l31", "l32", "l33",
      "l34", "l35", "l36", "l37", "l38", "l39", "l40", "l41",
    ]);
    expect(practiceLessons[0].practice.items).toHaveLength(5);
    expect(practiceLessons[1].practice.items).toHaveLength(4);
    for (const lesson of practiceLessons.slice(2)) {
      expect(lesson.practice.items).toHaveLength(
        lesson.id === "step2-report-and-transfer" ? 2 : 3
      );
    }
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

describe("4段階の反復練習", () => {
  it.each(LESSONS.map((lesson) => [lesson.id, lesson]))(
    "%s: まねる・変える・想起・転移を順に1回ずつ行う",
    (_, lesson) => {
      const ladder = lesson.practiceLadder;
      expect(ladder).toBeTruthy();
      expect(ladder.title).toBe("4段階の反復練習");
      expect(ladder.intro).toContain("今回くり返す技能");
      expect(ladder.steps.map((step) => step.id)).toEqual([
        "imitate",
        "change",
        "recall",
        "transfer",
      ]);

      for (const step of ladder.steps) {
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.support.length).toBeGreaterThan(0);
        expect(step.task.length).toBeGreaterThan(0);
        expect(step.criterion.length).toBeGreaterThan(0);
      }
      expect(ladder.steps[2].support).toContain("例を閉じ");
      expect(ladder.steps[3].support).toContain("別の場面");
    }
  );

  it("自己記録を理解済みの直接証拠へ混ぜない", () => {
    expect(OUTCOMES.flatMap((outcome) => outcome.evidence).some((evidence) => evidence.kind === "drill")).toBe(false);
  });
});

describe("STEP 1成果物", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

  it("レッスン別ダウンロード欄の全リンク先が公開ファイルとして存在する", () => {
    const resources = JOURNEY_STAGES.find((stage) => stage.id === "data").resources;

    expect(new Set(resources.map((resource) => resource.path)).size).toBe(resources.length);
    for (const resource of resources) {
      expect(
        existsSync(join(root, "public", resource.path)),
        `${resource.label}: public/${resource.path} がない`
      ).toBe(true);
    }
  });

  it("演習CSV・TSV・区切りTXTの列契約、行数、内容の一致を固定する", () => {
    const rtLines = readFileSync(join(root, "public", "data", "rt_data.csv"), "utf8").trim().split(/\r?\n/);
    const participantLines = readFileSync(join(root, "public", "data", "participants.csv"), "utf8").trim().split(/\r?\n/);
    const tsvLines = readFileSync(join(root, "public", "data", "rt_data.tsv"), "utf8").trim().split(/\r?\n/);
    const pipeLines = readFileSync(join(root, "public", "data", "participants_pipe.txt"), "utf8").trim().split(/\r?\n/);

    expect(rtLines[0]).toBe("id,cond,rt,correct");
    expect(rtLines).toHaveLength(13);
    expect(participantLines[0]).toBe("id,age,group");
    expect(participantLines).toHaveLength(4);
    expect(tsvLines[0]).toBe("id\tcond\trt\tcorrect");
    expect(tsvLines).toHaveLength(13);
    expect(tsvLines.map((line) => line.split("\t"))).toEqual(
      rtLines.map((line) => line.split(","))
    );
    expect(pipeLines[0]).toBe("id|age|group");
    expect(pipeLines).toHaveLength(4);
    expect(pipeLines.map((line) => line.split("|"))).toEqual(
      participantLines.map((line) => line.split(","))
    );
    const importLesson = LESSONS.find((item) => item.id === "l12");
    expect(importLesson.pages.flatMap((page) => page.b || []).join("\n")).toContain("合成データ");
  });

  it("問題入りCSVが5種類の既知問題を持ち、先頭12行はclean CSVと一致する", () => {
    const cleanLines = readFileSync(join(root, "public", "data", "rt_data.csv"), "utf8").trim().split(/\r?\n/);
    const dirtyLines = readFileSync(join(root, "public", "data", "rt_data_dirty.csv"), "utf8").trimEnd().split(/\r?\n/);
    const rows = dirtyLines.slice(1).map((line) => line.split(","));

    expect(dirtyLines[0]).toBe("id,cond,rt,correct");
    expect(dirtyLines).toHaveLength(18);
    expect(dirtyLines.slice(1, 13)).toEqual(cleanLines.slice(1));
    expect(rows.length - new Set(rows.map((row) => row.join(","))).size).toBe(1);
    expect(rows.filter(([, cond]) => !["cong", "incong"].includes(cond))).toHaveLength(1);
    expect(rows.filter(([, , rt]) => Number(rt) < 100 || Number(rt) > 3000)).toHaveLength(1);
    expect(rows.filter(([id]) => !["P01", "P02", "P03"].includes(id))).toHaveLength(1);
    expect(rows.filter(([, , , correct]) => correct === "")).toHaveLength(1);
  });

  it("独立転移課題は列名を変え、既知問題・期待結果・解答非露出を固定する", () => {
    const rawPath = join(root, "public", "data", "transfer", "switch_trials_dirty.csv");
    const participantPath = join(root, "public", "data", "transfer", "switch_participants.csv");
    const challengePath = join(root, "public", "challenges", "step1-transfer.qmd");
    const checkerPath = join(root, "public", "challenges", "step1_transfer_check.R");
    const rawLines = readFileSync(rawPath, "utf8").trimEnd().split(/\r?\n/);
    const participantLines = readFileSync(participantPath, "utf8").trimEnd().split(/\r?\n/);
    const rows = rawLines.slice(1).map((line) => line.split(","));
    const challenge = readFileSync(challengePath, "utf8");
    const checker = readFileSync(checkerPath, "utf8");

    expect(rawLines[0]).toBe("participant_id,trial_type,response_ms,is_correct,block");
    expect(rawLines).toHaveLength(22);
    expect(rows.length - new Set(rows.map((row) => row.join(","))).size).toBe(1);
    expect(rows.filter(([, type]) => !["repeat", "switch"].includes(type))).toHaveLength(1);
    expect(rows.filter(([, , ms]) => Number(ms) < 100 || Number(ms) > 3000)).toHaveLength(1);
    expect(rows.filter(([id]) => !["A01", "A02", "A03", "A04"].includes(id))).toHaveLength(1);
    expect(rows.filter(([, , , correct]) => correct === "NA")).toHaveLength(1);
    expect(participantLines[0]).toBe("participant_id,training_group,age");
    expect(participantLines).toHaveLength(5);

    for (const fragment of [
      "switch_cost_ms = switch - repeat",
      "data/processed/switch_trials_issues.csv",
      "data/processed/switch_trials_checked.csv",
      "output/switch_costs.csv",
      "output/transfer_note.txt",
      "step1_transfer_check.R",
      "`分析対象:`・`記述結果:`・`解釈の限界:`",
      "1行目に`正答試行`、2行目に`4名全員`、3行目に`一般化`",
    ]) {
      expect(challenge).toContain(fragment);
    }
    expect(challenge).not.toContain("case_when(");
    expect(challenge).not.toContain("pivot_wider(");
    expect(checker).toContain('expected_raw_md5 <- "55e3056af5bda9a8cf86c19df9b0ad6f"');
    expect(checker).toContain("TRANSFER PASS");
  });

  it("NB1が読込・検査・整形・結合・変形・保存・再現確認を一周する", () => {
    const notebook = readFileSync(join(root, "public", "notebooks", "nb1-data.qmd"), "utf8");
    const requiredFragments = [
      "read_csv(",
      "read_tsv(",
      "read_delim(",
      "participants_pipe.txt",
      "rt_data_dirty.csv",
      "readxl::read_excel(",
      "trials.xlsx",
      "batch_01.xlsx",
      "batch_02.xlsx",
      "list.files(",
      "purrr::list_rbind(",
      "stopifnot(",
      "case_when(",
      "anti_join(",
      "data/processed/rt_data_issues.csv",
      "filter(correct)",
      "group_by(cond)",
      "left_join(",
      "relationship = \"many-to-one\"",
      "pivot_wider(",
      "pivot_longer(",
      "write_csv(",
      "write_excel_csv(",
      "output/condition_means.csv",
      "incong_minus_cong",
      "writeLines(",
      "output/analysis_note.txt",
      "母集団へ一般化せず、言語群差も結論しない",
      "step1_analysis.R",
      "sessionInfo()",
    ];

    for (const fragment of requiredFragments) {
      expect(notebook, `NB1に ${fragment} がない`).toContain(fragment);
    }
  });

  it("L12が配布TSV・TXTを相対パスで読み、Excel一時ファイルを除外する", () => {
    const lesson = LESSONS.find((item) => item.id === "l12");
    const delimitedPage = lesson.pages.find((page) => page.t.includes("TSV"));
    const batchPage = lesson.pages.find((page) => page.t.includes("複数のExcel"));

    expect(delimitedPage.code).toContain('"data/rt_data.tsv"');
    expect(delimitedPage.code).toContain('"data/participants_pipe.txt"');
    expect(delimitedPage.code).toContain('delim = "|"');
    expect(lesson.pages.find((page) => page.t.includes("Excelはシート")).out).toContain('"README" "trials"');
    expect(batchPage.code).toContain("ignore.case = TRUE");
    expect(batchPage.code).toContain('!startsWith(basename(files), "~$")');
    expect(batchPage.code).toContain("sort(");
    expect(batchPage.out).toBe("[1]  2 12  2");
  });

  it("L13が問題を記録し、再検査してrawとprocessedを分離する", () => {
    const lesson = LESSONS.find((item) => item.id === "l13");
    const code = lesson.pages.map((page) => page.code || "").join("\n");
    const text = lesson.pages.flatMap((page) => [...(page.b || []), ...(page.a || [])]).join("\n");

    for (const fragment of ["duplicated(", "case_when(", "between(", "anti_join(", "stopifnot(", "data/processed/"]) {
      expect(code, `L13に ${fragment} がない`).toContain(fragment);
    }
    expect(text).toContain("rawは上書きせず");
    expect(text).toContain("教材用の仮ルール");
  });

  it("L16が条件差を限定的に解釈し、スクリプト・CSV・結果メモ・再生成を分けて測る", () => {
    const lesson = LESSONS.find((item) => item.id === "l16");
    const scenarioPage = lesson.pages.find((page) => page.t.includes("依頼へ答える"));

    expect(scenarioPage.code).toContain("incong_minus_cong = incong - cong");
    expect(scenarioPage.code).toContain('"output/analysis_note.txt"');
    expect(scenarioPage.out).toContain("55.05");
    expect(scenarioPage.a.join("\n")).toContain("母集団でも同じ差がある");
    const interpretationExercise = lesson.ex.find((exercise) => exercise.k === "reflect");
    expect(interpretationExercise.rubric).toHaveLength(3);
    expect(interpretationExercise.example).toContain("55.05〜104.55ms");
    expect(lesson.practice.items.map((item) => item.id)).toEqual([
      "analysis-script",
      "summary-csv",
      "interpretation-note",
      "reproduce-output",
    ]);
  });
});


describe("STEP 2公開教材", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const stage = JOURNEY_STAGES.find((item) => item.id === "stats");

  it("画面から案内するデータ・ノート・完成スクリプトがすべて存在する", () => {
    expect(stage.resources).toHaveLength(6);
    for (const resource of stage.resources) {
      expect(
        existsSync(join(root, "public", resource.path)),
        `${resource.label}: public/${resource.path} がない`
      ).toBe(true);
    }
  });

  it("NB2が記述統計・条件分布・参加者内差・保存を一周する", () => {
    const notebook = readFileSync(join(root, "public", "notebooks", "nb2-stats.qmd"), "utf8");
    for (const fragment of [
      "expanded_pilot_trials.csv",
      'source("step2_report_and_transfer.R"',
      "output/descriptive_statistics.csv",
      "output/participant_differences.csv",
      "knitr::include_graphics(",
      "output/condition_distributions.png",
      "output/participant_differences.png",
      "output/exploratory_note.txt",
      "統計的有意差、母集団差、因果効果",
    ]) {
      expect(notebook, `NB2に ${fragment} がない`).toContain(fragment);
    }
  });
});

describe("STEP 5公開教材", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const stage = JOURNEY_STAGES.find((item) => item.id === "brms");

  it("全レッスンから共通データと演習ノートを取得できる", () => {
    expect(stage.resources.map((resource) => resource.path)).toEqual([
      "scripts/step5/step5_data.R",
      "notebooks/nb5-brms.qmd",
      "downloads/learning-stan-research-case.zip",
    ]);
    for (const resource of stage.resources) {
      expect(
        existsSync(join(root, "public", resource.path)),
        `${resource.label}: public/${resource.path} がない`
      ).toBe(true);
    }
  });

  it("L27〜L33は同じ短い初期化コードから開始できる", () => {
    for (const lessonId of stage.lessonIds) {
      const lesson = LESSONS.find((item) => item.id === lessonId);
      expect(lesson.pages[0].code).toContain('source("step5_data.R")');
      expect(lesson.pages[0].code).toContain("library(brms)");
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
      if (l.practiceLadder) {
        texts.push(l.practiceLadder.title, l.practiceLadder.intro);
        for (const step of l.practiceLadder.steps) {
          texts.push(step.label, step.support, step.task, step.criterion);
        }
      }
      if (l.challenge) {
        texts.push(
          l.challenge.title,
          l.challenge.scenario,
          l.challenge.task,
          l.challenge.code,
          ...(l.challenge.hints || []),
          ...(l.challenge.rubric || []),
          l.challenge.example
        );
      }
    }
    for (const t of texts.filter(Boolean)) {
      const count = (String(t).match(/`/g) || []).length;
      expect(count % 2, `バッククォートが奇数個: ${String(t).slice(0, 40)}…`).toBe(0);
    }
  });
});


it("すべての理解問題に永続IDと正の改訂番号がある", () => {
  const ids = LESSONS.flatMap(l => l.ex.map(q => `${l.id}:${q.id}`));
  expect(new Set(ids).size).toBe(ids.length);
  for (const lesson of LESSONS) for (const question of lesson.ex) {
    expect(question.id).toMatch(/^[a-z0-9-]+$/);
    expect(Number.isInteger(question.revision) && question.revision > 0).toBe(true);
  }
});
