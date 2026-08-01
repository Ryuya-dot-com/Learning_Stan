import { describe, expect, it } from "vitest";
import {
  CONTENT_VERSION,
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  decodeProgress,
  loadProgress,
  saveProgress,
  serializeProgress,
} from "./progress.js";

const lessons = [{
  id: "l1",
  ex: [{}, {}, {}],
  practice: { items: [{ id: "check-a" }, { id: "check-b" }] },
}];

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

describe("進捗保存形式", () => {
  it("公開中のL1〜L16を識別できる内容版を使う", () => {
    expect(CONTENT_VERSION).toBe("2026-08-01-l1-l16-v3");
  });

  it("版情報を付けて保存し、同じ内容を読み戻す", () => {
    const storage = memoryStorage();
    const progress = { done: { l1: [0] }, first: { l1: [0] }, missed: {}, practice: { l10: ["console"] } };

    expect(saveProgress(progress, storage)).toBe(true);
    const stored = JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY));
    expect(stored.schemaVersion).toBe(PROGRESS_SCHEMA_VERSION);
    expect(stored.contentVersion).toBe(CONTENT_VERSION);
    expect(loadProgress(storage).progress.done.l1).toEqual([0]);
    expect(loadProgress(storage).progress.practice.l10).toEqual(["console"]);
  });

  it("旧版の版なしデータを移行する", () => {
    const decoded = decodeProgress(JSON.stringify({ done: { l1: [1] }, first: { l1: [1] }, missed: {} }), lessons);

    expect(decoded.status).toBe("migrated");
    expect(decoded.canPersist).toBe(true);
    expect(decoded.progress.first.l1).toEqual([1]);
    expect(decoded.progress.practice).toEqual({});
  });

  it("schema v1を実践進捗付きschema v2へ移行する", () => {
    const decoded = decodeProgress({
      schemaVersion: 1,
      contentVersion: "2026-08-01-l1-l10-v1",
      done: { l1: [0] },
      first: { l1: [0] },
      missed: {},
    }, lessons);

    expect(decoded.status).toBe("migrated");
    expect(decoded.canPersist).toBe(true);
    expect(decoded.progress).toEqual({
      done: { l1: [0] },
      first: { l1: [0] },
      missed: {},
      practice: {},
    });
  });

  it("L1〜L10版の進捗を失わずL1〜L16版へ移行する", () => {
    const decoded = decodeProgress({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      contentVersion: "2026-08-01-l1-l10-v2",
      done: { l1: [0] },
      first: { l1: [0] },
      missed: {},
      practice: {},
    }, lessons);

    expect(decoded.status).toBe("migrated");
    expect(decoded.canPersist).toBe(true);
    expect(decoded.progress.done.l1).toEqual([0]);
    expect(decoded.progress.first.l1).toEqual([0]);
  });


  it("未知のレッスン・範囲外・重複を除き、初見正解の不変条件を直す", () => {
    const decoded = decodeProgress(
      {
        schemaVersion: 1,
        contentVersion: CONTENT_VERSION,
        done: { l1: [2, 0, 2, 9], removed: [0] },
        first: { l1: [0, 1, 2] },
        missed: { l1: [2] },
        practice: { l1: ["check-b", "missing", "check-b"], removed: ["check-a"] },
      },
      lessons
    );

    expect(decoded.progress).toEqual({
      done: { l1: [0, 2] },
      first: { l1: [0] },
      missed: { l1: [2] },
      practice: { l1: ["check-b"] },
    });
  });

  it("壊れたJSONを空データとして表示するが、自動上書きは許さない", () => {
    const decoded = decodeProgress("{not-json", lessons);

    expect(decoded.status).toBe("invalid");
    expect(decoded.canPersist).toBe(false);
    expect(decoded.progress).toEqual({ done: {}, first: {}, missed: {}, practice: {} });
  });

  it("将来版をダウングレードで上書きしない", () => {
    const decoded = decodeProgress({ schemaVersion: 99, done: { l1: [0] } }, lessons);

    expect(decoded.status).toBe("future");
    expect(decoded.canPersist).toBe(false);
  });

  it("保存先が利用不能でも例外でアプリを停止しない", () => {
    const storage = { getItem: () => { throw new Error("blocked"); } };

    expect(loadProgress(storage).status).toBe("unavailable");
  });

  it("直列化のたびに不正な値を除去する", () => {
    const stored = JSON.parse(serializeProgress({ done: { l1: [0, -1, "1"] }, first: {}, missed: {} }));

    expect(stored.done.l1).toEqual([0]);
  });
});
