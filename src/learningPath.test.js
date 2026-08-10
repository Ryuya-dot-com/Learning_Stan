import { describe, expect, it } from "vitest";
import { LESSONS } from "./data/lessons/index.js";
import {
  FOUNDATION_LESSON_ID,
  FOUNDATION_PREREQUISITE_IDS,
  JOURNEY_STAGES,
  LEARNING_LESSON_IDS,
  foundationIsComplete,
  getJourneyState,
  getLessonPathMeta,
  lessonPracticeIsComplete,
  nextLessonInPath,
} from "./learningPath.js";

const empty = { done: {}, first: {}, missed: {}, practice: {} };

function understood(ids) {
  return Object.fromEntries(ids.map((id) => {
    const lesson = LESSONS.find((item) => item.id === id);
    return [id, lesson.ex.map((_, index) => index)];
  }));
}

describe("初心者向け学習パス", () => {
  it("公開中の番号付きレッスンを、R基礎・データ操作・Stanベータの順で一度ずつ扱う", () => {
    expect(LEARNING_LESSON_IDS).toEqual(["l1", "l10", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l11", "l12", "l13", "l14", "l15", "l16", "l34", "l35", "l36", "l37", "l38", "l39", "l40", "l41"]);
    expect([...LEARNING_LESSON_IDS].sort()).toEqual(
      LESSONS.filter((lesson) => lesson.num != null).map((lesson) => lesson.id).sort()
    );
    expect(new Set(LEARNING_LESSON_IDS).size).toBe(LEARNING_LESSON_IDS.length);
  });

  it("新規読者にはインストール不要の体験を最初に案内する", () => {
    expect(getJourneyState(empty)).toMatchObject({
      stage: { id: "trial" },
      targetView: { name: "lesson", id: "l1" },
      cta: "インストール不要で体験を始める",
    });
  });

  it("体験後はL10の環境準備、準備後はL2からの基礎へ進む", () => {
    const afterTrial = { ...empty, done: understood(["l1"]) };
    expect(getJourneyState(afterTrial).targetView).toEqual({ name: "lesson", id: "l10" });

    const afterSetup = { ...empty, done: understood(["l1", "l10"]) };
    expect(getJourneyState(afterSetup).targetView).toEqual({ name: "lesson", id: "l2" });
    expect(nextLessonInPath(LESSONS.find((lesson) => lesson.id === "l1"))?.id).toBe("l10");
    expect(nextLessonInPath(LESSONS.find((lesson) => lesson.id === "l10"))?.id).toBe("l2");
  });

  it("全理解問題の後だけFoundation Checkを次の行動として示す", () => {
    const allUnderstood = { ...empty, done: understood(FOUNDATION_PREREQUISITE_IDS) };
    expect(getJourneyState(allUnderstood)).toMatchObject({
      stage: { id: "foundation" },
      targetView: { name: "foundation" },
    });
    expect(nextLessonInPath(LESSONS.find((lesson) => lesson.id === "l9"))).toBeNull();
  });

  it("Foundation後はSTEP 1へ進み、STEP 1後はStanベータへ進む", () => {
    const foundationPractice = LESSONS.find((lesson) => lesson.id === FOUNDATION_LESSON_ID).practice.items.map((item) => item.id);
    const dataPractice = LESSONS.find((lesson) => lesson.id === "l16").practice.items.map((item) => item.id);
    const afterFoundation = {
      ...empty,
      done: understood(FOUNDATION_PREREQUISITE_IDS),
      practice: { [FOUNDATION_LESSON_ID]: foundationPractice },
    };
    expect(getJourneyState(afterFoundation).targetView).toEqual({ name: "lesson", id: "l11" });

    const progress = {
      ...empty,
      done: understood(LEARNING_LESSON_IDS),
      practice: { [FOUNDATION_LESSON_ID]: foundationPractice, l16: dataPractice },
    };
    expect(foundationIsComplete(progress)).toBe(true);
    expect(lessonPracticeIsComplete(progress, "l16")).toBe(true);
    expect(getJourneyState(progress)).toMatchObject({
      complete: false,
      stage: { id: "stan" },
      targetView: { name: "lesson", id: "l34" },
    });

    const stanPractice = Object.fromEntries(
      LESSONS.filter((lesson) => /^l(?:3[4-9]|4[01])$/.test(lesson.id))
        .map((lesson) => [lesson.id, lesson.practice.items.map((item) => item.id)])
    );
    const complete = {
      ...progress,
      practice: { ...progress.practice, ...stanPractice },
    };
    expect(getJourneyState(complete).complete).toBe(true);
    expect(JOURNEY_STAGES).toHaveLength(6);
  });

  it("L16の理解問題だけ終えても成果物チェックが残っていればL16を案内する", () => {
    const foundationPractice = LESSONS.find((lesson) => lesson.id === FOUNDATION_LESSON_ID).practice.items.map((item) => item.id);
    const progress = {
      ...empty,
      done: understood(LEARNING_LESSON_IDS),
      practice: { [FOUNDATION_LESSON_ID]: foundationPractice },
    };

    expect(getJourneyState(progress)).toMatchObject({
      stage: { id: "data" },
      targetView: { name: "lesson", id: "l16" },
    });
  });

  it("画面上のラベルは内部の旧レッスン番号ではなく学習段階を示す", () => {
    expect(getLessonPathMeta("l1").eyebrow).toBe("体験");
    expect(getLessonPathMeta("l10").eyebrow).toBe("STEP 0");
    expect(getLessonPathMeta("l2").eyebrow).toBe("R基礎 1 / 8");
    expect(getLessonPathMeta("l11").eyebrow).toBe("STEP 1 1 / 6");
    expect(getLessonPathMeta("l34").eyebrow).toBe("STEP 6 1 / 8");
    expect(getLessonPathMeta("l41").badge).toBe("S8");
  });

  it("STEP 1の6レッスンを、同じ分析依頼と固有の作業で接続する", () => {
    const metas = ["l11", "l12", "l13", "l14", "l15", "l16"].map(getLessonPathMeta);

    expect(new Set(metas.map((meta) => meta.caseStudy.title))).toEqual(
      new Set(["認知課題パイロットの分析依頼"])
    );
    expect(new Set(metas.map((meta) => meta.caseStudy.question)).size).toBe(1);
    expect(new Set(metas.map((meta) => meta.caseStudy.task)).size).toBe(6);
    expect(metas[0].caseStudy.question).toContain("incong条件の平均反応時間はcong条件より長いか");
    expect(metas.at(-1).caseStudy.deliverable).toContain("analysis_note.txt");
    expect(metas.at(-1).caseStudy.caution).toContain("母集団への一般化");
    expect(getLessonPathMeta("l2").caseStudy).toBeNull();
  });

  it("STEP 1の冒頭には、そのレッスンで使うダウンロード教材だけを示す", () => {
    const dataStage = JOURNEY_STAGES.find((stage) => stage.id === "data");

    expect(dataStage.resources).toEqual([
      { label: "STEP 1一括スターターZIP", path: "downloads/learning-stan-step1.zip", destination: "ZIPを展開してProjectに指定", primary: true },
      { label: "反応時間CSV", path: "data/rt_data.csv", destination: "data/rt_data.csv" },
      { label: "参加者CSV", path: "data/participants.csv", destination: "data/participants.csv", lessonIds: ["l12", "l13", "l15", "l16"] },
      { label: "問題入りCSV", path: "data/rt_data_dirty.csv", destination: "data/rt_data_dirty.csv", lessonIds: ["l13"] },
      { label: "反応時間TSV", path: "data/rt_data.tsv", destination: "data/rt_data.tsv", lessonIds: ["l12"] },
      { label: "参加者パイプ区切りTXT", path: "data/participants_pipe.txt", destination: "data/participants_pipe.txt", lessonIds: ["l12"] },
      { label: "Excel読込サンプル", path: "data/trials.xlsx", destination: "data/trials.xlsx", lessonIds: ["l12"] },
      { label: "一括Excel 1", path: "data/batches/batch_01.xlsx", destination: "data/batches/batch_01.xlsx", lessonIds: ["l12"] },
      { label: "一括Excel 2", path: "data/batches/batch_02.xlsx", destination: "data/batches/batch_02.xlsx", lessonIds: ["l12"] },
      { label: "Quarto演習ノート", path: "notebooks/nb1-data.qmd", destination: "Project直下" },
      { label: "完成版Rスクリプト", path: "scripts/step1_analysis.R", destination: "Project直下", lessonIds: ["l16"] },
      { label: "発展: 独立転移課題", path: "challenges/step1-transfer.qmd", destination: "Project直下", lessonIds: ["l16"] },
    ]);

    expect(getLessonPathMeta("l11").resources.map((resource) => resource.path)).toEqual([
      "downloads/learning-stan-step1.zip", "data/rt_data.csv", "notebooks/nb1-data.qmd",
    ]);
    expect(getLessonPathMeta("l12").resources.map((resource) => resource.path)).toEqual([
      "downloads/learning-stan-step1.zip",
      "data/rt_data.csv",
      "data/participants.csv",
      "data/rt_data.tsv",
      "data/participants_pipe.txt",
      "data/trials.xlsx",
      "data/batches/batch_01.xlsx",
      "data/batches/batch_02.xlsx",
      "notebooks/nb1-data.qmd",
    ]);
    expect(getLessonPathMeta("l13").resources.map((resource) => resource.path)).toEqual([
      "downloads/learning-stan-step1.zip", "data/rt_data.csv", "data/participants.csv", "data/rt_data_dirty.csv", "notebooks/nb1-data.qmd",
    ]);
    expect(getLessonPathMeta("l14").resources.map((resource) => resource.path)).toEqual([
      "downloads/learning-stan-step1.zip", "data/rt_data.csv", "notebooks/nb1-data.qmd",
    ]);
    expect(getLessonPathMeta("l15").resources.map((resource) => resource.path)).toEqual([
      "downloads/learning-stan-step1.zip", "data/rt_data.csv", "data/participants.csv", "notebooks/nb1-data.qmd",
    ]);
    expect(getLessonPathMeta("l16").resources.map((resource) => resource.path)).toEqual([
      "downloads/learning-stan-step1.zip", "data/rt_data.csv", "data/participants.csv", "notebooks/nb1-data.qmd", "scripts/step1_analysis.R", "challenges/step1-transfer.qmd",
    ]);
  });
});
