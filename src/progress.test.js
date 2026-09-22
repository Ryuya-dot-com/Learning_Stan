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
  ex: [1, 2, 3].map(n => ({ id: `l1-q0${n}`, revision: 1 })),
  practiceLadder: { steps: [{ id: "imitate" }, { id: "change" }, { id: "recall" }, { id: "transfer" }] },
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
  it("累積復習を含む現在の教材を識別できる内容版を使う", () => {
    expect(CONTENT_VERSION).toBe("2026-09-22-research-practice-v1");
  });

  it("版情報を付けて保存し、同じ内容を読み戻す", () => {
    const storage = memoryStorage();
    const progress = {
      done: { l1: [0] },
      first: { l1: [0] },
      missed: {},
      drill: { l1: ["imitate", "change"] },
      practice: { l10: ["console"] },
    };

    expect(saveProgress(progress, storage)).toBe(true);
    const stored = JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY));
    expect(stored.schemaVersion).toBe(PROGRESS_SCHEMA_VERSION);
    expect(stored.contentVersion).toBe(CONTENT_VERSION);
    expect(loadProgress(storage).progress.done.l1).toEqual([0]);
    expect(loadProgress(storage).progress.drill.l1).toEqual(["imitate", "change"]);
    expect(loadProgress(storage).progress.practice.l10).toEqual(["console"]);
  });

  it("旧版の版なしデータを移行する", () => {
    const decoded = decodeProgress(JSON.stringify({ done: { l1: [1] }, first: { l1: [1] }, missed: {} }), lessons);

    expect(decoded.status).toBe("migrated");
    expect(decoded.canPersist).toBe(true);
    expect(decoded.progress.first.l1).toEqual([1]);
    expect(decoded.progress.drill).toEqual({});
    expect(decoded.progress.practice).toEqual({});
  });

  it("schema v1を段階練習・実践進捗付きschema v4へ移行する", () => {
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
      drill: {},
      practice: {},
    });
  });

  it("schema v2の理解・実践進捗を失わずschema v4へ移行する", () => {
    const decoded = decodeProgress({
      schemaVersion: 2,
      contentVersion: "2026-08-01-l1-l16-v3",
      done: { l1: [0] },
      first: { l1: [0] },
      missed: {},
      practice: { l1: ["check-a"] },
    }, lessons);

    expect(decoded.status).toBe("migrated");
    expect(decoded.progress.done.l1).toEqual([0]);
    expect(decoded.progress.practice.l1).toEqual(["check-a"]);
    expect(decoded.progress.drill).toEqual({});
  });

  it("L1〜L10版の進捗を失わずL1〜L16版へ移行する", () => {
    const decoded = decodeProgress({
      schemaVersion: 3,
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
        contentVersion: "2026-08-13-steps3-5-v1",
        done: { l1: [2, 0, 2, 9], removed: [0] },
        first: { l1: [0, 1, 2] },
        missed: { l1: [2] },
        drill: { l1: ["transfer", "imitate", "missing", "imitate"], removed: ["change"] },
        practice: { l1: ["check-b", "missing", "check-b"], removed: ["check-a"] },
      },
      lessons
    );

    expect(decoded.progress).toEqual({
      done: { l1: [0, 2] },
      first: { l1: [0] },
      missed: { l1: [2] },
      drill: { l1: ["imitate"] },
      practice: { l1: ["check-b"] },
    });
  });

  it("段階練習は先頭から連続した完了だけを受理する", () => {
    const decoded = decodeProgress({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      done: {},
      first: {},
      missed: {},
      drill: { l1: ["imitate", "recall", "transfer"] },
      practice: {},
    }, lessons);

    expect(decoded.progress.drill.l1).toEqual(["imitate"]);
  });

  it("壊れたJSONを空データとして表示するが、自動上書きは許さない", () => {
    const decoded = decodeProgress("{not-json", lessons);

    expect(decoded.status).toBe("invalid");
    expect(decoded.canPersist).toBe(false);
    expect(decoded.progress).toEqual({ done: {}, first: {}, missed: {}, drill: {}, practice: {} });
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

    expect(stored.done.l1).toEqual(["l1-q01@1"]);
  });
});


describe("問題のIDと改訂番号", () => {
  const progress = { done: { l1: [0, 1] }, first: { l1: [0] }, missed: { l1: [1] }, drill: {}, practice: {} };
  it("問題の並べ替え後も同じ問題へ履歴を戻す", () => {
    const raw = serializeProgress(progress, lessons);
    const reordered = [{ ...lessons[0], ex: [...lessons[0].ex].reverse() }];
    const result = decodeProgress(raw, reordered).progress;
    expect(result.done.l1).toEqual([1, 2]);
    expect(result.first.l1).toEqual([2]);
    expect(result.missed.l1).toEqual([1]);
  });
  it("意味を改訂した問題だけ再確認にし、削除・追加で誤対応しない", () => {
    const raw = serializeProgress(progress, lessons);
    const changed = [{ ...lessons[0], ex: [
      { id: "new-question", revision: 1 }, { id: "l1-q01", revision: 2 }, lessons[0].ex[1],
    ] }];
    const result = decodeProgress(raw, changed).progress;
    expect(result.done.l1).toEqual([2]);
    expect(result.first).toEqual({});
    expect(result.missed.l1).toEqual([2]);
  });
  it("旧番号は固定した当時の対応表を使い、新しい順番から推測しない", () => {
    const reordered = [{ ...lessons[0], ex: [...lessons[0].ex].reverse() }];
    const raw = { schemaVersion: 3, contentVersion: "2026-08-13-steps3-5-v1", done: { l1: [0] } };
    expect(decodeProgress(raw, reordered).progress.done.l1).toEqual([2]);
  });
  it("未知の旧内容版の番号は割り当てず実践記録を保持する", () => {
    const raw = { schemaVersion: 3, contentVersion: "unknown", done: { l1: [0] }, practice: { l1: ["check-a"] } };
    const result = decodeProgress(raw, lessons);
    expect(result.progress.done).toEqual({});
    expect(result.progress.practice.l1).toEqual(["check-a"]);
    expect(result.message).toContain("再確認");
  });
  it("旧L30の識別不十分な設問の正答を改訂問題へ移さない", () => {
    const result = decodeProgress({ schemaVersion: 3, contentVersion: "2026-08-13-steps3-5-v1", done: { l30: [0, 1, 2] } });
    expect(result.progress.done.l30).toEqual([0, 2]);
  });
});
