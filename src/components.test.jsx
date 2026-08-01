// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetButton, T } from "./components.jsx";

afterEach(cleanup);

describe("本文レンダラー", () => {
  it("バッククォートで囲んだ HTTPS URL を安全な外部リンクとして表示する", () => {
    render(<T>公式: `https://example.com/guide`</T>);

    const link = screen.getByRole("link", { name: "https://example.com/guide" });
    expect(link.getAttribute("href")).toBe("https://example.com/guide");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });
});

describe("進捗リセット", () => {
  it("確認段階へ切り替わってもフォーカスを維持し、キーボードで確定できる", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ResetButton onReset={onReset} />);

    await user.click(screen.getByRole("button", { name: "進みぐあいをリセット" }));
    const confirm = screen.getByRole("button", { name: "本当にリセットする(進みぐあいが消えます)" });
    expect(document.activeElement).toBe(confirm);
    await user.keyboard("{Enter}");

    expect(onReset).toHaveBeenCalledOnce();
  });
});
