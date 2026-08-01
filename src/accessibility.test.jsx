// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import App from "./App.jsx";
import { serializeProgress } from "./progress.js";

window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

async function expectNoMajorViolations(container) {
  const results = await axe.run(container, {
    // jsdomは実際の描画色を計算できないため、色コントラストは実ブラウザ検査へ分離する。
    rules: { "color-contrast": { enabled: false } },
  });
  const major = results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));

  expect(major).toEqual([]);
}

describe("主要画面のアクセシビリティ", () => {
  it.each([
    ["ホーム", "#/"],
    ["レッスン", "#/lesson/l1"],
    ["チートシート", "#/cheat"],
  ])("%sに重大な自動検出違反がない", async (_name, hash) => {
    window.history.replaceState(null, "", hash);
    const { container } = render(<App />);

    await expectNoMajorViolations(container);
  });

  it("Foundation Checkに重大な自動検出違反がない", async () => {
    window.localStorage.setItem(
      "learning-stan.progress",
      serializeProgress({
        done: { l10: [0, 1, 2] },
        first: { l10: [0, 1, 2] },
        missed: {},
        practice: {},
      })
    );
    window.history.replaceState(null, "", "#/foundation-check");
    const { container } = render(<App />);

    await expectNoMajorViolations(container);
  });
});
