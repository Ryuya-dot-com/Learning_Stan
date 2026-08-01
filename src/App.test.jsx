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
  await user.click(screen.getByRole("button", { name: "レッスン1をはじめる" }));
  for (let i = 0; i < 3; i += 1) {
    await user.click(screen.getByRole("button", { name: "次へ →" }));
  }
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
    await user.click(screen.getByRole("button", { name: "← レッスン一覧" }));
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
    await user.click(screen.getByRole("button", { name: "← レッスン一覧" }));
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
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "次へ →" }));
    }
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
});

describe("レッスン遷移", () => {
  it("最後の番号付きレッスンから構想中トラックへ流れ込まない", () => {
    const lastNumbered = LESSONS.filter((lesson) => lesson.num != null).at(-1);

    expect(nextLessonOf(lastNumbered)).toBeNull();
  });

  it("画面をURLへ反映し、履歴イベントから復元する", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "レッスン1をはじめる" }));
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

    expect(screen.getByText("LESSON 2")).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "変数と計算", level: 1 }));
    });
    expect(document.title).toContain("変数");
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

    await tabToAndActivate(user, "button", { name: "レッスン1をはじめる" });
    for (let i = 0; i < 3; i += 1) {
      await tabToAndActivate(user, "button", { name: "次へ →" });
    }
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

    expect(screen.getByRole("heading", { name: "レッスン1 修了!" })).toBeTruthy();
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
    window.history.replaceState(null, "", "#/lesson/l10");
    render(<App />);

    expect(screen.getByRole("heading", { name: "実機でFoundation Check" })).toBeTruthy();
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

    await user.click(screen.getByRole("button", { name: "まとめへ" }));
    expect(screen.getByRole("heading", { name: "RとRStudioを手元に入れる 実践完了!" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "レッスン一覧にもどる" }));
    expect(screen.getByText("実践済")).toBeTruthy();
  });
});
