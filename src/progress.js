import legacyOrder from "./data/legacy-question-order.json";
import { LESSONS } from "./data/lessons/index.js";

export const PROGRESS_STORAGE_KEY = "learning-stan.progress";
export const PROGRESS_SCHEMA_VERSION = 4;
// UIはindexを使い、保存境界で永続IDと改訂番号へ変換する。意味の変更時は問題のrevisionも更新する。
export const CONTENT_VERSION = "2026-09-22-research-practice-v1";

export function emptyProgress() {
  return { done: {}, first: {}, missed: {}, drill: {}, practice: {} };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanIndices(value, exerciseCount) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < exerciseCount)
    .sort((a, b) => a - b);
}

function cleanItemIds(value, items) {
  if (!Array.isArray(value) || !items) return [];
  const selected = new Set(value.filter((id) => typeof id === "string"));
  return items.map((item) => item.id).filter((id) => selected.has(id));
}

function cleanPrefixIds(value, items) {
  if (!Array.isArray(value) || !items) return [];
  const selected = new Set(value.filter((id) => typeof id === "string"));
  const prefix = [];
  for (const item of items) {
    if (!selected.has(item.id)) break;
    prefix.push(item.id);
  }
  return prefix;
}

export function sanitizeProgress(candidate, lessons = LESSONS) {
  const source = isRecord(candidate) ? candidate : {};
  const progress = emptyProgress();

  for (const lesson of lessons) {
    const done = cleanIndices(source.done?.[lesson.id], lesson.ex.length);
    const missed = cleanIndices(source.missed?.[lesson.id], lesson.ex.length);
    const missedSet = new Set(missed);
    const doneSet = new Set(done);
    const first = cleanIndices(source.first?.[lesson.id], lesson.ex.length).filter(
      (index) => doneSet.has(index) && !missedSet.has(index)
    );
    const drill = cleanPrefixIds(source.drill?.[lesson.id], lesson.practiceLadder?.steps);
    const practice = cleanItemIds(source.practice?.[lesson.id], lesson.practice?.items);

    if (done.length > 0) progress.done[lesson.id] = done;
    if (first.length > 0) progress.first[lesson.id] = first;
    if (missed.length > 0) progress.missed[lesson.id] = missed;
    if (drill.length > 0) progress.drill[lesson.id] = drill;
    if (practice.length > 0) progress.practice[lesson.id] = practice;
  }

  return progress;
}

const questionKey = (question) => `${question.id}@${question.revision}`;

// この対応は9d0a828時点で固定。現在の配列順から旧番号を推測しない。
const legacyVersions = new Set([
  "2026-08-13-steps3-5-v1", "2026-08-01-l1-l10-v1",
  "2026-08-01-l1-l10-v2", "2026-08-01-l1-l16-v3",
]);

function encodeAnswers(progress, lessons) {
  const result = { ...progress };
  for (const field of ["done", "first", "missed"]) {
    result[field] = Object.fromEntries(lessons.filter(l => progress[field][l.id]?.length)
      .map(l => [l.id, progress[field][l.id].map(i => questionKey(l.ex[i]))]));
  }
  return result;
}

function decodeAnswers(source, lessons) {
  const result = { ...source };
  const current = source.schemaVersion === PROGRESS_SCHEMA_VERSION;
  const knownLegacy = legacyVersions.has(source.contentVersion) || source.schemaVersion == null;
  for (const field of ["done", "first", "missed"]) {
    result[field] = {};
    for (const lesson of lessons) {
      const values = Array.isArray(source[field]?.[lesson.id]) ? source[field][lesson.id] : [];
      // 版なしの初期形式はL1–L10のみ。未知の旧教材は履歴を別問題に割り当てない。
      const inLegacyScope = source.schemaVersion != null || /^l([1-9]|10)$/.test(lesson.id);
      const keys = new Set(current ? values.filter(v => typeof v === "string") :
        knownLegacy && inLegacyScope ? values.filter(Number.isInteger).map(i => legacyOrder[lesson.id]?.[i]) : []);
      result[field][lesson.id] = lesson.ex.flatMap((q, i) => keys.has(questionKey(q)) ? [i] : []);
    }
  }
  return result;
}

export function serializeProgress(progress, lessons = LESSONS) {
  return JSON.stringify(
    {
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      ...encodeAnswers(sanitizeProgress(progress, lessons), lessons),
    },
    null,
    2
  );
}

export function decodeProgress(raw, lessons = LESSONS) {
  if (raw == null || raw === "") {
    return { progress: emptyProgress(), canPersist: true, status: "empty", message: "" };
  }

  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {
      progress: emptyProgress(),
      canPersist: false,
      status: "invalid",
      message: "保存データを読めませんでした。リセットするまで上書きせず保護します。",
    };
  }

  if (!isRecord(parsed)) {
    return {
      progress: emptyProgress(),
      canPersist: false,
      status: "invalid",
      message: "保存データの形式が不正です。リセットするまで上書きせず保護します。",
    };
  }

  if (Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion > PROGRESS_SCHEMA_VERSION) {
    return {
      progress: emptyProgress(),
      canPersist: false,
      status: "future",
      message: "この保存データは新しい版で作られています。上書きせず保護します。",
    };
  }

  if (parsed.schemaVersion != null && ![1, 2, 3, PROGRESS_SCHEMA_VERSION].includes(parsed.schemaVersion)) {
    return {
      progress: emptyProgress(),
      canPersist: false,
      status: "invalid",
      message: "未対応の保存形式です。リセットするまで上書きせず保護します。",
    };
  }

  const migrated = parsed.schemaVersion !== PROGRESS_SCHEMA_VERSION || parsed.contentVersion !== CONTENT_VERSION;
  return {
    progress: sanitizeProgress(decodeAnswers(parsed, lessons), lessons),
    canPersist: true,
    status: migrated ? "migrated" : "loaded",
    message: migrated ? "以前の保存データを移行しました。意味を改訂した問題・対応を確認できない旧問題は再確認が必要です。実践記録は保持します。" : "",
  };
}

export function loadProgress(storage = window.localStorage) {
  try {
    return decodeProgress(storage.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    return {
      progress: emptyProgress(),
      canPersist: false,
      status: "unavailable",
      message: "このブラウザでは進みぐあいを保存できません。閲覧中のみ保持します。",
    };
  }
}

export function saveProgress(progress, storage = window.localStorage) {
  try {
    const clean = sanitizeProgress(progress);
    const isEmpty = [clean.done, clean.first, clean.missed, clean.drill, clean.practice].every(
      (record) => Object.keys(record).length === 0
    );
    if (isEmpty) storage.removeItem(PROGRESS_STORAGE_KEY);
    else storage.setItem(PROGRESS_STORAGE_KEY, serializeProgress(clean));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(storage = window.localStorage) {
  try {
    storage.removeItem(PROGRESS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
