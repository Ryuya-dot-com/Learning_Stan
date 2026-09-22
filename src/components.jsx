import { useState, useEffect, useRef, lazy, Suspense } from "react";
const MathBlock = lazy(() => import("./MathBlock.jsx"));
import { C, MONO } from "./theme.js";
import { tokenizeLine, TOK_COLOR } from "./highlight.js";


/* ---------------- 小さな部品 ---------------- */

// 本文中の `code` をインラインコード表示にする
function T({ children }) {
  const parts = String(children).split("`");
  const inlineStyle = {
    background: C.accentSoft,
    color: C.accentDeep,
    fontFamily: MONO,
    fontSize: "0.88em",
    margin: "0 1px",
  };
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 && /^https:\/\/\S+$/.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-1.5 py-0.5 underline"
            style={{ ...inlineStyle, textUnderlineOffset: "2px" }}
          >
            {p}
          </a>
        ) : i % 2 === 1 ? (
          <code
            key={i}
            className="rounded px-1.5 py-0.5"
            style={inlineStyle}
          >
            {p}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function LessonBlock({ value, title }) {
  if (value?.type === "table") return (
    <div className="mb-4 overflow-x-auto" role="region" aria-label={`${title}の比較表`} tabIndex={0}>
      <table className="lesson-table text-sm">
        <caption className="sr-only">{title}の比較表</caption>
        <thead><tr>{value.headers.map((cell, i) => <th scope="col" key={i}><T>{cell}</T></th>)}</tr></thead>
        <tbody>{value.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}><T>{cell}</T></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  if (value?.type === "math") return <Suspense fallback={<pre>{value.tex}</pre>}><MathBlock tex={value.tex} /></Suspense>;
  if (value?.type === "note") return <aside className="lesson-note mb-3 text-sm leading-7"><T>{value.text}</T></aside>;
  return <p className="mb-3 text-sm leading-7" style={{ color: C.body }}><T>{value}</T></p>;
}

function CodeBlock({ code, output, error, lang }) {
  // lang: ヘッダのラベル兼ハイライトの言語指定。省略時は "R"。
  // "Stan" で Stan 用の色分け、それ以外（"ターミナル" など）はキーワード着色なし
  const lines = code.split("\n");
  return (
    <div className="code-shell my-4 overflow-hidden rounded-xl" style={{ border: "1px solid " + C.line }}>
      <div className="code-toolbar flex items-center px-4 py-2.5" style={{ background: C.night }}>
        <span
          className="code-language text-xs font-bold tracking-wide"
          data-language={(lang || "R").toLowerCase()}
          style={{ color: C.dim }}
        >
          {lang || "R"}
        </span>
        <span className="code-caption ml-auto text-[10px] font-semibold tracking-widest" style={{ color: C.dim }}>
          SOURCE
        </span>
      </div>
      <pre
        className="overflow-x-auto px-4 pb-4 pt-2 text-sm leading-7"
        style={{ background: C.night, fontFamily: MONO }}
      >
        {lines.map((ln, i) => (
          <div key={i}>
            {ln === ""
              ? "\u00A0"
              : tokenizeLine(ln, lang).map((t, j) => (
                  <span key={j} style={TOK_COLOR[t[0]]}>
                    {t[1]}
                  </span>
                ))}
          </div>
        ))}
      </pre>
      {output != null && (
        <div className="px-4 py-3" style={{ background: "#FFFFFF", borderTop: "1px solid " + C.line }}>
          <div
            className="mb-1 text-xs font-bold tracking-wide"
            style={{ color: error ? C.alert : C.okText }}
          >
            ▶ 実行結果
          </div>
          <pre
            className="overflow-x-auto whitespace-pre-wrap text-sm leading-6"
            style={{ fontFamily: MONO, color: error ? C.alert : C.ink }}
          >
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

// R → 検証 → Stan の学習経路を表すセグメントマーク。
// Julia版由来の3色ドットを、教材固有の「つながる工程」へ置き換える。
function LearningMark({ filled = 3, size = 12 }) {
  const cols = [C.accent, C.ok, C.stan];
  return (
    <span className="learning-mark inline-flex items-center" aria-hidden="true" style={{ gap: Math.max(2, size / 4) }}>
      {cols.map((col, i) => (
        <span
          key={i}
          className="learning-mark__segment rounded-full"
          style={{
            width: i === 1 ? size : size * 1.75,
            height: Math.max(4, size / 2),
            background: i < filled ? col : "transparent",
            border: "1.5px solid " + col,
            opacity: i < filled ? 1 : 0.4,
            transition: "background 0.3s, opacity 0.3s",
          }}
        />
      ))}
    </span>
  );
}

function Btn({ kind = "primary", className = "", style = {}, ...props }) {
  const base =
    "ui-button inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40";
  const kinds = {
    primary: { background: C.accent, color: "#FFFFFF" },
    ghost: { background: "transparent", color: C.accent, border: "1.5px solid " + C.accent },
    quiet: { background: "#FFFFFF", color: C.sub, border: "1px solid " + C.line },
  };
  return <button className={base + " " + className} style={{ ...kinds[kind], ...style }} {...props} />;
}

function ResetButton({ onReset }) {
  // 確認状態は時間で勝手に解除しない(時間制限はWCAG違反——監査A15)。フォーカスが外れたら解除する
  const [arm, setArm] = useState(false);
  const confirmRef = useRef(null);
  const hit = "inline-flex min-h-11 items-center px-2"; // タッチターゲット44px確保(監査A16)
  useEffect(() => {
    if (arm) confirmRef.current?.focus();
  }, [arm]);
  return arm ? (
    <button
      ref={confirmRef}
      className={hit + " text-xs font-bold underline"}
      style={{ color: C.alert }}
      onClick={onReset}
      onBlur={() => setArm(false)}
    >
      本当にリセットする(進みぐあいが消えます)
    </button>
  ) : (
    <button className={hit + " text-xs underline"} style={{ color: C.faint }} onClick={() => setArm(true)}>
      進みぐあいをリセット
    </button>
  );
}

const PRAISE = ["正解です!", "すばらしい!", "その調子です!", "バッチリです!"];

function Feedback({ status, why, hint, showHint, onHint }) {
  // 常設のライブリージョンで正誤を読み上げ環境へ伝える(監査A4)。
  // 正解時は操作していた要素がdisabledになりフォーカスが落ちるため、ここへ移す(監査A5)。
  // ただし「正解した瞬間」の遷移のみ。クリア済み問題は status="correct" で初期マウントされるため、
  // マウント時にも発火させるとページ送りのたびにフォーカスを奪ってしまう(検証で検出)
  const boxRef = useRef(null);
  const prevStatus = useRef(status);
  useEffect(() => {
    if (status === "correct" && prevStatus.current !== "correct" && boxRef.current) {
      boxRef.current.focus();
    }
    prevStatus.current = status;
  }, [status]);

  return (
    <div role="status" aria-live="polite" ref={boxRef} tabIndex={-1} className="focus:outline-none">
      {status === "correct" && (
        <div className="pop mt-4 rounded-xl p-4" style={{ background: C.okSoft, border: "1px solid " + C.okLine }}>
          <div className="mb-1.5 flex items-center gap-2 text-sm font-bold" style={{ color: C.okText }}>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
              style={{ background: C.okText, color: "#FFFFFF" }}
            >
              ✓
            </span>
            {PRAISE[why.length % PRAISE.length]}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: C.okDeep }}>
            <T>{why}</T>
          </p>
        </div>
      )}
      {status === "wrong" && (
        <div className="rise mt-4 rounded-xl p-4" style={{ background: C.warnSoft, border: "1px solid " + C.warnLine }}>
          <div className="mb-1.5 text-sm font-bold" style={{ color: C.warnText }}>
            おしい!もう一度考えてみましょう
          </div>
          {showHint ? (
            <p className="text-sm leading-relaxed" style={{ color: C.warnBody }}>
              ヒント:<T>{hint}</T>
            </p>
          ) : (
            <button
              className="inline-flex min-h-11 items-center text-sm font-bold underline"
              style={{ color: C.warnText }}
              onClick={onHint}
            >
              ヒントを見る
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export { T, LessonBlock, CodeBlock, LearningMark, Btn, ResetButton, Feedback };
