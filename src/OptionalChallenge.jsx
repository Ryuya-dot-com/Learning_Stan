import { useState } from "react";
import { C } from "./theme.js";
import { Btn, CodeBlock, T } from "./components.jsx";

const MIN_ANSWER_LENGTH = 80;

function ChallengeReview({ challenge }) {
  return (
    <div
      className="mt-4 rounded-xl p-4"
      style={{ background: C.warnSoft, border: `1px solid ${C.warnLine}` }}
    >
      <p className="text-sm font-bold" style={{ color: C.warnText }}>評価の観点</p>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6" style={{ color: C.body }}>
        {challenge.rubric.map((criterion) => (
          <li key={criterion}><T>{criterion}</T></li>
        ))}
      </ul>

      <p className="mb-1 mt-4 text-xs font-bold" style={{ color: C.warnText }}>解答例</p>
      <p className="text-sm leading-7" style={{ color: C.body }}>
        <T>{challenge.example}</T>
      </p>
      <p className="mt-3 text-xs leading-5" style={{ color: C.sub }}>
        解答例と表現が同じである必要はありません。評価の観点を使い、自分の案に不足がないか確かめてください。
      </p>
    </div>
  );
}

export default function OptionalChallenge({ challenge, lessonId }) {
  const [answer, setAnswer] = useState("");
  const [showReview, setShowReview] = useState(false);
  const answerId = `challenge-answer-${lessonId}`;
  const canReview = answer.trim().length >= MIN_ANSWER_LENGTH;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: C.warnSoft, color: C.warnText }}
        >
          任意チャレンジ
        </span>
        <span className="text-xs font-bold" style={{ color: C.sub }}>
          歯応えあり・修了条件には含みません
        </span>
      </div>

      <h2 className="mb-3 text-xl font-bold" style={{ color: C.ink }}>{challenge.title}</h2>
      <div className="rounded-xl p-4" style={{ background: C.track, border: `1px solid ${C.line}` }}>
        <p className="text-xs font-bold" style={{ color: C.sub }}>状況</p>
        <p className="mt-1 text-sm leading-7" style={{ color: C.body }}>
          <T>{challenge.scenario}</T>
        </p>
      </div>

      <p className="mb-1 mt-4 text-xs font-bold" style={{ color: C.accentDeep }}>課題</p>
      <p className="text-base font-bold leading-7" style={{ color: C.ink }}>
        <T>{challenge.task}</T>
      </p>
      {challenge.code && (
        <div className="mt-4">
          <CodeBlock code={challenge.code} lang="R" />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {challenge.hints.map((hint, index) => (
          <details
            key={hint}
            className="rounded-lg px-3 py-2"
            style={{ background: C.accentSoft, border: `1px solid ${C.accentLine}` }}
          >
            <summary className="min-h-7 cursor-pointer text-sm font-bold" style={{ color: C.accentDeep }}>
              段階ヒント {index + 1}
            </summary>
            <p className="mt-2 text-sm leading-6" style={{ color: C.body }}>
              <T>{hint}</T>
            </p>
          </details>
        ))}
      </div>

      <label htmlFor={answerId} className="mb-1 mt-5 block text-xs font-bold" style={{ color: C.sub }}>
        自分の設計と判断（本文は保存されません）
      </label>
      <textarea
        id={answerId}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={7}
        className="w-full rounded-xl p-3 text-sm leading-6"
        style={{ border: `1.5px solid ${C.edge}`, color: C.ink, background: "#FFFFFF" }}
      />

      {!showReview && (
        <div className="mt-3">
          <Btn onClick={() => setShowReview(true)} disabled={!canReview}>
            評価の観点と解答例を見る
          </Btn>
          {!canReview && (
            <p className="mt-2 text-xs" style={{ color: C.faint }}>
              まず自分の言葉で{MIN_ANSWER_LENGTH}文字以上書いてみましょう。難しい場合は段階ヒントを開けます。
            </p>
          )}
        </div>
      )}

      {showReview && <ChallengeReview challenge={challenge} />}
    </div>
  );
}
