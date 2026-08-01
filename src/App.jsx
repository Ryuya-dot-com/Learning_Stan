import { useState, useCallback, useEffect, useRef } from "react";
import { C, JP, GLOBAL_CSS } from "./theme.js";
import { LessonView, Home, CheatSheet, Sidebar } from "./views.jsx";
import { LESSONS } from "./data/lessons/index.js";
import {
  PROGRESS_STORAGE_KEY,
  clearProgress,
  decodeProgress,
  emptyProgress,
  loadProgress,
  saveProgress,
  serializeProgress,
} from "./progress.js";
import { hashForView, routeFromHash } from "./routing.js";

/* ============================================================
   アプリ本体
   進捗は版付きlocalStorageへ保存し、URL hashで画面を表現する。
   ============================================================ */

// 「次のレッスン」の遷移規則(仕様4.4b):
// - 番号付きレッスンは num 連番で次へ。最後の番号付きが終端で、
//   番号なしトラック(bridge/extra)へは流れ込まない
// - 番号なしレッスンは同一セクション内のみ次へ
export function nextLessonOf(lesson) {
  if (lesson.num != null) {
    return LESSONS.find((l) => l.num === lesson.num + 1) || null;
  }
  const secLessons = LESSONS.filter((l) => l.section === lesson.section);
  const i = secLessons.findIndex((l) => l.id === lesson.id);
  return secLessons[i + 1] || null;
}

export default function RStanLearningApp() {
  const [view, setView] = useState(() => routeFromHash(window.location.hash).view);
  const [initialProgress] = useState(() => loadProgress());
  // done: 理解問題クリア / first: 誤答なし / missed: 一度でも誤答 / practice: 実機で自己確認済み
  const [progress, setProgress] = useState(initialProgress.progress);
  const [canPersist, setCanPersist] = useState(initialProgress.canPersist);
  const [storageNotice, setStorageNotice] = useState(initialProgress.message);
  const mainRef = useRef(null);

  const navigate = useCallback((nextView, { replace = false } = {}) => {
    const route = routeFromHash(hashForView(nextView));
    const nextUrl = `${window.location.pathname}${window.location.search}${route.canonicalHash}`;
    if (replace || window.location.hash !== route.canonicalHash) {
      window.history[replace ? "replaceState" : "pushState"](null, "", nextUrl);
    }
    setView(route.view);
  }, []);

  useEffect(() => {
    const initialRoute = routeFromHash(window.location.hash);
    if (!initialRoute.valid || window.location.hash !== initialRoute.canonicalHash) {
      navigate(initialRoute.view, { replace: true });
    }

    const followHistory = () => {
      const route = routeFromHash(window.location.hash);
      if (!route.valid) {
        navigate({ name: "home" }, { replace: true });
      } else {
        setView(route.view);
      }
    };
    window.addEventListener("popstate", followHistory);
    window.addEventListener("hashchange", followHistory);
    return () => {
      window.removeEventListener("popstate", followHistory);
      window.removeEventListener("hashchange", followHistory);
    };
  }, [navigate]);

  useEffect(() => {
    if (!canPersist) return;
    if (!saveProgress(progress)) {
      setCanPersist(false);
      setStorageNotice("進みぐあいを保存できませんでした。閲覧中のみ保持します。");
    }
  }, [progress, canPersist]);

  useEffect(() => {
    const syncProgress = (event) => {
      if (event.key !== PROGRESS_STORAGE_KEY) return;
      const loaded = decodeProgress(event.newValue);
      if (!loaded.canPersist) {
        setCanPersist(false);
        setStorageNotice(loaded.message);
        return;
      }
      setProgress(loaded.progress);
      setCanPersist(true);
      setStorageNotice(loaded.message || "別のタブで更新された進みぐあいを反映しました。");
    };
    window.addEventListener("storage", syncProgress);
    return () => window.removeEventListener("storage", syncProgress);
  }, []);

  useEffect(() => {
    const heading = mainRef.current?.querySelector("h1");
    (heading || mainRef.current)?.focus();
  }, [view.name, view.id]);

  useEffect(() => {
    const lesson = view.name === "lesson" ? LESSONS.find((item) => item.id === view.id) : null;
    document.title = lesson
      ? `${lesson.title} — はじめてのRとStan`
      : view.name === "cheat"
        ? "R チートシート — はじめてのRとStan"
        : "はじめてのRとStan — 研究室のためのベイズ統計入門";
  }, [view.name, view.id]);

  const miss = useCallback((lid, i) => {
    setProgress((prev) => {
      const cur = prev.missed[lid] || [];
      if (cur.includes(i) || (prev.done[lid] || []).includes(i)) return prev;
      return { ...prev, missed: { ...prev.missed, [lid]: [...cur, i] } };
    });
  }, []);

  const solve = useCallback((lid, i) => {
    setProgress((prev) => {
      const cur = prev.done[lid] || [];
      if (cur.includes(i)) return prev;
      const next = { ...prev, done: { ...prev.done, [lid]: [...cur, i] } };
      if (!(prev.missed[lid] || []).includes(i)) {
        next.first = { ...prev.first, [lid]: [...(prev.first[lid] || []), i] };
      }
      return next;
    });
  }, []);

  const togglePractice = useCallback((lid, itemId, checked) => {
    setProgress((prev) => {
      const current = prev.practice[lid] || [];
      const nextItems = checked
        ? [...new Set([...current, itemId])]
        : current.filter((id) => id !== itemId);
      const nextPractice = { ...prev.practice };
      if (nextItems.length > 0) nextPractice[lid] = nextItems;
      else delete nextPractice[lid];
      return {
        ...prev,
        practice: nextPractice,
      };
    });
  }, []);

  const reset = () => {
    const cleared = clearProgress();
    setProgress(emptyProgress());
    setCanPersist(cleared);
    setStorageNotice(cleared ? "保存した進みぐあいを消去しました。" : "保存データを消去できませんでした。");
    navigate({ name: "home" });
  };

  const importProgress = (raw) => {
    const imported = decodeProgress(raw);
    if (!imported.canPersist) {
      setStorageNotice(imported.message);
      return;
    }
    setProgress(imported.progress);
    setCanPersist(true);
    setStorageNotice("進みぐあいを読み込みました。");
  };

  let body = null;
  if (view.name === "lesson") {
    const lesson = LESSONS.find((l) => l.id === view.id) || LESSONS[0];
    const next = nextLessonOf(lesson);
    body = (
      <LessonView
        key={lesson.id}
        lesson={lesson}
        doneSet={new Set(progress.done[lesson.id] || [])}
        firstSet={new Set(progress.first[lesson.id] || [])}
        missedSet={new Set(progress.missed[lesson.id] || [])}
        practiceSet={new Set(progress.practice[lesson.id] || [])}
        onMiss={(i) => miss(lesson.id, i)}
        onSolve={(i) => solve(lesson.id, i)}
        onPractice={(itemId, checked) => togglePractice(lesson.id, itemId, checked)}
        onHome={() => navigate({ name: "home" })}
        hasNext={next != null}
        onNextLesson={() => next && navigate({ name: "lesson", id: next.id })}
        onCheat={() => navigate({ name: "cheat" })}
      />
    );
  } else if (view.name === "cheat") {
    body = <CheatSheet onHome={() => navigate({ name: "home" })} />;
  } else {
    body = (
      <Home
        progress={progress}
        storageNotice={storageNotice}
        exportText={serializeProgress(progress)}
        onImport={importProgress}
        onImportError={setStorageNotice}
        onOpen={(id) => navigate({ name: "lesson", id })}
        onCheat={() => navigate({ name: "cheat" })}
        onReset={reset}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.paper, fontFamily: JP, color: C.ink }}>
      <style>{GLOBAL_CSS}</style>
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, " +
            C.accent + " 0%, " + C.accent + " 33.4%, " +
            C.ok + " 33.4%, " + C.ok + " 66.7%, " +
            C.stan + " 66.7%, " + C.stan + " 100%)",
        }}
      />
      <div className="mx-auto flex w-full max-w-5xl justify-center gap-10 px-4 py-6 sm:py-10">
        <Sidebar
          progress={progress}
          viewName={view.name}
          currentId={view.name === "lesson" ? view.id : null}
          onOpen={(id) => navigate({ name: "lesson", id })}
          onCheat={() => navigate({ name: "cheat" })}
          onHome={() => navigate({ name: "home" })}
        />
        <main
          ref={mainRef}
          tabIndex={-1}
          className="w-full min-w-0 max-w-2xl focus:outline-none"
        >
          {body}
        </main>
      </div>
    </div>
  );
}
