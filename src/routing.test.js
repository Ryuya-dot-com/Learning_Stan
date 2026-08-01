import { describe, expect, it } from "vitest";
import { HOME_HASH, hashForView, routeFromHash } from "./routing.js";

const lessons = [{ id: "lesson / 日本語" }];

describe("共有URL", () => {
  it("レッスンIDを安全に往復する", () => {
    const view = { name: "lesson", id: "lesson / 日本語" };
    const hash = hashForView(view);

    expect(hash).toContain("%2F");
    expect(routeFromHash(hash, lessons)).toMatchObject({ view, valid: true });
  });

  it("ホームとチートシートを解釈する", () => {
    expect(routeFromHash("").view).toEqual({ name: "home" });
    expect(routeFromHash("#/cheat").view).toEqual({ name: "cheat" });
  });

  it("未知・破損URLを正規のホームへフォールバックする", () => {
    for (const hash of ["#/lesson/missing", "#/lesson/%E0%A4%A", "#/other"]) {
      expect(routeFromHash(hash, lessons)).toEqual({
        view: { name: "home" },
        canonicalHash: HOME_HASH,
        valid: false,
      });
    }
  });
});
