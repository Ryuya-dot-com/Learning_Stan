import { LESSONS } from "./data/lessons/index.js";

export const FOUNDATION_LESSON_ID = "l10";

export const JOURNEY_STAGES = Object.freeze([
  {
    id: "trial",
    label: "体験",
    title: "まずRに触れる",
    description: "コードをまね、1か所変え、見ずに作り、別の値でも使ってRの役割をつかみます。",
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
    description: "変数から小さなデータ分析まで、各技能を4段階でくり返します。",
    time: "60〜90分",
    install: "RStudioでの実行を推奨",
    lessonIds: ["l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"],
  },
  {
    id: "foundation",
    label: "基礎確認",
    title: "Foundation Check",
    description: "自分のPCで、実行・保存・再実行までできることを確かめます。",
    time: "15〜30分",
    install: "RStudioで実践",
    lessonIds: [],
    kind: "foundation",
  },
  {
    id: "data",
    label: "STEP 1",
    title: "表形式データを読み、整える",
    description: "読込・検査・集計・保存を、まねる→変える→見ずに作る→別の場面で使う順に練習します。",
    time: "2〜3時間",
    install: "RStudioとtidyverseを使用",
    lessonIds: ["l11", "l12", "l13", "l14", "l15", "l16"],
    practiceLessonId: "l16",
    notebook: "nb1-data.qmd",
    caseStudy: {
      title: "認知課題パイロットの分析依頼",
      context: "研究室で、文字の意味と表示色が一致する条件（cong）と一致しない条件（incong）の反応時間を3名から集めました。",
      question: "正答試行では、この小さなデータ内でincong条件の平均反応時間はcong条件より長いか。",
      deliverable: "output/condition_means.csv と output/analysis_note.txt",
      caution: "教材用の合成パイロットデータです。母集団への一般化や、bilingual・monolingual間の差は結論しません。",
      tasks: {
        l11: "依頼を再実行できるよう、データと処理を上から順に読める流れへ組み立てます。",
        l12: "届いたCSV・区切りテキスト・Excelが、想定した行数・列名・列型で読めたか確かめます。",
        l13: "rawを保ったまま問題行を記録し、分析へ進める12試行を品質ゲートで確定します。",
        l14: "正答試行を参加者×条件で集計し、条件差を比べるための平均と採用件数を作ります。",
        l15: "参加者属性を結合し、年齢欠損が何人・何試行に影響するかを区別します。",
        l16: "incong−congの差を計算し、再生成できるCSVと限界を明記した結果メモを納品します。",
      },
    },
    resources: [
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
    ],
  },
  {
    id: "stats",
    label: "STEP 2",
    title: "分布と個人差を図で確かめる",
    description: "試行と参加者を区別し、数値要約・分布図・対応図を使って、観察結果と限界を報告します。各レッスン末に任意の発展問題があります。",
    time: "3〜4時間",
    install: "RStudioとtidyverseを使用",
    lessonIds: [
      "step2-describe-distributions",
      "step2-grammar-of-graphics",
      "step2-show-individuals",
      "step2-report-and-transfer",
    ],
    requiredPracticeLessonIds: [
      "step2-describe-distributions",
      "step2-grammar-of-graphics",
      "step2-show-individuals",
      "step2-report-and-transfer",
    ],
    notebook: "nb2-stats.qmd",
    caseStudy: {
      label: "STEP 2 ケーススタディ",
      title: "拡大パイロットの探索報告",
      context: "24名分の合成データについて、正答試行の反応時間を参加者単位で要約し、条件別の分布と一人ひとりの違いが分かる図を作ります。",
      question: "この24名では、2条件の分布と参加者内の差にどのような特徴が見られるか。",
      deliverable: "3つのCSV・2つのPNG・限界を記した探索メモ",
      caution: "教材用の合成データです。図と記述統計だけから、統計的有意差・母集団差・因果効果は結論しません。",
      tasks: {
        "step2-describe-distributions": "試行数と参加者数を区別し、参加者×条件の48行から中央値・四分位範囲・参加者内差を要約します。",
        "step2-grammar-of-graphics": "箱ひげと全参加者の点を重ね、条件ごとの分布を隠さず示します。",
        "step2-show-individuals": "同じ参加者の2条件を線で結び、変化方向と差の大きさを示します。",
        "step2-report-and-transfer": "2図・3CSV・探索メモを一括再生成し、観察結果と解釈の限界を分けて報告します。",
      },
    },
    resources: [
      { label: "拡大パイロットCSV", path: "data/step2/expanded_pilot_trials.csv", destination: "data/expanded_pilot_trials.csv" },
      { label: "Quarto演習ノート", path: "notebooks/nb2-stats.qmd", destination: "Project直下" },
      { label: "記述統計の完成版Rスクリプト", path: "scripts/step2/step2_descriptive.R", destination: "Project直下", lessonIds: ["step2-describe-distributions", "step2-report-and-transfer"] },
      { label: "条件分布図の完成版Rスクリプト", path: "scripts/step2/step2_condition_plot.R", destination: "Project直下", lessonIds: ["step2-grammar-of-graphics", "step2-report-and-transfer"] },
      { label: "参加者内差図の完成版Rスクリプト", path: "scripts/step2/step2_participant_differences_plot.R", destination: "Project直下", lessonIds: ["step2-show-individuals", "step2-report-and-transfer"] },
      { label: "STEP 2一括再生成スクリプト", path: "scripts/step2/step2_report_and_transfer.R", destination: "Project直下", lessonIds: ["step2-report-and-transfer"] },
    ],
  },
  {
    id: "simulation",
    label: "STEP 3",
    title: "回帰から確率モデルへ進む",
    description: "係数と交互作用を予測値へ戻し、乱数による生成と尤度を、短いRコードで確かめます。",
    time: "3〜4時間",
    install: "RStudioを使用",
    lessonIds: ["l21", "l22", "l23"],
    requiredPracticeLessonIds: ["l21", "l22", "l23"],
    notebook: "nb3-sim.qmd",
    resources: [
      { label: "STEP 3演習ノート", path: "notebooks/nb3-sim.qmd", destination: "Project直下" },
    ],
  },
  {
    id: "bayes",
    label: "STEP 4",
    title: "ベイズ更新を生成過程として理解する",
    description: "prior・尤度・posteriorを図とdrawで結び、事前予測、感度分析、MCMCの役割を区別します。",
    time: "3〜5時間",
    install: "RStudioを使用。最後にbrms環境を確認",
    lessonIds: ["l24", "l25", "l26"],
    requiredPracticeLessonIds: ["l24", "l25", "l26"],
    notebook: "nb4-bayes.qmd",
    resources: [
      { label: "STEP 4演習ノート", path: "notebooks/nb4-bayes.qmd", destination: "Project直下" },
    ],
  },
  {
    id: "brms",
    label: "STEP 5",
    title: "brmsでモデルを作り、疑い、比べる",
    description: "連続・反復測定・二値・順序・件数・反応時間を扱い、診断、PPC、LOOから生成Stanコードの読解まで進みます。",
    time: "8〜12時間",
    install: "R / brms / CmdStanを使用",
    lessonIds: ["l27", "l28", "l29", "l30", "l31", "l32", "l33"],
    requiredPracticeLessonIds: ["l27", "l28", "l29", "l30", "l31", "l32", "l33"],
    notebook: "nb5-brms.qmd",
    resources: [
      { label: "STEP 5共通データ（先にダウンロード）", path: "scripts/step5/step5_data.R", destination: "Project直下（step5_data.R）" },
      { label: "STEP 5演習ノート", path: "notebooks/nb5-brms.qmd", destination: "Project直下" },
    ],
  },
  {
    id: "stan",
    label: "STEP 6",
    title: "Stanでモデルを実装・診断・報告する",
    description: "STEP 3〜5で使ったモデルをStanコードへ展開し、実装・計算診断・予測検査・報告を自分で行います。",
    time: "8〜12時間",
    install: "R / CmdStanR / CmdStanを使用",
    lessonIds: ["l34", "l35", "l36", "l37", "l38", "l39", "l40", "l41"],
    requiredPracticeLessonIds: ["l34", "l35", "l36", "l37", "l38", "l39", "l40", "l41"],
    notebook: "nb6-stan.qmd",
  },
]);

export const LEARNING_LESSON_IDS = Object.freeze(
  JOURNEY_STAGES.flatMap((stage) => stage.lessonIds)
);

export const FOUNDATION_PREREQUISITE_IDS = Object.freeze(
  JOURNEY_STAGES
    .slice(0, JOURNEY_STAGES.findIndex((stage) => stage.kind === "foundation"))
    .flatMap((stage) => stage.lessonIds)
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

export function lessonPracticeIsComplete(progress, lessonOrId) {
  const lesson = typeof lessonOrId === "string" ? lessonById.get(lessonOrId) : lessonOrId;
  if (!lesson?.practice) return true;
  const checked = progress.practice?.[lesson.id] || [];
  return lesson.practice.items.every((item) => checked.includes(item.id));
}

export function stageIsComplete(stage, progress) {
  if (stage.kind === "foundation") return foundationIsComplete(progress);
  const understood = stage.lessonIds.every((id) => lessonIsUnderstood(progress, id));
  const requiredPracticeLessonIds = stage.requiredPracticeLessonIds
    || (stage.practiceLessonId ? [stage.practiceLessonId] : []);
  return understood && requiredPracticeLessonIds.every((id) => lessonPracticeIsComplete(progress, id));
}

function stageCta(stage, progress) {
  const hasProgress = stage.lessonIds.some((id) => (progress.done?.[id] || []).length > 0);
  if (stage.id === "trial") return hasProgress ? "体験のつづきから" : "インストール不要で体験を始める";
  if (stage.id === "setup") return hasProgress ? "環境準備のつづきから" : "R / RStudioの準備へ";
  if (stage.id === "basics") return hasProgress ? "R基礎のつづきから" : "R基礎を始める";
  if (stage.id === "data") return hasProgress ? "STEP 1のつづきから" : "STEP 1を始める";
  if (stage.id === "stats") return hasProgress ? "STEP 2のつづきから" : "STEP 2を始める";
  if (stage.id === "simulation") return hasProgress ? "STEP 3のつづきから" : "STEP 3を始める";
  if (stage.id === "bayes") return hasProgress ? "STEP 4のつづきから" : "STEP 4を始める";
  if (stage.id === "brms") return hasProgress ? "STEP 5のつづきから" : "STEP 5を始める";
  if (stage.id === "stan") return hasProgress ? "Stanベータのつづきから" : "Stanベータを始める";
  return "Foundation Checkへ";
}

export function getJourneyState(progress) {
  for (let stageIndex = 0; stageIndex < JOURNEY_STAGES.length; stageIndex += 1) {
    const stage = JOURNEY_STAGES[stageIndex];
    if (stageIsComplete(stage, progress)) continue;

    const requiredPracticeLessonIds = stage.requiredPracticeLessonIds
      || (stage.practiceLessonId ? [stage.practiceLessonId] : []);
    const lessonId = stage.kind === "foundation"
      ? null
      : stage.lessonIds.find((id) => !lessonIsUnderstood(progress, id))
        || requiredPracticeLessonIds.find((id) => !lessonPracticeIsComplete(progress, id));
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
  const caseStudy = stage.caseStudy
    ? Object.fromEntries(
        Object.entries(stage.caseStudy)
          .filter(([key]) => key !== "tasks")
          .concat([["task", stage.caseStudy.tasks?.[lesson.id]]])
      )
    : null;
  return {
    stage,
    index,
    caseStudy,
    resources: (stage.resources || []).filter(
      (resource) => !resource.lessonIds || resource.lessonIds.includes(lesson.id)
    ),
    eyebrow: stage.lessonIds.length === 1
      ? stage.label
      : `${stage.label} ${index + 1} / ${stage.lessonIds.length}`,
    badge: stage.id === "trial"
      ? "体験"
      : stage.id === "setup"
        ? "準備"
        : stage.id === "basics"
          ? `R${index + 1}`
          : stage.id === "stan"
            ? `S${index + 1}`
            : stage.id === "stats"
              ? `V${index + 1}`
              : stage.id === "simulation"
                ? `P${index + 1}`
                : stage.id === "bayes"
                  ? `B${index + 1}`
                  : stage.id === "brms"
                    ? `M${index + 1}`
                    : `D${index + 1}`,
  };
}

export function nextLessonInPath(lesson, lessons = LESSONS) {
  const stageIndex = JOURNEY_STAGES.findIndex((stage) => stage.lessonIds.includes(lesson.id));
  if (stageIndex >= 0) {
    const stage = JOURNEY_STAGES[stageIndex];
    const lessonIndex = stage.lessonIds.indexOf(lesson.id);
    const nextInStage = stage.lessonIds[lessonIndex + 1];
    if (nextInStage) return lessons.find((item) => item.id === nextInStage) || null;
    const nextStage = JOURNEY_STAGES[stageIndex + 1];
    if (nextStage?.kind === "foundation") return null;
    const nextId = nextStage?.lessonIds[0];
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

export function lessonLeadsToFoundation(lesson) {
  const basics = JOURNEY_STAGES.find((stage) => stage.id === "basics");
  return lesson?.id === basics?.lessonIds.at(-1);
}
