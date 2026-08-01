import { LESSONS } from "./data/lessons/index.js";

export const FOUNDATION_LESSON_ID = "l10";

export const JOURNEY_STAGES = Object.freeze([
  {
    id: "trial",
    label: "体験",
    title: "まずRに触れる",
    description: "コードを読み、結果を予想して、Rが何をする道具かをつかみます。",
    time: "5〜10分",
    install: "インストール不要",
    lessonIds: ["l1"],
  },
  {
    id: "setup",
    label: "STEP 0",
    title: "手元で動かす準備",
    description: "RとRStudioを用意し、コードを保存・再実行できる環境を作ります。",
    time: "30〜60分",
    install: "R / RStudioを使用",
    lessonIds: [FOUNDATION_LESSON_ID],
  },
  {
    id: "basics",
    label: "R基礎",
    title: "読み、予想し、確かめる",
    description: "変数から小さなデータ分析まで、8レッスンを順番に練習します。",
    time: "60〜90分",
    install: "RStudioでの実行を推奨",
    lessonIds: ["l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"],
  },
  {
    id: "foundation",
    label: "最終確認",
    title: "Foundation Check",
    description: "自分のPCで、実行・保存・再実行までできることを確かめます。",
    time: "15〜30分",
    install: "RStudioで実践",
    lessonIds: [],
    kind: "foundation",
  },
]);

export const LEARNING_LESSON_IDS = Object.freeze(
  JOURNEY_STAGES.flatMap((stage) => stage.lessonIds)
);

const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));

export function lessonIsUnderstood(progress, lessonOrId) {
  const lesson = typeof lessonOrId === "string" ? lessonById.get(lessonOrId) : lessonOrId;
  if (!lesson) return false;
  return (progress.done?.[lesson.id] || []).length === lesson.ex.length;
}

export function foundationIsComplete(progress) {
  const lesson = lessonById.get(FOUNDATION_LESSON_ID);
  if (!lesson?.practice) return false;
  const checked = progress.practice?.[FOUNDATION_LESSON_ID] || [];
  return lesson.practice.items.every((item) => checked.includes(item.id));
}

export function stageIsComplete(stage, progress) {
  if (stage.kind === "foundation") return foundationIsComplete(progress);
  return stage.lessonIds.every((id) => lessonIsUnderstood(progress, id));
}

function stageCta(stage, progress) {
  const hasProgress = stage.lessonIds.some((id) => (progress.done?.[id] || []).length > 0);
  if (stage.id === "trial") return hasProgress ? "体験のつづきから" : "インストール不要で体験を始める";
  if (stage.id === "setup") return hasProgress ? "環境準備のつづきから" : "R / RStudioの準備へ";
  if (stage.id === "basics") return hasProgress ? "R基礎のつづきから" : "R基礎を始める";
  return "Foundation Checkへ";
}

export function getJourneyState(progress) {
  for (let stageIndex = 0; stageIndex < JOURNEY_STAGES.length; stageIndex += 1) {
    const stage = JOURNEY_STAGES[stageIndex];
    if (stageIsComplete(stage, progress)) continue;

    const lessonId = stage.kind === "foundation"
      ? null
      : stage.lessonIds.find((id) => !lessonIsUnderstood(progress, id));
    const targetView = stage.kind === "foundation"
      ? { name: "foundation" }
      : { name: "lesson", id: lessonId };

    return {
      complete: false,
      stage,
      stageIndex,
      completedStages: stageIndex,
      targetView,
      targetLesson: lessonId ? lessonById.get(lessonId) : null,
      cta: stageCta(stage, progress),
    };
  }

  return {
    complete: true,
    stage: null,
    stageIndex: JOURNEY_STAGES.length,
    completedStages: JOURNEY_STAGES.length,
    targetView: null,
    targetLesson: null,
    cta: null,
  };
}

export function getStageStatus(stage, progress) {
  const journey = getJourneyState(progress);
  const stageIndex = JOURNEY_STAGES.findIndex((item) => item.id === stage.id);
  if (journey.complete || stageIndex < journey.stageIndex) return "done";
  return stageIndex === journey.stageIndex ? "current" : "upcoming";
}

export function getLessonPathMeta(lessonOrId) {
  const lesson = typeof lessonOrId === "string" ? lessonById.get(lessonOrId) : lessonOrId;
  if (!lesson) return null;
  const stage = JOURNEY_STAGES.find((item) => item.lessonIds.includes(lesson.id));
  if (!stage) return null;
  const index = stage.lessonIds.indexOf(lesson.id);
  return {
    stage,
    index,
    eyebrow: stage.lessonIds.length === 1
      ? stage.label
      : `${stage.label} ${index + 1} / ${stage.lessonIds.length}`,
    badge: stage.id === "trial" ? "体験" : stage.id === "setup" ? "準備" : `R${index + 1}`,
  };
}

export function nextLessonInPath(lesson, lessons = LESSONS) {
  const index = LEARNING_LESSON_IDS.indexOf(lesson.id);
  if (index >= 0) {
    const nextId = LEARNING_LESSON_IDS[index + 1];
    return nextId ? lessons.find((item) => item.id === nextId) || null : null;
  }
  if (lesson.num != null) return null;
  const sectionLessons = lessons.filter((item) => item.section === lesson.section);
  const sectionIndex = sectionLessons.findIndex((item) => item.id === lesson.id);
  return sectionLessons[sectionIndex + 1] || null;
}

export function isLastLearningLesson(lesson) {
  return lesson?.id === LEARNING_LESSON_IDS.at(-1);
}
