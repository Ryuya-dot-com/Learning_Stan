import { useState, useEffect, useMemo, useRef } from "react";
import { C, MONO } from "./theme.js";
import { isCodey } from "./highlight.js";
import { seededOrder } from "./shuffle.js";
import { T, CodeBlock, TriDots, Btn, ResetButton, Feedback } from "./components.jsx";
import { LESSONS } from "./data/lessons/index.js";
import { SECTIONS } from "./data/sections.js";
import { CHEATS } from "./data/cheats.js";
import {
  FOUNDATION_LESSON_ID,
  JOURNEY_STAGES,
  getJourneyState,
  getLessonPathMeta,
  getStageStatus,
  lessonIsUnderstood,
} from "./learningPath.js";

/* ============================================================
   練習問題コンポーネント
   ============================================================ */

function ChoiceEx({ ex, seedKey, solved, onMiss, onCorrect }) {
  const [sel, setSel] = useState(solved ? ex.ans : null);
  const [status, setStatus] = useState(solved ? "correct" : "idle");
  const [showHint, setShowHint] = useState(false);
  // シードに問題文だけを使うと、同一文面の問題どうしで正解が同じ位置に固定される(監査A3)。
  // レッスンidと問indexを混ぜて、問題ごとに独立した並びにする
  const order = useMemo(() => seededOrder(ex.opts.length, seedKey + ":" + ex.q), [ex, seedKey]);

  const pick = (i) => {
    if (status === "correct") return;
    setSel(i);
    if (i === ex.ans) {
      setStatus("correct");
      onCorrect();
    } else {
      onMiss();
      setStatus("wrong");
    }
  };

  return (
    <div>
      <p className="mb-1 text-base font-bold leading-relaxed" style={{ color: C.ink }}>
        <T>{ex.q}</T>
      </p>
      {ex.code && <CodeBlock code={ex.code} />}
      <div className="mt-4 flex flex-col gap-2.5">
        {order.map((oi, pos) => {
          const o = ex.opts[oi];
          const correctPick = status === "correct" && oi === ex.ans;
          const wrongPick = status === "wrong" && sel === oi;
          let st = { background: "#FFFFFF", border: "1.5px solid " + C.line, color: C.ink };
          if (correctPick) st = { background: C.okSoft, border: "1.5px solid " + C.ok, color: C.okText };
          else if (wrongPick) st = { background: C.alertSoft, border: "1.5px solid " + C.alert, color: C.alertText };
          return (
            <button
              key={oi}
              onClick={() => pick(oi)}
              disabled={status === "correct"}
              aria-pressed={sel === oi}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold disabled:cursor-default"
              style={{ ...st, opacity: status === "correct" && !correctPick ? 0.5 : 1 }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={
                  correctPick
                    ? { background: C.okText, color: "#FFFFFF" }
                    : wrongPick
                    ? { background: C.alert, color: "#FFFFFF" }
                    : { background: C.accentSoft, color: C.accentDeep }
                }
              >
                {correctPick ? "✓" : wrongPick ? "✕" : String.fromCharCode(65 + pos)}
              </span>
              <span style={isCodey(o) ? { fontFamily: MONO } : undefined}>{o}</span>
            </button>
          );
        })}
      </div>
      <Feedback
        status={status}
        why={ex.why}
        hint={ex.hint}
        showHint={showHint}
        onHint={() => setShowHint(true)}
      />
    </div>
  );
}

function FillEx({ ex, solved, onMiss, onCorrect }) {
  const [val, setVal] = useState(solved ? ex.show : "");
  const [status, setStatus] = useState(solved ? "correct" : "idle");
  const [showHint, setShowHint] = useState(false);

  const check = () => {
    if (status === "correct") return;
    // NFKC正規化で全角英数・全角記号(＝ など)を半角に写像する。
    // 日本語IMEの学生が全角のまま入力しても正答を受理する(監査A1)
    const v = val.normalize("NFKC").trim().toLowerCase();
    if (!v) return;
    if (ex.accept.includes(v)) {
      setStatus("correct");
      setVal(ex.show);
      onCorrect();
    } else {
      onMiss();
      setStatus("wrong");
    }
  };

  return (
    <div>
      <p className="mb-1 text-base font-bold leading-relaxed" style={{ color: C.ink }}>
        <T>{ex.q}</T>
      </p>
      {ex.code && <CodeBlock code={ex.code} />}
      <div className="mt-4 flex items-stretch gap-2">
        <input
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            if (status === "wrong") setStatus("idle");
          }}
          onKeyDown={(e) => {
            // IME変換確定のEnterで解答が送信されないようにガードする(監査A2)
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") check();
          }}
          disabled={status === "correct"}
          aria-label={ex.placeholder || "答えを入力"}
          placeholder={ex.placeholder || "答えを入力"}
          className="w-full rounded-xl px-4 py-3 text-sm"
          style={{
            border:
              "1.5px solid " +
              (status === "correct" ? C.ok : status === "wrong" ? C.alert : C.edge),
            background: status === "correct" ? C.okSoft : "#FFFFFF",
            color: status === "correct" ? C.okText : C.ink,
            fontFamily: MONO,
          }}
        />
        <Btn onClick={check} disabled={status === "correct" || !val.trim()} className="shrink-0">
          答え合わせ
        </Btn>
      </div>
      <Feedback
        status={status}
        why={ex.why}
        hint={ex.hint}
        showHint={showHint}
        onHint={() => setShowHint(true)}
      />
    </div>
  );
}

function ReflectEx({ ex, solved, onCorrect }) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(solved);
  const [checks, setChecks] = useState(() => ex.rubric.map(() => solved));
  const [complete, setComplete] = useState(solved);
  const statusRef = useRef(null);
  const longEnough = answer.trim().length >= ex.minLength;

  const confirm = () => {
    if (!longEnough || !checks.every(Boolean) || complete) return;
    setComplete(true);
    onCorrect();
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  return (
    <div>
      <p className="mb-3 text-base font-bold leading-relaxed" style={{ color: C.ink }}>
        <T>{ex.q}</T>
      </p>
      {!solved && (
        <>
          <label htmlFor="reflection-answer" className="mb-1 block text-xs font-bold" style={{ color: C.sub }}>
            自分の説明（本文は保存されません）
          </label>
          <textarea
            id="reflection-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={5}
            className="w-full rounded-xl p-3 text-sm leading-6"
            style={{ border: `1.5px solid ${C.edge}`, color: C.ink, background: "#FFFFFF" }}
          />
          {!revealed && (
            <div className="mt-3">
              <Btn onClick={() => setRevealed(true)} disabled={!longEnough}>
                評価基準を見る
              </Btn>
              {!longEnough && (
                <p className="mt-2 text-xs" style={{ color: C.faint }}>
                  まず自分の言葉で{ex.minLength}文字以上書いてみましょう。
                </p>
              )}
            </div>
          )}
        </>
      )}

      {revealed && (
        <div className="mt-4 rounded-xl p-4" style={{ background: C.accentSoft, border: `1px solid ${C.accentLine}` }}>
          <p className="mb-2 text-sm font-bold" style={{ color: C.accentDeep }}>評価基準</p>
          <div className="flex flex-col gap-2">
            {ex.rubric.map((criterion, index) => (
              <label key={criterion} className="flex cursor-pointer items-start gap-2 text-sm leading-6" style={{ color: C.body }}>
                <input
                  type="checkbox"
                  checked={checks[index]}
                  disabled={complete}
                  onChange={(event) => {
                    const next = checks.slice();
                    next[index] = event.target.checked;
                    setChecks(next);
                  }}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <T>{criterion}</T>
              </label>
            ))}
          </div>
          <p className="mb-1 mt-4 text-xs font-bold" style={{ color: C.accentDeep }}>説明例</p>
          <p className="text-sm leading-6" style={{ color: C.body }}><T>{ex.example}</T></p>
          {!complete && (
            <div className="mt-4">
              <Btn onClick={confirm} disabled={!longEnough || !checks.every(Boolean)}>この基準を満たした</Btn>
            </div>
          )}
        </div>
      )}

      <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="focus:outline-none">
        {complete && (
          <p className="mt-4 rounded-xl p-4 text-sm font-bold" style={{ background: C.okSoft, color: C.okText, border: `1px solid ${C.okLine}` }}>
            説明の自己確認が完了しました。回答本文は保存していません。
          </p>
        )}
      </div>
    </div>
  );
}

// tf形式: 3つの記述それぞれに○×を付け、全問正解でクリア(ロードマップ仕様5節)。
// 判定時は項目別の正誤と解説を必ず開示する。「初見で全問正解」は別フラグで記録する2層設計
function TfEx({ ex, solved, missed, onMiss, onCorrect }) {
  const [marks, setMarks] = useState(() => (solved ? ex.items.map((it) => it.a) : ex.items.map(() => null)));
  const [checked, setChecked] = useState(solved);
  const [status, setStatus] = useState(solved ? "correct" : "idle");
  const [showHint, setShowHint] = useState(false);

  const setMark = (i, v) => {
    if (status === "correct") return;
    const next = marks.slice();
    next[i] = v;
    setMarks(next);
    setChecked(false);
    if (status === "wrong") setStatus("idle");
  };

  const judge = () => {
    if (status === "correct" || marks.some((m) => m === null)) return;
    setChecked(true);
    if (ex.items.every((it, i) => marks[i] === it.a)) {
      setStatus("correct");
      onCorrect();
    } else {
      onMiss();
      setStatus("wrong");
    }
  };

  const rightCount = ex.items.filter((it, i) => marks[i] === it.a).length;

  return (
    <div>
      <p className="mb-1 text-base font-bold leading-relaxed" style={{ color: C.ink }}>
        <T>{ex.q}</T>
      </p>
      {ex.code && <CodeBlock code={ex.code} />}
      <div className="mt-4 flex flex-col gap-3">
        {ex.items.map((it, i) => {
          const judged = checked || status === "correct";
          const right = judged && marks[i] === it.a;
          const wrong = judged && marks[i] !== it.a;
          return (
            <div
              key={i}
              className="rounded-xl p-3"
              style={{
                background: right ? C.okSoft : wrong ? C.alertSoft : "#FFFFFF",
                border: "1.5px solid " + (right ? C.ok : wrong ? C.alert : C.line),
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 pt-1 text-sm leading-6" style={{ color: C.ink }}>
                  <T>{it.s}</T>
                </p>
                <div className="flex shrink-0 gap-1.5" role="group" aria-label={`記述${i + 1}の判定`}>
                  {[
                    { v: true, label: "○" },
                    { v: false, label: "×" },
                  ].map(({ v, label }) => (
                    <button
                      key={label}
                      onClick={() => setMark(i, v)}
                      disabled={status === "correct"}
                      aria-pressed={marks[i] === v}
                      aria-label={`記述${i + 1}を「${v ? "正しい" : "まちがい"}」にする`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold disabled:cursor-default"
                      style={
                        marks[i] === v
                          ? { background: C.accentDeep, color: "#FFFFFF" }
                          : { background: "#FFFFFF", border: "1.5px solid " + C.edge, color: C.body }
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {judged && (
                <p className="mt-2 text-xs leading-5" style={{ color: right ? C.okDeep : C.alertText }}>
                  {right ? "○ " : "✕ "}
                  <T>{it.why}</T>
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Btn onClick={judge} disabled={status === "correct" || marks.some((m) => m === null)}>
          答え合わせ
        </Btn>
      </div>
      <div role="status" aria-live="polite">
        {status === "correct" && (
          <div className="pop mt-4 rounded-xl p-4" style={{ background: C.okSoft, border: "1px solid " + C.okLine }}>
            <p className="text-sm font-bold" style={{ color: C.okText }}>
              全問正解です!{!missed && " 初見でパーフェクトでした。"}
            </p>
          </div>
        )}
        {checked && status === "wrong" && (
          <div className="rise mt-4 rounded-xl p-4" style={{ background: C.warnSoft, border: "1px solid " + C.warnLine }}>
            <p className="mb-1.5 text-sm font-bold" style={{ color: C.warnText }}>
              {rightCount} / {ex.items.length} 問が合っています。各記述の解説を読んで、もう一度。
            </p>
            {showHint ? (
              <p className="text-sm leading-relaxed" style={{ color: C.warnBody }}>
                ヒント:<T>{ex.hint}</T>
              </p>
            ) : (
              <button
                className="inline-flex min-h-11 items-center text-sm font-bold underline"
                style={{ color: C.warnText }}
                onClick={() => setShowHint(true)}
              >
                ヒントを見る
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   レッスン画面
   ============================================================ */

function LessonView({
  lesson,
  doneSet,
  firstSet,
  missedSet,
  practiceSet,
  onMiss,
  onSolve,
  onPractice,
  onHome,
  onNextLesson,
  hasNext,
  onCheat,
  pathLabel,
  completionLabel,
  nextLabel = "次のレッスンへすすむ",
  includePractice = true,
}) {
  // 番号なしレッスン(bridge/extra)は「LESSON null」にならないようセクション名を表示する(仕様4.4b)
  const sec = SECTIONS.find((s) => s.dir === lesson.section);
  const headLabel = pathLabel || (lesson.num != null ? `LESSON ${lesson.num}` : (sec ? sec.title : ""));
  const doneLabel = completionLabel || (lesson.num != null ? `レッスン${lesson.num} 修了!` : `${lesson.title} 修了!`);
  const items = useMemo(() => {
    const arr = lesson.pages.map((p) => ({ kind: "page", p }));
    lesson.ex.forEach((e, i) => arr.push({ kind: "ex", e, i }));
    if (lesson.practice && includePractice) arr.push({ kind: "practice", practice: lesson.practice });
    arr.push({ kind: "done" });
    return arr;
  }, [lesson, includePractice]);

  const practiceTotal = includePractice ? lesson.practice?.items.length || 0 : 0;
  const practiceCount = practiceSet.size;
  const practiceComplete = practiceTotal === 0 || practiceCount === practiceTotal;
  const practiceIndex = lesson.pages.length + lesson.ex.length;
  const [idx, setIdx] = useState(() =>
    doneSet.size === lesson.ex.length && lesson.practice && includePractice && !practiceComplete ? practiceIndex : 0
  );
  const contentRef = useRef(null);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch (e) {}
    contentRef.current?.focus();
  }, [idx]);

  const cur = items[idx];
  const total = lesson.ex.length;
  const solvedCount = doneSet.size;
  const pct = Math.round((idx / (items.length - 1)) * 100);

  return (
    <div>
      <h1 tabIndex={-1} className="sr-only focus:outline-none">{lesson.title}</h1>
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <button
            className="inline-flex min-h-11 items-center text-sm font-bold"
            style={{ color: C.accentDeep }}
            onClick={onHome}
          >
            ← 学習ホーム
          </button>
          <span className="text-xs font-bold" style={{ color: C.sub, fontFamily: MONO }}>
            {idx + 1} / {items.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="レッスン内の進みぐあい"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ background: C.track }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: pct + "%", background: C.accent, transition: "width 0.3s" }}
          />
        </div>
      </div>

      <div
        ref={contentRef}
        tabIndex={-1}
        role="region"
        aria-label={
          cur.kind === "page"
            ? cur.p.t
            : cur.kind === "ex"
              ? `練習問題 ${cur.i + 1}`
              : cur.kind === "practice"
                ? cur.practice.title
                : doneLabel
        }
        key={idx}
        className="rise rounded-2xl bg-white p-5 focus:outline-none sm:p-7"
        style={{ border: "1px solid " + C.line, boxShadow: "0 1px 2px rgba(42,39,51,0.04)" }}
      >
        {cur.kind === "page" && (
          <div>
            <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: C.accentDeep, fontFamily: MONO }}>
              {headLabel}
            </div>
            <h2 className="mb-4 text-xl font-bold" style={{ color: C.ink }}>
              {cur.p.t}
            </h2>
            {(cur.p.b || []).map((s, i) => (
              <p key={i} className="mb-3 text-sm leading-7" style={{ color: C.body }}>
                <T>{s}</T>
              </p>
            ))}
            {cur.p.code && <CodeBlock code={cur.p.code} output={cur.p.out} error={cur.p.err} lang={cur.p.lang} />}
            {(cur.p.a || []).map((s, i) => (
              <p key={i} className="mb-3 text-sm leading-7" style={{ color: C.body }}>
                <T>{s}</T>
              </p>
            ))}
          </div>
        )}

        {cur.kind === "ex" && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: C.accentSoft, color: C.accentDeep }}
              >
                練習問題 {cur.i + 1} / {total}
              </span>
              {doneSet.has(cur.i) && (
                <span className="text-xs font-bold" style={{ color: C.okText }}>
                  クリア済み ✓
                </span>
              )}
            </div>
            {cur.e.k === "choice" ? (
              <ChoiceEx
                key={lesson.id + "-" + cur.i}
                ex={cur.e}
                seedKey={lesson.id + ":" + cur.i}
                solved={doneSet.has(cur.i)}
                onMiss={() => onMiss(cur.i)}
                onCorrect={() => onSolve(cur.i)}
              />
            ) : cur.e.k === "tf" ? (
              <TfEx
                key={lesson.id + "-" + cur.i}
                ex={cur.e}
                solved={doneSet.has(cur.i)}
                missed={missedSet.has(cur.i)}
                onMiss={() => onMiss(cur.i)}
                onCorrect={() => onSolve(cur.i)}
              />
            ) : cur.e.k === "reflect" ? (
              <ReflectEx
                key={lesson.id + "-" + cur.i}
                ex={cur.e}
                solved={doneSet.has(cur.i)}
                onCorrect={() => onSolve(cur.i)}
              />
            ) : (
              <FillEx
                key={lesson.id + "-" + cur.i}
                ex={cur.e}
                solved={doneSet.has(cur.i)}
                onMiss={() => onMiss(cur.i)}
                onCorrect={() => onSolve(cur.i)}
              />
            )}
          </div>
        )}

        {cur.kind === "practice" && (
          <div>
            <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: C.stan, fontFamily: MONO }}>
               実機確認 {practiceCount} / {practiceTotal}
            </div>
            <h2 className="mb-3 text-xl font-bold" style={{ color: C.ink }}>
              {cur.practice.title}
            </h2>
            <p className="mb-5 text-sm leading-7" style={{ color: C.body }}>
              <T>{cur.practice.intro}</T>
            </p>
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">実機で確認できた項目</legend>
              {cur.practice.items.map((item) => {
                const inputId = `practice-${lesson.id}-${item.id}`;
                const checked = practiceSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-4"
                    style={{
                      background: checked ? C.okSoft : "#FFFFFF",
                      border: `1.5px solid ${checked ? C.ok : C.line}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => onPractice(item.id, event.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 accent-current"
                        style={{ color: C.okText }}
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={inputId} className="cursor-pointer text-sm font-bold leading-6" style={{ color: C.ink }}>
                          <T>{item.label}</T>
                        </label>
                        <p className="mt-1 text-xs leading-5" style={{ color: C.sub }}>
                          <T>{item.criterion}</T>
                        </p>
                      </div>
                    </div>
                    {item.code && <CodeBlock code={item.code} output={item.out} />}
                  </div>
                );
              })}
            </fieldset>
            <div role="status" aria-live="polite" className="mt-4 text-sm font-bold" style={{ color: practiceComplete ? C.okText : C.sub }}>
              {practiceComplete
                ? "すべての実機確認が完了しました。"
                : `あと ${practiceTotal - practiceCount} 項目を実機で確認してください。`}
            </div>
          </div>
        )}

        {cur.kind === "done" && (
          <div className="py-4 text-center">
            {solvedCount === total ? (
              <div className="pop">
                <div className="mb-4 flex justify-center">
                  <TriDots filled={practiceComplete ? 3 : 2} size={14} />
                </div>
                <h2 className="mb-2 text-2xl font-bold" style={{ color: C.ink }}>
                  {lesson.practice && practiceComplete ? `${lesson.title} 実践完了!` : doneLabel}
                </h2>
                <p className="mb-6 text-sm" style={{ color: C.sub }}>
                  練習問題 {total} 問、すべてクリアしました。
                  {firstSet && firstSet.size > 0 && ` うち ${firstSet.size} 問は一発クリアです!`}
                </p>
                <div className="flex flex-col items-center gap-3">
                  {lesson.practice && includePractice && !practiceComplete ? (
                    <Btn kind="ghost" onClick={() => setIdx(practiceIndex)}>実践チェックへすすむ</Btn>
                  ) : hasNext ? (
                    <Btn onClick={onNextLesson}>{nextLabel}</Btn>
                  ) : (
                    <Btn onClick={onCheat}>チートシートを見る</Btn>
                  )}
                  <Btn kind="quiet" onClick={onHome}>
                    学習ホームにもどる
                  </Btn>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex justify-center">
                  {/* クリア数を3点満点に比例配分する。旧実装は 2/3 クリアでも1点だった(監査A13) */}
                  <TriDots filled={Math.min(2, Math.floor((solvedCount / total) * 3))} size={14} />
                </div>
                <h2 className="mb-2 text-xl font-bold" style={{ color: C.ink }}>
                  おつかれさまでした
                </h2>
                <p className="mb-5 text-sm" style={{ color: C.sub }}>
                  未クリアの練習問題が {total - solvedCount} 問あります。もう一度チャレンジしてみましょう。
                </p>
                <div className="mb-5 flex flex-col items-center gap-2">
                  {lesson.ex.map(
                    (e, i) =>
                      !doneSet.has(i) && (
                        <Btn key={i} kind="ghost" onClick={() => setIdx(lesson.pages.length + i)}>
                          練習問題 {i + 1} にもどる
                        </Btn>
                      )
                  )}
                </div>
                <Btn kind="quiet" onClick={onHome}>
                  学習ホームにもどる
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Btn kind="quiet" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>
          ← 前へ
        </Btn>
        {cur.kind !== "done" && (
          <Btn onClick={() => setIdx(idx + 1)}>
            {items[idx + 1] && items[idx + 1].kind === "done" ? "まとめへ" : "次へ →"}
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Foundation Check
   ============================================================ */

function FoundationCheck({ lesson, practiceSet, onPractice, onHome, onReviewSetup, onCheat, ready }) {
  const practice = lesson.practice;
  const checklistComplete = practice.items.every((item) => practiceSet.has(item.id));
  const complete = ready && checklistComplete;
  const count = practice.items.filter((item) => practiceSet.has(item.id)).length;
  const pct = Math.round((count / practice.items.length) * 100);

  return (
    <div className="rise">
      <div className="mb-5 flex items-center justify-between">
        <button
          className="inline-flex min-h-11 items-center text-sm font-bold"
          style={{ color: C.accentDeep }}
          onClick={onHome}
        >
          ← 学習ホーム
        </button>
        <span className="text-xs font-bold" style={{ color: C.sub, fontFamily: MONO }}>
          {count} / {practice.items.length}
        </span>
      </div>

      <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: C.stan, fontFamily: MONO }}>
        最終確認
      </div>
      <h1 tabIndex={-1} className="mb-2 text-3xl font-bold tracking-tight focus:outline-none" style={{ color: C.ink }}>
        Foundation Check
      </h1>
      <p className="mb-5 text-sm leading-7" style={{ color: C.body }}>
        <T>{practice.intro}</T>
      </p>

      {!ready && (
        <div className="mb-5 rounded-2xl p-4" style={{ background: C.warnSoft, border: `1px solid ${C.warnLine}` }}>
          <p className="text-sm font-bold" style={{ color: C.warnText }}>先にR基礎まで終えるのがおすすめです</p>
          <p className="mt-1 text-xs leading-5" style={{ color: C.warnText }}>
            この画面を直接開くことはできますが、学習ホームへ戻ると、未完了の段階から再開できます。
          </p>
        </div>
      )}

      <div
        role="progressbar"
        aria-label="Foundation Checkの進みぐあい"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mb-5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: C.track }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.ok, transition: "width 0.3s" }} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">実機で確認できた項目</legend>
        {practice.items.map((item) => {
          const inputId = `foundation-${item.id}`;
          const checked = practiceSet.has(item.id);
          return (
            <div
              key={item.id}
              className="rounded-2xl bg-white p-4"
              style={{ border: `1.5px solid ${checked ? C.ok : C.line}`, background: checked ? C.okSoft : "#FFFFFF" }}
            >
              <div className="flex items-start gap-3">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onPractice(item.id, event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-current"
                  style={{ color: C.okText }}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={inputId} className="cursor-pointer text-sm font-bold leading-6" style={{ color: C.ink }}>
                    <T>{item.label}</T>
                  </label>
                  <p className="mt-1 text-xs leading-5" style={{ color: C.sub }}>
                    <T>{item.criterion}</T>
                  </p>
                </div>
              </div>
              {item.code && <CodeBlock code={item.code} output={item.out} />}
            </div>
          );
        })}
      </fieldset>

      <div role="status" aria-live="polite" className="mt-5">
        {complete ? (
          <div className="pop rounded-2xl p-5 text-center" style={{ background: C.accentSoft, border: `1px solid ${C.accentLine}` }}>
            <div className="mb-2 flex justify-center"><TriDots filled={3} size={14} /></div>
            <h2 className="text-xl font-bold" style={{ color: C.accentDeep }}>公開中のR基礎トラックを修了しました</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: C.accentDeep }}>
              RStudioでコードを実行し、保存して、同じ結果を再現する土台ができました。
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <Btn onClick={onCheat}>学んだR文法を復習する</Btn>
              <a
                className="inline-flex min-h-11 items-center text-xs font-bold underline"
                style={{ color: C.accentDeep }}
                href={import.meta.env.BASE_URL + "roadmap.html"}
              >
                この先の公開予定を見る
              </a>
            </div>
          </div>
        ) : checklistComplete ? (
          <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${C.line}` }}>
            <p className="text-sm font-bold" style={{ color: C.okText }}>実機での5項目は確認できました</p>
            <p className="mt-1 text-xs leading-5" style={{ color: C.sub }}>
              公開中トラックの修了には、R基礎の未完了レッスンも終える必要があります。学習ホームが次の場所を案内します。
            </p>
            <button className="mt-2 inline-flex min-h-11 items-center text-xs font-bold underline" style={{ color: C.accentDeep }} onClick={onHome}>
              未完了の段階へ戻る
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${C.line}` }}>
            <p className="text-sm font-bold" style={{ color: C.ink }}>
              あと {practice.items.length - count} 項目を実機で確認してください
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: C.sub }}>
              一度に終えなくても大丈夫です。チェックはこのブラウザに保存されます。
            </p>
            <button className="mt-2 inline-flex min-h-11 items-center text-xs font-bold underline" style={{ color: C.accentDeep }} onClick={onReviewSetup}>
              STEP 0の手順を見直す
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ホーム画面
   ============================================================ */

function Home({ progress, storageNotice, exportText, onImport, onImportError, onOpen, onFoundation, onCheat, onReset }) {
  const totalEx = LESSONS.reduce((s, l) => s + l.ex.length, 0);
  const doneEx = LESSONS.reduce((s, l) => s + (progress.done[l.id] || []).length, 0);
  const doneLessons = LESSONS.filter((lesson) => lessonIsUnderstood(progress, lesson)).length;
  const foundationLesson = LESSONS.find((lesson) => lesson.id === FOUNDATION_LESSON_ID);
  const practiceTotal = foundationLesson.practice.items.length;
  const practiceCount = (progress.practice?.[FOUNDATION_LESSON_ID] || []).length;
  const journey = getJourneyState(progress);
  const pct = Math.round(((doneEx + practiceCount) / (totalEx + practiceTotal)) * 100);
  const dotsFilled = journey.complete ? 3 : Math.min(2, Math.floor((journey.completedStages / JOURNEY_STAGES.length) * 3));

  const openJourneyTarget = () => {
    if (journey.targetView?.name === "lesson") onOpen(journey.targetView.id);
    if (journey.targetView?.name === "foundation") onFoundation();
  };

  return (
    <div className="rise">
      <div className="mb-4 flex items-center justify-between pt-1">
        <TriDots filled={dotsFilled} size={13} />
        <button
          className="inline-flex min-h-11 items-center text-xs font-bold underline"
          style={{ color: C.accentDeep }}
          onClick={onCheat}
        >
          チートシート
        </button>
      </div>

      <h1 tabIndex={-1} className="mb-1.5 text-3xl font-bold tracking-tight focus:outline-none" style={{ color: C.ink }}>
        はじめてのRとStan
      </h1>
      <p className="mb-6 text-sm leading-6" style={{ color: C.sub }}>
        プログラミング未経験から、研究でRを使うための土台を作ります。現在公開中なのはRの基礎とRStudioの環境構築までで、Stanとベイズ統計は今後の公開予定です。
      </p>

      <section aria-labelledby="orientation-title" className="mb-6 rounded-2xl bg-white p-5" style={{ border: "1px solid " + C.line }}>
        <h2 id="orientation-title" className="text-base font-bold" style={{ color: C.ink }}>最初に知っておくこと</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["対象", "Rを初めて学ぶ人"],
            ["最初の体験", "5〜10分・準備不要"],
            ["公開範囲", "R基礎とRStudio"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: C.accentSoft }}>
              <div className="text-xs font-bold" style={{ color: C.accentDeep }}>{label}</div>
              <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="next-action-title" className="mb-6 rounded-2xl p-5" style={{ background: journey.complete ? C.okSoft : C.accentSoft, border: `1px solid ${journey.complete ? C.okLine : C.accentLine}` }}>
        {journey.complete ? (
          <>
            <div className="mb-2 flex justify-center sm:justify-start"><TriDots filled={3} size={14} /></div>
            <h2 id="next-action-title" className="text-xl font-bold" style={{ color: C.okText }}>公開中のR基礎トラックを修了しました</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: C.okText }}>
              ここからは、学んだ文法を見直すか、この先の公開予定を確認できます。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Btn onClick={onCheat}>学んだR文法を復習する</Btn>
              <a className="inline-flex min-h-11 items-center text-xs font-bold underline" style={{ color: C.accentDeep }} href={import.meta.env.BASE_URL + "roadmap.html"}>
                この先の公開予定を見る
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-bold tracking-wide" style={{ color: C.accentDeep }}>{journey.stage.label} ・ 現在地</div>
            <h2 id="next-action-title" className="mt-1 text-xl font-bold" style={{ color: C.ink }}>
              次にすること: {journey.targetLesson?.title || journey.stage.title}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: C.body }}>{journey.stage.description}</p>
            <p className="mt-2 text-xs font-bold" style={{ color: C.sub }}>
              目安 {journey.stage.time} ・ {journey.stage.install}
            </p>
            <div className="mt-4"><Btn onClick={openJourneyTarget}>{journey.cta}</Btn></div>
          </>
        )}
      </section>

      <section aria-labelledby="progress-title" className="mb-6 rounded-2xl bg-white p-5" style={{ border: "1px solid " + C.line }}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="progress-title" className="text-sm font-bold" style={{ color: C.ink }}>公開中トラックの進みぐあい</h2>
          <span className="text-xs font-bold" style={{ color: C.sub, fontFamily: MONO }}>
            {pct}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="公開中トラックの進みぐあい"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ background: C.track }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: pct + "%", background: C.accent, transition: "width 0.4s" }}
          />
        </div>
        <div className="mt-3 text-xs" style={{ color: C.faint }}>
          理解済み {doneLessons} / {LESSONS.length} レッスン ・ 実機確認 {practiceCount} / {practiceTotal} 項目
        </div>
      </section>

      <section aria-labelledby="path-title" className="mb-6">
        <h2 id="path-title" className="mb-3 text-base font-bold" style={{ color: C.ink }}>学習の道すじ</h2>
        <ol className="flex flex-col gap-3">
          {JOURNEY_STAGES.map((stage, index) => {
            const status = getStageStatus(stage, progress);
            return (
              <li key={stage.id} className="flex gap-3 rounded-2xl bg-white p-4" style={{ border: `1px solid ${status === "current" ? C.accentLine : status === "done" ? C.okLine : C.line}` }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: status === "done" ? C.okSoft : status === "current" ? C.accentSoft : C.track, color: status === "done" ? C.okText : status === "current" ? C.accentDeep : C.faint }}>
                  {status === "done" ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-bold" style={{ color: status === "current" ? C.accentDeep : C.sub }}>{stage.label}</span>
                    <span className="text-sm font-bold" style={{ color: C.ink }}>{stage.title}</span>
                    {status === "current" && <span className="text-xs font-bold" style={{ color: C.accentDeep }}>現在地</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5" style={{ color: C.sub }}>{stage.time} ・ {stage.install}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <details className="rounded-2xl bg-white" style={{ border: `1px solid ${C.line}` }}>
        <summary className="cursor-pointer p-4 text-sm font-bold" style={{ color: C.accentDeep }}>
          全{LESSONS.length}レッスンを見る
        </summary>
        <div className="flex flex-col gap-6 border-t p-4" style={{ borderColor: C.line }}>
          {JOURNEY_STAGES.filter((stage) => stage.lessonIds.length > 0).map((stage) => (
            <div key={stage.id}>
              <h3 className="mb-2 text-xs font-bold" style={{ color: C.sub }}>{stage.label} / {stage.title}</h3>
              <div className="flex flex-col gap-2">
                {stage.lessonIds.map((id) => {
                  const lesson = LESSONS.find((item) => item.id === id);
                  const got = (progress.done[lesson.id] || []).length;
                  const understood = lessonIsUnderstood(progress, lesson);
                  const badge = getLessonPathMeta(lesson)?.badge;
                  return (
                    <button key={lesson.id} onClick={() => onOpen(lesson.id)} className="flex items-center gap-3 rounded-xl p-3 text-left" style={{ background: understood ? C.okSoft : C.paper }}>
                      <span className="w-9 shrink-0 text-center text-xs font-bold" style={{ color: understood ? C.okText : C.accentDeep, fontFamily: MONO }}>{understood ? "✓" : badge}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold" style={{ color: C.ink }}>{lesson.title}</span>
                        <span className="block text-xs" style={{ color: C.sub }}>{lesson.tag}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold" style={{ color: understood ? C.okText : C.faint }}>{understood ? "理解済" : `${got} / ${lesson.ex.length}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={onFoundation} className="flex items-center gap-3 rounded-xl p-3 text-left" style={{ background: getStageStatus(JOURNEY_STAGES.at(-1), progress) === "done" ? C.okSoft : C.paper }}>
            <span className="w-9 shrink-0 text-center text-xs font-bold" style={{ color: C.stan, fontFamily: MONO }}>確認</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold" style={{ color: C.ink }}>Foundation Check</span>
              <span className="block text-xs" style={{ color: C.sub }}>実機で実行・保存・再実行を確認</span>
            </span>
            <span className="shrink-0 text-xs font-bold" style={{ color: C.faint }}>{practiceCount} / {practiceTotal}</span>
          </button>
        </div>
      </details>

      <div className="mt-8 flex flex-col items-center gap-2 pb-6 text-center">
        <p className="text-xs" style={{ color: C.faint }}>
          進みぐあいはこのブラウザに保存され、サーバーには送信されません
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a
            className="inline-flex min-h-11 items-center text-xs font-bold underline"
            style={{ color: C.accentDeep }}
            href={`data:application/json;charset=utf-8,${encodeURIComponent(exportText)}`}
            download="learning-stan-progress.json"
          >
            保存データを書き出す
          </a>
          <label
            className="inline-flex min-h-11 cursor-pointer items-center text-xs font-bold underline"
            style={{ color: C.accentDeep }}
          >
            保存データを読み込む
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 1024 * 1024) {
                  onImportError("保存データは1 MB以下のJSONファイルを選んでください。");
                  event.target.value = "";
                  return;
                }
                try {
                  onImport(await file.text());
                } catch {
                  onImport("{invalid-json");
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </label>
        </div>
        {storageNotice && (
          <p role="status" className="text-xs leading-5" style={{ color: C.warnText }}>
            {storageNotice}
          </p>
        )}
        <a className="inline-flex min-h-11 items-center text-xs font-bold underline" style={{ color: C.accentDeep }} href={import.meta.env.BASE_URL + "roadmap.html"}>この先の公開予定を見る</a>
        <ResetButton onReset={onReset} />
      </div>
    </div>
  );
}

/* ============================================================
   サイドパネル(レッスンの目次)
   lg以上の画面幅でのみ表示する。モバイルはホーム画面が目次を兼ねる
   ============================================================ */

function Sidebar({ progress, currentId, viewName, onOpen, onFoundation, onCheat, onHome }) {
  return (
    <nav
      aria-label="レッスンの目次"
      className="hidden w-60 shrink-0 lg:block"
      style={{
        position: "sticky",
        top: 24,
        alignSelf: "flex-start",
        maxHeight: "calc(100vh - 48px)",
        overflowY: "auto",
      }}
    >
      <button
        onClick={onHome}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        style={{ color: viewName === "home" ? C.accentDeep : C.ink }}
        aria-current={viewName === "home" ? "page" : undefined}
      >
        <TriDots filled={3} size={8} />
        はじめてのRとStan
      </button>

      <div className="flex flex-col gap-4 pb-4">
        {JOURNEY_STAGES.map((stage) => {
          if (stage.kind === "foundation") {
            const current = viewName === "foundation";
            const done = getStageStatus(stage, progress) === "done";
            return (
              <div key={stage.id}>
                <div className="mb-1 text-xs font-bold" style={{ color: C.sub }}>{stage.label}</div>
                <button
                  onClick={onFoundation}
                  aria-current={current ? "page" : undefined}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                  style={current ? { background: C.accentSoft, color: C.accentDeep, fontWeight: 700 } : { color: C.body }}
                >
                  <span className="w-8 shrink-0 text-right" style={{ fontFamily: MONO, color: current ? C.accentDeep : C.faint }}>確認</span>
                  <span className="min-w-0 flex-1 truncate">Foundation Check</span>
                  {done && <span aria-label="修了" style={{ color: C.okText }}>✓</span>}
                </button>
              </div>
            );
          }
          return (
            <div key={stage.id}>
              <div className="mb-1 text-xs font-bold" style={{ color: C.sub }}>{stage.label} / {stage.title}</div>
              <div className="flex flex-col">
                {stage.lessonIds.map((id) => {
                  const lesson = LESSONS.find((item) => item.id === id);
                  const understood = lessonIsUnderstood(progress, lesson);
                  const current = viewName === "lesson" && lesson.id === currentId;
                  const badge = getLessonPathMeta(lesson)?.badge;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => onOpen(lesson.id)}
                      aria-current={current ? "page" : undefined}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                      style={
                        current
                          ? { background: C.accentSoft, color: C.accentDeep, fontWeight: 700 }
                          : { color: C.body }
                      }
                    >
                      <span className="w-6 shrink-0 text-right" style={{ fontFamily: MONO, color: current ? C.accentDeep : C.faint }}>
                        {badge}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      {understood && (
                        <span aria-label="修了" style={{ color: C.okText }}>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col border-t pt-3" style={{ borderColor: C.line }}>
        <button
          onClick={onCheat}
          aria-current={viewName === "cheat" ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold"
          style={viewName === "cheat" ? { background: C.accentSoft, color: C.accentDeep } : { color: C.accentDeep }}
        >
          チートシート
        </button>
        <a
          href={import.meta.env.BASE_URL + "roadmap.html"}
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold"
          style={{ color: C.accentDeep }}
        >
          この先の公開予定
        </a>
      </div>
    </nav>
  );
}

/* ============================================================
   チートシート画面
   ============================================================ */

function CheatSheet({ onHome }) {
  return (
    <div className="rise">
      <div className="mb-5 flex items-center justify-between">
        <button
          className="inline-flex min-h-11 items-center text-sm font-bold"
          style={{ color: C.accentDeep }}
          onClick={onHome}
        >
          ← もどる
        </button>
        <TriDots filled={3} size={10} />
      </div>
      <h1 tabIndex={-1} className="mb-1 text-2xl font-bold tracking-tight focus:outline-none" style={{ color: C.ink }}>
        R チートシート
      </h1>
      <p className="mb-5 text-sm" style={{ color: C.sub }}>
        レッスンで学んだ文法の早見表です。分析のおともに、いつでも見返せます。
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CHEATS.map((sec, i) => (
          <div key={i} className="rounded-2xl bg-white p-4" style={{ border: "1px solid " + C.line }}>
            <h2 className="mb-3 text-sm font-bold" style={{ color: C.accent }}>
              {sec.title}
            </h2>
            <div className="flex flex-col gap-2.5">
              {sec.rows.map((r, j) => (
                <div key={j} className="flex items-start justify-between gap-3">
                  <code
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs leading-5"
                    style={{ background: C.chip, color: C.accentDeep, fontFamily: MONO }}
                  >
                    {r[0]}
                  </code>
                  <span className="pt-0.5 text-right text-xs leading-5" style={{ color: C.sub }}>
                    {r[1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-5 rounded-2xl p-4 text-sm leading-6"
        style={{ background: C.accentSoft, border: "1px solid " + C.accentLine, color: C.accentDeep }}
      >
        <span className="font-bold">次に迷ったら:</span>
        学習ホームへ戻ると、保存済みの進捗から次に取り組む段階を案内します。
      </div>
      <div className="h-8" />
    </div>
  );
}


export { LessonView, FoundationCheck, Home, CheatSheet, Sidebar };
