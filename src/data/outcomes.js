// 到達目標―評価対応表の正本。
// exerciseIndex は0始まり。direct は目標動詞を直接測る証拠、supporting は前提知識の確認。
export const OUTCOMES = [
  {
    lessonId: "l1",
    goalId: "explain-r-and-output",
    statement: "Rがどんな言語で、コードを書くと何が起きるのかを説明できる",
    level: "explain",
    dimensions: ["language", "execution"],
    evidence: [
      { kind: "exercise", exerciseIndex: 1, method: "selected-response", strength: "supporting", dimensions: ["execution"], criterion: "コードと表示結果を対応付ける" },
      { kind: "exercise", exerciseIndex: 2, method: "selected-response", strength: "supporting", dimensions: ["language"], criterion: "Rの主用途を識別する" },
      { kind: "exercise", exerciseIndex: 3, method: "constructed-response", strength: "direct", dimensions: ["language", "execution"], criterion: "Rの用途とコード実行を自分の言葉で説明する" },
    ],
  },
  {
    lessonId: "l2",
    goalId: "assign-and-calculate",
    statement: "変数に値を入れて計算できる",
    level: "apply",
    dimensions: ["assignment", "calculation"],
    evidence: [
      { kind: "exercise", exerciseIndex: 0, method: "selected-response", strength: "direct", dimensions: ["calculation"], criterion: "代入後の計算結果を予測する" },
      { kind: "exercise", exerciseIndex: 1, method: "constructed-response", strength: "direct", dimensions: ["assignment"], criterion: "代入コードを自力で完成する" },
    ],
  },
  {
    lessonId: "l3",
    goalId: "identify-types",
    statement: "値の型を見分けることができる",
    level: "analyze",
    dimensions: ["type-identification"],
    evidence: [
      { kind: "exercise", exerciseIndex: 0, method: "selected-response", strength: "direct", dimensions: ["type-identification"], criterion: "numericのclass出力を識別する" },
      { kind: "exercise", exerciseIndex: 1, method: "selected-response", strength: "direct", dimensions: ["type-identification"], criterion: "characterとlogicalを区別する" },
      { kind: "exercise", exerciseIndex: 2, method: "selected-response", strength: "direct", dimensions: ["type-identification"], criterion: "NAを含む型の説明を判定する" },
    ],
  },
  {
    lessonId: "l4",
    goalId: "operate-on-vectors",
    statement: "複数の値をまとめて扱うことができる",
    level: "apply",
    dimensions: ["vector-operation", "indexing"],
    evidence: [
      { kind: "exercise", exerciseIndex: 0, method: "selected-response", strength: "direct", dimensions: ["vector-operation"], criterion: "ベクトル演算の結果を予測する" },
      { kind: "exercise", exerciseIndex: 1, method: "constructed-response", strength: "direct", dimensions: ["indexing"], criterion: "添字で指定要素を取り出す" },
    ],
  },
  {
    lessonId: "l5",
    goalId: "build-strings-and-categories",
    statement: "文字列を組み立て、条件をカテゴリとして表すことができる",
    level: "apply",
    dimensions: ["string-construction", "categorical-representation"],
    evidence: [
      { kind: "exercise", exerciseIndex: 1, method: "selected-response", strength: "supporting", dimensions: ["categorical-representation"], criterion: "カテゴリにfactorを選ぶ" },
      { kind: "exercise", exerciseIndex: 3, method: "constructed-response", strength: "direct", dimensions: ["string-construction"], criterion: "paste0の呼び出しを自力で書く" },
      { kind: "exercise", exerciseIndex: 4, method: "constructed-response", strength: "direct", dimensions: ["categorical-representation"], criterion: "水準順を明示してfactorを作る" },
    ],
  },
  {
    lessonId: "l6",
    goalId: "branch-on-condition",
    statement: "条件によって処理を変えることができる",
    level: "apply",
    dimensions: ["condition", "branch-selection"],
    evidence: [
      { kind: "exercise", exerciseIndex: 0, method: "selected-response", strength: "direct", dimensions: ["branch-selection"], criterion: "ifの実行結果を予測する" },
      { kind: "exercise", exerciseIndex: 3, method: "constructed-response", strength: "direct", dimensions: ["condition"], criterion: "目的に合う比較条件を書く" },
    ],
  },
  {
    lessonId: "l7",
    goalId: "loop-and-vectorize",
    statement: "くり返し処理を書き、Rらしいベクトル化の書き方に置き換えることができる",
    level: "apply",
    dimensions: ["loop", "vectorization"],
    evidence: [
      { kind: "exercise", exerciseIndex: 3, method: "constructed-response", strength: "direct", dimensions: ["loop"], criterion: "forの反復指定を書く" },
      { kind: "exercise", exerciseIndex: 4, method: "constructed-response", strength: "direct", dimensions: ["vectorization"], criterion: "ループをsumへ置き換える" },
    ],
  },
  {
    lessonId: "l8",
    goalId: "define-and-call-function",
    statement: "自分で関数を作って呼び出すことができる",
    level: "apply",
    dimensions: ["definition", "call"],
    evidence: [
      { kind: "exercise", exerciseIndex: 0, method: "selected-response", strength: "direct", dimensions: ["call"], criterion: "関数呼び出しの返り値を予測する" },
      { kind: "exercise", exerciseIndex: 1, method: "constructed-response", strength: "direct", dimensions: ["definition"], criterion: "functionキーワードを使う" },
      { kind: "exercise", exerciseIndex: 3, method: "constructed-response", strength: "direct", dimensions: ["definition"], criterion: "引数を使う関数本体を書く" },
    ],
  },
  {
    lessonId: "l9",
    goalId: "summarize-data-frame",
    statement: "表形式のデータから平均や標準偏差を求めることができる",
    level: "apply",
    dimensions: ["mean", "sd"],
    evidence: [
      { kind: "exercise", exerciseIndex: 0, method: "selected-response", strength: "supporting", dimensions: ["mean", "sd"], criterion: "$で対象列を識別する" },
      { kind: "exercise", exerciseIndex: 3, method: "constructed-response", strength: "direct", dimensions: ["mean"], criterion: "欠損を除く平均コードを書く" },
      { kind: "exercise", exerciseIndex: 4, method: "constructed-response", strength: "direct", dimensions: ["sd"], criterion: "標準偏差コードを書く" },
    ],
  },
  {
    lessonId: "l10",
    goalId: "run-r-locally",
    statement: "自分のPCでRStudioを使い、ConsoleとProject内のScriptからRコードを実行し、必要なパッケージを読み込むことができる",
    level: "perform",
    dimensions: ["console", "script", "project", "package"],
    evidence: [
      { kind: "practice", itemId: "calculation", method: "self-attested-performance", strength: "direct", dimensions: ["console"], criterion: "Consoleで計算結果を得る" },
      { kind: "practice", itemId: "script", method: "self-attested-performance", strength: "direct", dimensions: ["script"], criterion: "保存したScriptを再実行する" },
      { kind: "practice", itemId: "project", method: "self-attested-performance", strength: "direct", dimensions: ["project"], criterion: "Project内で作業を再開する" },
      { kind: "practice", itemId: "package", method: "self-attested-performance", strength: "direct", dimensions: ["package"], criterion: "パッケージを導入・再読込する" },
    ],
  },
];
