// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { nextLessonOf } from "./App.jsx";
import { LESSONS } from "./data/lessons/index.js";
import { serializeProgress } from "./progress.js";

window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

async function openLesson1(user) {
  await user.click(screen.getByRole("button", { name: /インストール不要で体験を始める|体験のつづきから/ }));
  await advanceToLesson1Exercises(user);
}

async function advanceToLesson1Exercises(user) {
  for (let i = 0; i < 3; i += 1) {
    await user.click(screen.getByRole("button", { name: "次へ →" }));
  }
  for (const name of ["1. まねる", "2. ひとつ変える", "3. 見ずに作る", "4. 別の場面で使う"]) {
    const checkbox = screen.getByRole("checkbox", { name });
    if (!checkbox.checked) await user.click(checkbox);
  }
  await user.click(screen.getByRole("button", { name: "次へ →" }));
}

async function finishLesson1(user) {
  await user.click(screen.getByRole("button", { name: /print/ }));
  await user.click(screen.getByRole("button", { name: "次へ →" }));
  await user.click(screen.getByRole("button", { name: /\[1\] "R"/ }));
  await user.click(screen.getByRole("button", { name: "次へ →" }));
  await user.click(screen.getByRole("button", { name: /統計解析・データ分析/ }));
  await user.click(screen.getByRole("button", { name: "次へ →" }));
  await completeReflection(user);
  await user.click(screen.getByRole("button", { name: "まとめへ" }));
}

async function completeReflection(user) {
  await user.type(
    screen.getByRole("textbox", { name: /自分の説明/ }),
    "Rは統計解析に使う言語で、コードを実行すると計算や表示の結果が返ります。"
  );
  await user.click(screen.getByRole("button", { name: "評価基準を見る" }));
  for (const checkbox of screen.getAllByRole("checkbox")) await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: "この基準を満たした" }));
}

async function tabTo(user, role, options) {
  const target = screen.getByRole(role, options);
  for (let i = 0; i < 80 && document.activeElement !== target; i += 1) {
    await user.tab();
  }
  expect(document.activeElement).toBe(target);
  return target;
}

async function tabToAndActivate(user, role, options) {
  await tabTo(user, role, options);
  await user.keyboard("{Enter}");
}

function completedExercises(ids) {
  return Object.fromEntries(ids.map((id) => {
    const lesson = LESSONS.find((item) => item.id === id);
    return [id, lesson.ex.map((_, index) => index)];
  }));
}

describe("学習進捗", () => {
  it("初回正解と修了済み問題への再訪を正しく扱う", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openLesson1(user);
    await user.click(screen.getByRole("button", { name: /print/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await user.click(screen.getByRole("button", { name: "← 前へ" }));

    expect(screen.getByText("クリア済み ✓")).toBeTruthy();
    expect(screen.getByRole("button", { name: /print/ }).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await user.click(screen.getByRole("button", { name: /\[1\] "R"/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await user.click(screen.getByRole("button", { name: /統計解析・データ分析/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await completeReflection(user);
    await user.click(screen.getByRole("button", { name: "まとめへ" }));

    expect(screen.getByText(/うち 4 問は一発クリアです!/)).toBeTruthy();
  });

  it("誤答後に画面を移動しても、その問題を初見正解に数えない", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openLesson1(user);

    await user.click(screen.getByRole("button", { name: /echo/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await user.click(screen.getByRole("button", { name: "← 前へ" }));

    // ホームへ戻ってレッスンを開き直しても、誤答履歴は失われない。
    await user.click(screen.getByRole("button", { name: "← 学習ホーム" }));
    await openLesson1(user);
    await finishLesson1(user);
    expect(screen.getByText(/うち 3 問は一発クリアです!/)).toBeTruthy();
    expect(screen.queryByText(/うち 4 問は一発クリアです!/)).toBeNull();
  });

  it("リセットすると誤答履歴を含む進捗を消去する", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openLesson1(user);
    await user.click(screen.getByRole("button", { name: /echo/ }));
    await user.click(screen.getByRole("button", { name: "← 学習ホーム" }));
    await user.click(screen.getByRole("button", { name: "進みぐあいをリセット" }));
    await user.click(screen.getByRole("button", { name: "本当にリセットする(進みぐあいが消えます)" }));
    await waitFor(() => expect(window.localStorage.getItem("learning-stan.progress")).toBeNull());

    await openLesson1(user);
    await finishLesson1(user);
    expect(screen.getByText(/うち 4 問は一発クリアです!/)).toBeTruthy();
  });

  it("リロード相当の再マウント後も進捗を復元する", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);

    await openLesson1(user);
    await user.click(screen.getByRole("button", { name: /print/ }));
    await waitFor(() => expect(window.localStorage.getItem("learning-stan.progress")).not.toBeNull());
    firstRender.unmount();

    render(<App />);
    await advanceToLesson1Exercises(user);
    expect(screen.getByText("クリア済み ✓")).toBeTruthy();
    expect(screen.getByRole("button", { name: /print/ }).disabled).toBe(true);
  });

  it("壊れた保存データを警告し、自動では上書きしない", async () => {
    window.localStorage.setItem("learning-stan.progress", "{broken-json");
    render(<App />);

    expect(screen.getByRole("status").textContent).toContain("上書きせず保護");
    await waitFor(() => {
      expect(window.localStorage.getItem("learning-stan.progress")).toBe("{broken-json");
    });
  });

  it("過大な保存ファイルを読み込まず拒否する", async () => {
    const user = userEvent.setup();
    render(<App />);
    const oversized = new File([new Uint8Array(1024 * 1024 + 1)], "progress.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("保存データを読み込む"), oversized);

    expect(screen.getByRole("status").textContent).toContain("1 MB以下");
  });

  it("記述回答を消した後は自己確認を完了扱いにしない", async () => {
    const user = userEvent.setup();
    render(<App />);

    await openLesson1(user);
    await user.click(screen.getByRole("button", { name: /print/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await user.click(screen.getByRole("button", { name: /\[1\] "R"/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    await user.click(screen.getByRole("button", { name: /統計解析・データ分析/ }));
    await user.click(screen.getByRole("button", { name: "次へ →" }));

    const answer = screen.getByRole("textbox", { name: /自分の説明/ });
    await user.type(answer, "Rは統計解析に使う言語で、コードを実行すると結果が返ります。");
    await user.click(screen.getByRole("button", { name: "評価基準を見る" }));
    await user.clear(answer);
    for (const checkbox of screen.getAllByRole("checkbox")) await user.click(checkbox);

    const confirm = screen.getByRole("button", { name: "この基準を満たした" });
    expect(confirm.disabled).toBe(true);
    expect(screen.queryByText(/説明の自己確認が完了/)).toBeNull();

    await user.type(answer, "Rは統計解析に使う言語で、コードを実行すると結果が返ります。");
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);
    expect(screen.getByText(/説明の自己確認が完了/)).toBeTruthy();
  });

  it("4段階練習を上から解除し、自己記録を理解済みと混同しない", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "インストール不要で体験を始める" }));
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "次へ →" }));
    }

    const next = screen.getByRole("button", { name: "4段階を上から実行" });
    const imitate = screen.getByRole("checkbox", { name: "1. まねる" });
    const change = screen.getByRole("checkbox", { name: "2. ひとつ変える" });
    const recall = screen.getByRole("checkbox", { name: "3. 見ずに作る" });
    const transfer = screen.getByRole("checkbox", { name: "4. 別の場面で使う" });

    expect(imitate.disabled).toBe(false);
    expect(change.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    await user.click(imitate);
    expect(change.disabled).toBe(false);
    await user.click(change);
    await user.click(recall);
    await user.click(transfer);
    expect(screen.getByRole("button", { name: "次へ →" }).disabled).toBe(false);
    expect(screen.queryByText("理解済み")).toBeNull();

    await user.click(change);
    expect(recall.checked).toBe(false);
    expect(transfer.checked).toBe(false);
    expect(recall.disabled).toBe(true);
  });
});

describe("レッスン遷移", () => {
  it("最後のR基礎レッスンからFoundation Checkを飛ばして進まない", () => {
    const lastLearningLesson = LESSONS.find((lesson) => lesson.id === "l9");

    expect(nextLessonOf(lastLearningLesson)).toBeNull();
  });

  it("画面をURLへ反映し、履歴イベントから復元する", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "インストール不要で体験を始める" }));
    expect(window.location.hash).toBe("#/lesson/l1");

    act(() => {
      window.history.pushState(null, "", "#/cheat");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("heading", { name: "R チートシート" })).toBeTruthy();
    expect(window.location.hash).toBe("#/cheat");
  });

  it("共有URLから直接レッスンを開き、遷移後に本文へフォーカスする", async () => {
    window.history.replaceState(null, "", "#/lesson/l2");
    render(<App />);

    expect(screen.getByText("R基礎 1 / 8")).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "変数と計算", level: 1 }));
    });
    expect(document.title).toContain("変数");
  });

  it("STEP 1レッスンの冒頭から共通教材を直接ダウンロードできる", () => {
    window.history.replaceState(null, "", "#/lesson/l12");
    render(<App />);

    expect(screen.getByText("初回は一括ZIPを展開すると、必要なフォルダとファイルが揃います。個別に取得する場合は、表示したProject内の保存先へ置いてください。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "まずはこちら: STEP 1一括スターターZIPをダウンロード" }).getAttribute("href")).toContain("/downloads/learning-stan-step1.zip");
    expect(screen.getByRole("link", { name: "↓ 反応時間CSVをダウンロード" }).getAttribute("href")).toContain("/data/rt_data.csv");
    expect(screen.getByRole("link", { name: "↓ 参加者CSVをダウンロード" }).getAttribute("href")).toContain("/data/participants.csv");
    expect(screen.getByRole("link", { name: "↓ 反応時間TSVをダウンロード" }).getAttribute("href")).toContain("/data/rt_data.tsv");
    expect(screen.getByRole("link", { name: "↓ 参加者パイプ区切りTXTをダウンロード" }).getAttribute("href")).toContain("/data/participants_pipe.txt");
    expect(screen.getByRole("link", { name: "↓ Excel読込サンプルをダウンロード" }).getAttribute("href")).toContain("/data/trials.xlsx");
    expect(screen.getByRole("link", { name: "↓ 一括Excel 1をダウンロード" }).getAttribute("href")).toContain("/data/batches/batch_01.xlsx");
    expect(screen.getByRole("link", { name: "↓ 一括Excel 2をダウンロード" }).getAttribute("href")).toContain("/data/batches/batch_02.xlsx");
    expect(screen.getByRole("link", { name: "↓ Quarto演習ノートをダウンロード" }).getAttribute("href")).toContain("/notebooks/nb1-data.qmd");
    expect(screen.getByRole("heading", { name: "認知課題パイロットの分析依頼" })).toBeTruthy();
    expect(screen.getByText("研究上の問い")).toBeTruthy();
    expect(screen.getByText("届いたCSV・区切りテキスト・Excelが、想定した行数・列名・列型で読めたか確かめます。")).toBeTruthy();
    expect(screen.getByText("output/condition_means.csv と output/analysis_note.txt")).toBeTruthy();
  });

  it("STEP 2を共有URLから開き、学習者向けの教材とケースを表示する", () => {
    window.history.replaceState(null, "", "#/lesson/step2-describe-distributions");
    render(<App />);

    expect(screen.getByRole("heading", { name: "分析単位を決めて分布を要約する", level: 1 })).toBeTruthy();
    expect(screen.getByText("STEP 2 1 / 4")).toBeTruthy();
    expect(screen.getByText("STEP 2 ケーススタディ")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "拡大パイロットの探索報告" })).toBeTruthy();
    expect(screen.getByText("必要なファイルをダウンロードし、表示したProject内の保存先へ置いてください。")).toBeTruthy();
    expect(screen.queryByText(/一括ZIP/)).toBeNull();
    expect(screen.getByRole("link", { name: "↓ 拡大パイロットCSVをダウンロード" }).getAttribute("href")).toContain("/data/step2/expanded_pilot_trials.csv");
    expect(screen.getByRole("link", { name: "↓ Quarto演習ノートをダウンロード" }).getAttribute("href")).toContain("/notebooks/nb2-stats.qmd");
    expect(screen.getByRole("link", { name: "↓ 記述統計の完成版Rスクリプトをダウンロード" }).getAttribute("href")).toContain("/scripts/step2/step2_descriptive.R");
    expect(document.body.textContent).not.toMatch(/\bL(?:17|18|19|20)\b|公開ゲート|問題の正本|assessments\.json|非公開ドラフト/);
  });

  it("STEP 2の任意チャレンジは段階ヒントと自己評価を持ち、修了条件へ混ぜない", async () => {
    const user = userEvent.setup();
    const lessonId = "step2-describe-distributions";
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({
        done: completedExercises([lessonId]),
        first: {},
        missed: {},
        practice: {},
      })
    );
    window.history.replaceState(null, "", `#/lesson/${lessonId}`);
    render(<App />);

    expect(screen.getByRole("heading", { name: "成果物チェック" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "次へ →" }));

    expect(screen.getByText("任意チャレンジ")).toBeTruthy();
    expect(screen.getByText("歯応えあり・修了条件には含みません")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "欠測と試行数の違いを見落とさない" })).toBeTruthy();
    expect(screen.getByText("段階ヒント 1")).toBeTruthy();
    expect(screen.getByText("段階ヒント 2")).toBeTruthy();

    const reveal = screen.getByRole("button", { name: "評価の観点と解答例を見る" });
    expect(reveal.disabled).toBe(true);
    await user.type(
      screen.getByRole("textbox", { name: "自分の設計と判断（本文は保存されません）" }),
      "参加者と条件の組み合わせごとに件数を確認します。欠測した参加者は差の計算から分け、条件別の人数と除外理由を探索メモに明記します。存在しない値をゼロには置き換えません。"
    );
    expect(reveal.disabled).toBe(false);
    await user.click(reveal);
    expect(screen.getByText("評価の観点")).toBeTruthy();
    expect(screen.getByText("解答例")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "まとめへ" }));
    expect(screen.getByRole("button", { name: "実践チェックへすすむ" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("learning-stan.progress"))).not.toHaveProperty("challenge");
  });

  it("STEP 2の累積復習を基本問題と区別して表示する", async () => {
    const user = userEvent.setup();
    const lessonId = "step2-grammar-of-graphics";
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({
        done: completedExercises([lessonId]),
        first: {},
        missed: {},
        practice: {},
      })
    );
    window.history.replaceState(null, "", `#/lesson/${lessonId}`);
    render(<App />);

    expect(screen.getByRole("heading", { name: "成果物チェック" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "← 前へ" }));

    expect(screen.getByText("累積復習: V1の復習")).toBeTruthy();
    expect(screen.getByText(/図の1点を「1参加者×1条件の平均」にする/)).toBeTruthy();
    expect(screen.queryByText("練習問題 6 / 6")).toBeNull();
  });

  it("L13では品質チェックに必要な教材だけを先に示す", () => {
    window.history.replaceState(null, "", "#/lesson/l13");
    render(<App />);

    expect(screen.getByRole("link", { name: "↓ 問題入りCSVをダウンロード" }).getAttribute("href")).toContain("/data/rt_data_dirty.csv");
    expect(screen.getByRole("link", { name: "↓ 参加者CSVをダウンロード" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "↓ 反応時間CSVをダウンロード" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "↓ Excel読込サンプルをダウンロード" })).toBeNull();
  });

  it("L16では完成版RスクリプトをProject直下へダウンロードできる", () => {
    window.history.replaceState(null, "", "#/lesson/l16");
    render(<App />);

    const script = screen.getByRole("link", { name: "↓ 完成版Rスクリプトをダウンロード" });
    expect(script.getAttribute("href")).toContain("/scripts/step1_analysis.R");
    expect(script.textContent).toContain("保存先: Project直下");
    expect(screen.getByRole("link", { name: "↓ 発展: 独立転移課題をダウンロード" }).getAttribute("href")).toContain("/challenges/step1-transfer.qmd");
  });

  it("未知のURLを正規のホームURLへ戻す", async () => {
    window.history.replaceState(null, "", "#/lesson/not-found");
    render(<App />);

    expect(screen.getByRole("heading", { name: "はじめてのRとStan" })).toBeTruthy();
    await waitFor(() => expect(window.location.hash).toBe("#/"));
  });

  it("キーボードだけでレッスン1を完走できる", async () => {
    const user = userEvent.setup();
    render(<App />);

    await tabToAndActivate(user, "button", { name: "インストール不要で体験を始める" });
    for (let i = 0; i < 3; i += 1) {
      await tabToAndActivate(user, "button", { name: "次へ →" });
    }
    for (const name of ["1. まねる", "2. ひとつ変える", "3. 見ずに作る", "4. 別の場面で使う"]) {
      await tabTo(user, "checkbox", { name });
      await user.keyboard(" ");
    }
    await tabToAndActivate(user, "button", { name: "次へ →" });
    await tabToAndActivate(user, "button", { name: /print/ });
    await tabToAndActivate(user, "button", { name: "次へ →" });
    await tabToAndActivate(user, "button", { name: /\[1\] "R"/ });
    await tabToAndActivate(user, "button", { name: "次へ →" });
    await tabToAndActivate(user, "button", { name: /統計解析・データ分析/ });
    await tabToAndActivate(user, "button", { name: "次へ →" });
    await tabTo(user, "textbox", { name: /自分の説明/ });
    await user.keyboard("Rは統計解析に使う言語で、コードを実行すると計算結果が返ります。");
    await tabToAndActivate(user, "button", { name: "評価基準を見る" });
    for (const checkbox of screen.getAllByRole("checkbox")) {
      await tabTo(user, "checkbox", { name: checkbox.getAttribute("aria-label") || checkbox.parentElement.textContent });
      await user.keyboard(" ");
    }
    await tabToAndActivate(user, "button", { name: "この基準を満たした" });
    await tabToAndActivate(user, "button", { name: "まとめへ" });

    expect(screen.getByRole("heading", { name: "体験 修了!" })).toBeTruthy();
  });

  it("Stanベータを共有URLから開き、段階・本文・反復練習を表示する", () => {
    window.history.replaceState(null, "", "#/lesson/l34");
    render(<App />);

    expect(screen.getByRole("heading", { name: "RからStanへ――実行経路とデータ契約", level: 1 })).toBeTruthy();
    expect(screen.getByText("STEP 6 1 / 8")).toBeTruthy();
    expect(screen.getByText(/R、CmdStanR、コンパイル済みStanモデル/)).toBeTruthy();
  });

});

describe("初心者向けホーム導線", () => {
  it("体験後は旧番号に関係なくSTEP 0を次の一手として示す", () => {
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({ done: completedExercises(["l1"]), first: {}, missed: {}, practice: {} })
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "次にすること: RとRStudioを手元に入れる" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "R / RStudioの準備へ" })).toBeTruthy();
  });

  it("STEP 0後はR基礎の最初へ進む", () => {
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({ done: completedExercises(["l1", "l10"]), first: {}, missed: {}, practice: {} })
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "次にすること: 変数と計算" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "R基礎を始める" })).toBeTruthy();
  });

  it("全理解問題の後はFoundation Checkへ案内する", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({ done: completedExercises(LESSONS.map((lesson) => lesson.id)), first: {}, missed: {}, practice: {} })
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Foundation Checkへ" }));

    expect(window.location.hash).toBe("#/foundation-check");
    expect(screen.getByRole("heading", { name: "Foundation Check" })).toBeTruthy();
    expect(screen.queryByText("先にR基礎まで終えるのがおすすめです")).toBeNull();
  });

  it("STEP 6までの成果物確認を終えると復習と演習ノートを示す", () => {
    const completedPractice = Object.fromEntries(
      LESSONS.filter((lesson) => lesson.practice)
        .map((lesson) => [lesson.id, lesson.practice.items.map((item) => item.id)])
    );
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({
        done: completedExercises(LESSONS.map((lesson) => lesson.id)),
        first: {},
        missed: {},
        practice: completedPractice,
      })
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "R基礎からStanまで修了しました" })).toBeTruthy();
    expect(screen.getByText("STEP 1〜6の理解問題、4段階の反復練習、成果物チェックまで完了しました。Stan演習ノートで実装・診断・報告の流れを復習できます。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stan編を復習する" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Stan演習ノートをダウンロード" })).toBeTruthy();
  });
});

describe("実践進捗", () => {
  it("L10の理解済み進捗から実践チェックを再開し、解除も含めて保存する", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({
        done: { l10: [0, 1, 2] },
        first: { l10: [0, 1, 2] },
        missed: {},
        practice: { l10: ["console", "calculation", "script", "project"] },
      })
    );
    window.history.replaceState(null, "", "#/foundation-check");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Foundation Check" })).toBeTruthy();
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(5);
    expect(checks.filter((checkbox) => checkbox.checked)).toHaveLength(4);

    await user.click(checks[0]);
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem("learning-stan.progress"));
      expect(stored.practice.l10).not.toContain("console");
    });
    await user.click(checks[0]);
    await user.click(checks[4]);
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem("learning-stan.progress"));
      expect(stored.practice.l10).toHaveLength(5);
    });

    expect(screen.getByText("実機での5項目は確認できました")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "← 学習ホーム" }));
    expect(screen.getByRole("button", { name: /Foundation Check.*5 \/ 5/ })).toBeTruthy();
  });
});
