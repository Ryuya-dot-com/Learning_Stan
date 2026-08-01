// STEP 1: 結合と欠損値
export default {
  id: "l15",
  title: "表を結合し、欠損を調べる",
  tag: "left_join・is.na",
  pages: [
    {
      t: "試行データへ参加者属性を結合する",
      b: [
        "研究データは、試行ごとの反応を持つ表と、参加者ごとの年齢・群などを持つ表に分かれていることがあります。両方に共通する参加者IDをキーとして結合します。",
        "`left_join(x, y, by = \"id\")` は、左の表xの全行を保ち、同じidを持つ右の表yの列を追加します。このレッスンでは、キーを確認して2つの表を結合し、欠損値の位置と影響範囲を調べることができるようになります。",
      ],
      code: `rt <- readr::read_csv(
  "data/rt_data.csv",
  show_col_types = FALSE
)
participants <- readr::read_csv(
  "data/participants.csv",
  show_col_types = FALSE
)
joined <- dplyr::left_join(
  rt,
  participants,
  by = "id",
  relationship = "many-to-one"
)
c(nrow(joined), ncol(joined))`,
      out: "[1] 12  6",
      a: [
        "左側の試行データ12行は保たれ、参加者表の `age` と `group` が加わって6列になりました。P01の属性はP01の4試行すべてへ対応付けられます。",
        "`relationship = \"many-to-one\"` は、左側では同じIDが複数行に現れてよい一方、右側の参加者表では各IDが高々1行であるという想定を明示します。右側に重複IDがあれば、静かに行が増える代わりにエラーで知らせます。",
      ],
    },
    {
      t: "結合前にキーの一意性を確かめる",
      b: [
        "結合で最も危険なのは、キーの重複による意図しない行数増加です。参加者表にP01が2行あれば、P01の各試行が2行ずつに増えます。コードが停止しない場合でも、平均や件数が変わる可能性があります。",
      ],
      code: `participant_key_check <- participants |>
  dplyr::count(id, name = "rows_per_id")
max(participant_key_check$rows_per_id)
dplyr::n_distinct(participants$id)`,
      out: "[1] 1\n[1] 3",
      a: [
        "IDあたりの最大行数は1で、異なるIDは3人です。参加者表の各IDが一意だと確認できました。",
        "結合後にも `nrow(joined)` が結合前の試行数12と同じかを確認します。キーの意味、重複、結合前後の行数をセットで検査します。",
      ],
    },
    {
      t: "欠損の数だけでなく位置を見る",
      b: [
        "参加者表ではP03の年齢が欠損しています。参加者属性を試行データへ結合すると、P03の4試行すべてで `age` がNAになります。元ファイルで1セルだった欠損が、結合後には4行へ現れる点が重要です。",
      ],
      code: `sum(is.na(joined$age))
joined |>
  dplyr::filter(is.na(age)) |>
  dplyr::distinct(id) |>
  dplyr::pull(id)`,
      out: `[1] 4
[1] "P03"`,
      a: [
        "欠損セルは4つですが、影響を受ける参加者はP03の1人です。行数だけを報告すると、4人の年齢が欠けているように誤解するかもしれません。",
        "階層を持つ研究データでは、「欠損セル数」「欠損行数」「影響を受ける参加者数」を区別します。どの単位で欠損が生じたかが、除外や補完の判断に関わります。",
      ],
    },
    {
      t: "必要な分析に限って欠損を除く",
      b: [
        "年齢を使わない反応時間分析なら、P03の反応データまで捨てる理由はありません。年齢を使う処理の直前だけ `filter(!is.na(age))` とし、除外後の行数と参加者数を記録します。",
      ],
      code: `age_analysis <- joined |>
  dplyr::filter(!is.na(age))
nrow(age_analysis)
dplyr::n_distinct(age_analysis$id)
mean(age_analysis$age)`,
      out: "[1] 8\n[1] 2\n[1] 22",
      a: [
        "年齢があるP01・P02の8試行、2人が残りました。平均年齢22歳は試行単位で同じ年齢を4回ずつ数えた結果ですが、両者の試行数が同じなので参加者単位の平均とも一致しています。試行数が不均衡なら、この計算は参加者を不均等に重み付けします。",
        "参加者属性の要約は本来 `participants` の1人1行の表で行う方が明確です。結合後の表で集計するときは、1行が試行であることを忘れないようにします。",
      ],
    },
  ],
  ex: [
    {
      k: "choice",
      q: "参加者表の1つの欠損年齢が、結合後に4つのNAになった理由は?",
      opts: ["P03の4試行それぞれへ同じ参加者属性を結合したため", "read_csvがNAを4倍にしたため", "left_joinが常に4行を追加するため"],
      ans: 0,
      why: "参加者表は1人1行、試行表はP03が4行なので、同じ欠損属性が4試行へ対応付けられます。",
      hint: "2つの表で、1行が表す単位の違いを考えます。",
    },
    {
      k: "fill",
      q: "左側の全試行を保って参加者属性を結合する関数名を入力してください。",
      code: "rt |>\n  ___(participants, by = \"id\")",
      verify: { mode: "manual", reason: "学習者が結合関数を補う未完成コードのため" },
      accept: ["left_join", "dplyr::left_join"],
      show: "dplyr::left_join",
      why: "`left_join()` は左側の行を保ち、キーが一致する右側の列を追加します。",
      hint: "leftとjoinをアンダースコアで結ぶ関数です。",
    },
    {
      k: "fill",
      q: "年齢が欠損していない行だけを残す条件を書いてください。",
      code: "joined |>\n  dplyr::filter(___)",
      verify: { mode: "manual", reason: "学習者が欠損除外条件を補う未完成コードのため" },
      accept: ["!is.na(age)"],
      show: "!is.na(age)",
      why: "`is.na(age)` が欠損行でTRUEになり、`!` で反転すると非欠損行がTRUEになります。",
      hint: "is.na(age)の結果を、感嘆符で反転します。",
    },
    {
      k: "tf",
      q: "表の結合と欠損について、正しい(○)か、まちがっている(×)かを判定しましょう。",
      hint: "キーの重複と、欠損を除く分析範囲に注目します。",
      items: [
        { s: "結合前後の行数を比べると、意図しない行増加を発見しやすい", a: true, why: "重複キーによる多対多結合では行数が増えることがあります。" },
        { s: "ある列にNAがあれば、その列を使わない分析でも全行を削除する", a: false, why: "欠損列を使わない分析までデータを捨てる必要はありません。" },
        { s: "参加者単位の欠損と試行単位の欠損数は区別する", a: true, why: "結合後には1人の欠損が複数試行へ現れるためです。" },
      ],
    },
  ],
};
