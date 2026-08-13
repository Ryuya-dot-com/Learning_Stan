import { describe, expect, it } from "vitest";
import describeDistributions from "./lessons/3-stats/l17-describe-distributions.js";
import grammarOfGraphics from "./lessons/3-stats/l18-grammar-of-graphics.js";
import showIndividuals from "./lessons/3-stats/l19-show-individuals.js";
import reportAndTransfer from "./lessons/3-stats/l20-report-and-transfer.js";

const lessons = [
  describeDistributions,
  grammarOfGraphics,
  showIndividuals,
  reportAndTransfer,
];

function visibleText(lesson) {
  return [
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
}

describe("STEP 2公開レッスン", () => {
  it("4レッスンを意味IDの順で公開する", () => {
    expect(lessons.map((lesson) => lesson.id)).toEqual([
      "step2-describe-distributions",
      "step2-grammar-of-graphics",
      "step2-show-individuals",
      "step2-report-and-transfer",
    ]);
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson]))(
    "%s: 到達目標・基本問題5問・4段階練習・3成果物を持つ",
    (_, lesson) => {
      expect(lesson.pages[0].b.join("\n")).toMatch(/できるようになります/);
      expect(lesson.ex.filter((exercise) => !exercise.reviewLabel)).toHaveLength(5);
      expect(lesson.practiceLadder.steps.map((step) => step.id)).toEqual([
        "imitate",
        "change",
        "recall",
        "transfer",
      ]);
      expect(lesson.practice.items).toHaveLength(lesson.id === "step2-report-and-transfer" ? 2 : 3);
    }
  );

  it.each(lessons.map((lesson) => [lesson.id, lesson]))(
    "%s: 修了条件と分離した段階ヒント付き任意チャレンジを持つ",
    (_, lesson) => {
      expect(lesson.challenge.title.length).toBeGreaterThan(0);
      expect(lesson.challenge.scenario.length).toBeGreaterThan(0);
      expect(lesson.challenge.task.length).toBeGreaterThan(0);
      expect(lesson.challenge.hints).toHaveLength(2);
      expect(lesson.challenge.rubric.length).toBeGreaterThanOrEqual(4);
      expect(lesson.challenge.example.length).toBeGreaterThanOrEqual(80);
      expect(lesson.ex.filter((exercise) => !exercise.reviewLabel)).toHaveLength(5);
    }
  );

  it("V2以降で、それまでの技能を累積復習する", () => {
    expect(lessons.map((lesson) =>
      lesson.ex.filter((exercise) => exercise.reviewLabel).map((exercise) => exercise.reviewLabel)
    )).toEqual([
      [],
      ["V1の復習"],
      ["V1・V2の復習"],
      ["V1〜V3の復習"],
    ]);
  });

  it("欠測・歪み・対応不備・新旧成果物の混在をそれぞれ扱う", () => {
    expect(lessons[0].challenge.scenario).toContain("P07");
    expect(lessons[1].challenge.scenario).toContain("右の歪み");
    expect(lessons[2].challenge.scenario).toContain("重複");
    expect(lessons[3].challenge.scenario).toContain("23名");
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson]))(
    "%s: 学習者画面へ制作・公開判定用の語を出さない",
    (_, lesson) => {
      expect(visibleText(lesson)).not.toMatch(
        /\bL(?:17|18|19|20)\b|draft-unpublished|非公開ドラフト|公開ゲート|releasePrerequisites|初心者観察|初学者観察|学習者観察ゲート|step2-l(?:17|18|19|20)-q\d|問題の正本|assessments\.json|自動検証|自動検査|検証契約|(?:src\/data|content\/step2|examples\/step2)/i
      );
    }
  );
});
