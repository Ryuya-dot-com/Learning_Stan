// セクション定義: 順序・配色・番号の有無・ノートブックの対応。
// レッスンの実体は lessons/<dir>/ 配下のファイル。レッスンが0本のセクションは表示されない。
// 新しいセクションを増やすときだけ、ここに1行足す。
export const SECTIONS = [
  { dir: "0-basics", title: "基礎編",                          sub: "文法の土台",             color: "#2A2733", numbered: true },
  { dir: "1-setup",  title: "STEP 0 / R環境構築",              sub: "RとRStudioを手元に",      color: "#8A5A00", numbered: true },
  { dir: "2-data",   title: "STEP 1 / データ操作編",            sub: "実データを読み、整える",   color: "#276DC3", numbered: true, notebook: "nb1-data.qmd" },
  { dir: "3-stats",  title: "STEP 2 / 統計・可視化編",          sub: "数字と図で、結果を語る",   color: "#2E7D1F", numbered: true, notebook: "nb2-stats.qmd" },
  { dir: "4-sim",    title: "STEP 3 / シミュレーションと確率",   sub: "乱数で統計を体験する",     color: "#6D3E86", numbered: true, notebook: "nb3-sim.qmd" },
  { dir: "5-bayes",  title: "STEP 4 / ベイズ推定の考え方",       sub: "事前 × 尤度 → 事後",      color: "#0A6570", numbered: true, notebook: "nb4-bayes.qmd" },
  { dir: "6-brms",   title: "STEP 5 / brmsでベイズモデリング",   sub: "式を書けば、ベイズが動く", color: "#B0182D", numbered: true, notebook: "nb5-brms.qmd" },
  { dir: "7-stan",   title: "STEP 6 / Stan言語の世界",          sub: "ブラックボックスを開ける", color: "#7C1128", numbered: true, notebook: "nb6-stan.qmd" },
  { dir: "bridge",   title: "頻度主義との橋渡し",                sub: "独立トラック",           color: "#566B8D", numbered: false, mark: "橋" },
  { dir: "extra",    title: "補講",                             sub: "いつでも差しこめる",      color: "#6E6879", numbered: false, mark: "補" },
];
