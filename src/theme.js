// 配色・フォント・グローバルCSS（R青とStan赤のアイデンティティ）
// 文字色はすべて WCAG AA (4.5:1) 以上を実測確認済み。値を変えるときは再計算すること。
const C = {
  paper: "#FBFAF7",
  ink: "#2A2733",
  body: "#4A4454",
  sub: "#6E6879",
  faint: "#726B7E", // paper 上 4.88:1

  // 主アクセント（R の青）。ボタン・進捗バー・現在地の表示に使う
  accent: "#276DC3", // 装飾・白文字ボタン背景（白文字で 5.17:1）
  accentDeep: "#1B4E8F", // 白/淡色背景上のテキスト用（paper 上 7.94:1、accentSoft 上 7.23:1）
  accentSoft: "#E9F0FA",

  // 正解・実行結果（成功のシグナル）
  ok: "#389826", // 装飾用
  okText: "#2B7A1E", // paper 上 5.15:1、okSoft 上 4.82:1
  okSoft: "#EAF6E6",

  // 誤答・エラー（Stan の赤と同系。警告のシグナル）
  alert: "#B0182D", // 装飾用
  alertText: "#9A1526", // paper 上 8.02:1、alertSoft 上 7.13:1
  alertSoft: "#F9E9EB",

  // Stan編の識別色（3色ドットの3つ目）
  stan: "#7C1128",

  night: "#272134",
  line: "#E8E4DC",
  edge: "#8A8296", // 入力欄など操作要素の境界線(非テキスト3:1を満たす)
  track: "#EFEBE2",
};

const JP =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, sans-serif';
const MONO =
  'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const GLOBAL_CSS = `
@keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.rise { animation: riseIn 0.28s ease-out both; }
@keyframes popIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.pop { animation: popIn 0.22s ease-out both; }
@media (prefers-reduced-motion: reduce) { .rise, .pop { animation: none; } }
input::placeholder { color: #6E6879; opacity: 1; }
:where(button, a, input, [tabindex]):focus-visible { outline: 3px solid #1B4E8F; outline-offset: 2px; }
`;

export { C, JP, MONO, GLOBAL_CSS };
