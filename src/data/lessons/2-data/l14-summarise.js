// STEP 1: グループ集計
export default {
  id: "l14",
  title: "グループごとに集計する",
  tag: "group_by・summarise",
  pages: [
    {
      t: "正答試行を条件ごとにまとめる",
      b: [
        "L9では、条件式を `[]` の中へ書いて条件別平均を1つずつ求めました。dplyrでは `group_by()` で集計単位を指定し、`summarise()` で各グループを1行へ要約できます。条件が増えても同じコードで処理できます。",
        "分析対象を明確にするため、まず正答試行へ絞ります。その後、条件 `cond` ごとに試行数、平均、標準偏差を求めます。このレッスンでは、グループごとの件数と要約統計量を計算できるようになります。",
      ],
      code: `rt <- readr::read_csv(
  "data/rt_data.csv",
  show_col_types = FALSE
)
condition_summary <- rt |>
  dplyr::filter(correct) |>
  dplyr::group_by(cond) |>
  dplyr::summarise(
    n = dplyr::n(),
    mean_rt = mean(rt),
    sd_rt = sd(rt),
    .groups = "drop"
  )
as.data.frame(condition_summary)`,
      out: `    cond n mean_rt    sd_rt
1   cong 5  508.46 19.91590
2 incong 5  588.44 25.13569`,
      verify: { mode: "numeric", absoluteTolerance: 1e-5, relativeTolerance: 1e-8 },
      a: [
        "congとincongの正答試行はそれぞれ5件です。平均反応時間はcongが508.46ms、incongが588.44msで、このデータではincongの方が約80ms長くなっています。",
        "`n()` は各グループに含まれる行数です。`mean()` と `sd()` は、グループ内の `rt` に別々に適用されます。ここでは欠損がありませんが、実データなら `mean(rt, na.rm = TRUE)` のように欠損方針を明示します。",
      ],
    },
    {
      t: "group_byの有無で答えが変わる",
      b: [
        "`summarise()` は、指定された単位を1行へ縮約します。グループ指定がなければ表全体が1行、`group_by(cond)` があれば条件ごとに1行です。コードが動くかではなく、研究上ほしい集計単位になっているかを確認します。",
      ],
      code: `all_summary <- rt |>
  dplyr::summarise(mean_rt = mean(rt))
by_condition <- rt |>
  dplyr::group_by(cond) |>
  dplyr::summarise(mean_rt = mean(rt), .groups = "drop")
nrow(all_summary)
nrow(by_condition)`,
      out: "[1] 1\n[1] 2",
      a: [
        "グループなしは全12試行をまとめた1行、条件別はcongとincongの2行です。どちらもエラーなく動きますが、答えている問いが違います。",
        "参加者ごとの平均が必要なら `group_by(id)`、参加者×条件ごとなら `group_by(id, cond)` と、欲しい1行の意味からグループを逆算します。",
      ],
    },
    {
      t: "集計後のグループを解除する",
      b: [
        "複数列でグループ化した場合、summarise後にも一部のグループ属性が残ることがあります。残ったグループは、後続のmutateやsummariseの計算単位へ影響します。",
        "この教材では、要約表を次の独立した処理へ渡すとき、`.groups = \"drop\"` を明示してグループを解除します。意図しない状態を持ち越さないためです。",
      ],
      code: `participant_summary <- rt |>
  dplyr::group_by(id, cond) |>
  dplyr::summarise(
    mean_rt = mean(rt),
    .groups = "drop"
  )
dplyr::group_vars(participant_summary)`,
      out: "character(0)",
      a: [
        "`group_vars()` が `character(0)` を返したので、集計後の表にグループ属性は残っていません。",
        "`.groups` は計算結果の数値を変える指定ではなく、結果にどのグループ状態を残すかの指定です。状態が見えにくいからこそ、再利用する要約表では明示する方が安全です。",
      ],
    },
    {
      t: "1行の意味を言葉で確認する",
      b: [
        "参加者×条件で正答試行をまとめます。完成した表の1行は「ある参加者の、ある条件における正答試行の要約」です。列名だけでなく、1行が何を表すかを説明できることが重要です。",
      ],
      code: `participant_summary <- rt |>
  dplyr::filter(correct) |>
  dplyr::group_by(id, cond) |>
  dplyr::summarise(
    n = dplyr::n(),
    mean_rt = mean(rt),
    .groups = "drop"
  )
as.data.frame(participant_summary)`,
      out: `   id   cond n mean_rt
1 P01   cong 2  505.35
2 P01 incong 1  560.40
3 P02   cong 2  525.90
4 P02 incong 2  606.55
5 P03   cong 1  479.80
6 P03 incong 2  584.35`,
      verify: { mode: "numeric", absoluteTolerance: 1e-8, relativeTolerance: 1e-8 },
      a: [
        "P01のincongとP03のcongは、誤答を除いたため `n = 1` です。平均だけを見ず、平均に使った件数も同じ表に残すと、少数試行のセルを発見できます。",
        "この要約表はL16で横持ちへ変換して保存します。元の試行単位データ `rt` は上書きせず、要約表を別オブジェクトにしています。",
      ],
    },
  ],
  ex: [
    {
      k: "choice",
      q: "`group_by(cond) |> summarise(...)` の結果は、通常何を1行として表しますか?",
      opts: ["条件ごとの要約", "元データの各試行", "各列の型"],
      ans: 0,
      why: "group_byで指定したcondの各値について、summariseが1行の要約を作ります。",
      hint: "group_byへ渡した列が、集計単位になります。",
    },
    {
      k: "fill",
      q: "条件ごとの集計単位を指定する関数名を入力してください。",
      code: "rt |>\n  ___(cond) |>\n  dplyr::summarise(mean_rt = mean(rt))",
      verify: { mode: "manual", reason: "学習者がグループ指定関数を補う未完成コードのため" },
      accept: ["group_by", "dplyr::group_by"],
      show: "dplyr::group_by",
      why: "`group_by(cond)` は、その後のsummariseをcondの値ごとに行わせます。",
      hint: "groupとbyをアンダースコアで結ぶ関数です。",
    },
    {
      k: "fill",
      q: "グループ内の行数を数えるdplyr関数を入力してください。",
      code: "dplyr::summarise(n = ___)",
      verify: { mode: "manual", reason: "学習者が集計関数を補う未完成コードのため" },
      accept: ["n()", "dplyr::n()"],
      show: "dplyr::n()",
      why: "`n()` は現在のグループに含まれる行数を返します。",
      hint: "引数を取らない1文字の関数です。カッコも入力します。",
    },
    {
      k: "tf",
      q: "グループ集計について、正しい(○)か、まちがっている(×)かを判定しましょう。",
      hint: "動くコードと、研究上の問いへ答えるコードを区別します。",
      items: [
        { s: "group_byなしのsummariseは、通常表全体を1行に要約する", a: true, why: "グループがなければ全行が1つの集計単位です。" },
        { s: "平均だけ残せば、平均に使った件数は確認しなくてよい", a: false, why: "件数は少数試行や除外の偏りを発見する重要な情報です。" },
        { s: "`.groups = \"drop\"` は集計後のグループ属性を解除する", a: true, why: "後続処理へ意図しないグループ状態を持ち越さない指定です。" },
      ],
    },
  ],
};
