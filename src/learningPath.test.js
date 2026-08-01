import { describe, expect, it } from "vitest";
import { LESSONS } from "./data/lessons/index.js";
import {
  FOUNDATION_LESSON_ID,
  JOURNEY_STAGES,
  LEARNING_LESSON_IDS,
  foundationIsComplete,
  getJourneyState,
  getLessonPathMeta,
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
  it("公開中の番号付きレッスンを、体験→準備→R基礎の順で一度ずつ扱う", () => {
    expect(LEARNING_LESSON_IDS).toEqual(["l1", "l10", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"]);
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
    const allUnderstood = { ...empty, done: understood(LEARNING_LESSON_IDS) };
    expect(getJourneyState(allUnderstood)).toMatchObject({
      stage: { id: "foundation" },
      targetView: { name: "foundation" },
    });
    expect(nextLessonInPath(LESSONS.find((lesson) => lesson.id === "l9"))).toBeNull();
  });

  it("実機確認5項目を満たすと公開中トラックを修了する", () => {
    const practiceIds = LESSONS.find((lesson) => lesson.id === FOUNDATION_LESSON_ID).practice.items.map((item) => item.id);
    const progress = {
      ...empty,
      done: understood(LEARNING_LESSON_IDS),
      practice: { [FOUNDATION_LESSON_ID]: practiceIds },
    };
    expect(foundationIsComplete(progress)).toBe(true);
    expect(getJourneyState(progress).complete).toBe(true);
    expect(JOURNEY_STAGES).toHaveLength(4);
  });

  it("画面上のラベルは内部の旧レッスン番号ではなく学習段階を示す", () => {
    expect(getLessonPathMeta("l1").eyebrow).toBe("体験");
    expect(getLessonPathMeta("l10").eyebrow).toBe("STEP 0");
    expect(getLessonPathMeta("l2").eyebrow).toBe("R基礎 1 / 8");
  });
});
