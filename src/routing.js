import { LESSONS } from "./data/lessons/index.js";

export const HOME_HASH = "#/";

export function hashForView(view) {
  if (view.name === "lesson") return `#/lesson/${encodeURIComponent(view.id)}`;
  if (view.name === "cheat") return "#/cheat";
  return HOME_HASH;
}

export function routeFromHash(hash, lessons = LESSONS) {
  if (hash === "" || hash === "#" || hash === HOME_HASH) {
    return { view: { name: "home" }, canonicalHash: HOME_HASH, valid: true };
  }
  if (hash === "#/cheat") {
    return { view: { name: "cheat" }, canonicalHash: "#/cheat", valid: true };
  }

  const match = /^#\/lesson\/([^/]+)$/.exec(hash);
  if (match) {
    try {
      const id = decodeURIComponent(match[1]);
      if (lessons.some((lesson) => lesson.id === id)) {
        return { view: { name: "lesson", id }, canonicalHash: hashForView({ name: "lesson", id }), valid: true };
      }
    } catch {
      // 壊れたpercent encodingは不明なURLとしてホームへ戻す。
    }
  }

  return { view: { name: "home" }, canonicalHash: HOME_HASH, valid: false };
}
