// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { manuscriptToPages } from "./data/stanLesson.js";
import { LessonBlock } from "./components.jsx";
afterEach(cleanup);
describe("原稿の比較表・数式・コード", () => {
  it("セルと見出しを保ち、コード内のパイプを分割しない", () => {
    const [page] = manuscriptToPages("# 題名\n## 対応\n| 式 | 意味 |\n|---|---|\n| `y | x` | 条件付き |\n", "説明できる");
    const table = page.b.find(v => v.type === "table");
    expect(table.rows).toEqual([["`y | x`", "条件付き"]]);
    render(<LessonBlock value={table} title="対応" />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });
  it("数式をMathMLへ描画し、注意書きとコードを別のまま保つ", async () => {
    const [page] = manuscriptToPages("## モデル\n$$\ny_i \\sim N(\\mu,\\sigma)\n$$\n> 推定の前に点検\n```stan\n// ## code\ny ~ normal(mu, sigma);\n```", "説明できる");
    expect(page.code).toContain("// ## code");
    const math = page.b.find(v => v.type === "math");
    const { container } = render(<LessonBlock value={math} title="モデル" />);
    await waitFor(() => expect(container.querySelector("math")).not.toBeNull());
    expect(page.b.find(v => v.type === "note").text).toBe("推定の前に点検");
  });
  it("閉じていない数式を黙って落とさない", () => {
    expect(() => manuscriptToPages("## 式\n$$\nx", "説明できる")).toThrow(/Unclosed/);
  });
});
