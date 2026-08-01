// STEP 1: 縦横変換と保存
export default {
  id: "l16",
  title: "表の形を変えて保存する",
  tag: "pivot・write_csv",
  practice: {
    title: "STEP 1 実践チェック",
    intro: "Project内でCSVの読み込みから要約表の保存までを1本のスクリプトとして実行してください。画面で理解しただけでなく、再実行できる成果物が残った項目だけにチェックします。",
    items: [
      {
        id: "analysis-script",
        label: "`step1_analysis.R` に、CSV読込・正答行の抽出・参加者×条件の集計を書いて保存した",
        criterion: "スクリプトを新しいRセッションで上から実行し、6行の要約表が作れれば達成です。",
      },
      {
        id: "summary-csv",
        label: "`output/condition_means.csv` を作成し、3行3列であることを確認した",
        criterion: "id、cong、incongの3列とP01〜P03の3行が保存されていれば達成です。",
      },
      {
        id: "interpretation-note",
        label: "`output/analysis_note.txt` に、分析対象・条件差・解釈の限界を3文で記録した",
        criterion: "正答試行だけを使ったこと、3名全員でincong−congが正だったこと、3名の合成データから一般化や群間差を結論しないことが書かれていれば達成です。",
      },
      {
        id: "reproduce-output",
        label: "RStudioを再起動してスクリプトを再実行し、同じCSVと結果メモを作り直せた",
        criterion: "手作業で成果物を編集せず、空のEnvironmentから同じ2ファイルを再生成できれば達成です。",
      },
    ],
  },
  pages: [
    {
      t: "まず解析単位の縦長データを作る",
      b: [
        "`rt_data.csv` は1行が1試行の縦長データです。モデリングやggplotでは、1行が1観測で、変数が別々の列に入る縦長形式が基本になります。",
        "ここでは正答試行を参加者×条件で集計し、1行が「1参加者の1条件」を表す6行の要約表を作ります。このレッスンでは、縦長と横長を相互変換し、要約結果をCSVとして保存・再読込して、結果の範囲と限界を説明できるようになります。",
        "L11〜L16を1本の流れで実行する場合は、学習ホームから `nb1-data.qmd` をダウンロードできます。各レッスンのコードをつなぎ、途中の前提検査と再現確認を加えたQuarto演習ノートです。",
      ],
      code: `rt <- readr::read_csv(
  "data/rt_data.csv",
  show_col_types = FALSE
)
participant_summary <- rt |>
  dplyr::filter(correct) |>
  dplyr::group_by(id, cond) |>
  dplyr::summarise(
    mean_rt = mean(rt),
    .groups = "drop"
  )
nrow(participant_summary)
names(participant_summary)`,
      out: `[1] 6
[1] "id"      "cond"    "mean_rt"`,
      a: [
        "3人×2条件で6行です。条件名は `cond` 列、測定値は `mean_rt` 列に入っています。",
        "この縦長表では条件が増えても列数は変わらず、行が増えます。条件を値として扱えるため、条件別のグループ化や作図へつなげやすい形です。",
      ],
    },
    {
      t: "pivot_widerで条件を列へ広げる",
      b: [
        "報告用の表では、参加者を行、条件を列に並べたい場合があります。`pivot_wider()` は、ある列の値を新しい列名へ展開します。",
        "`names_from = cond` は新しい列名をcond列から作り、`values_from = mean_rt` は各セルの値をmean_rt列から取る指定です。",
      ],
      code: `condition_means <- participant_summary |>
  tidyr::pivot_wider(
    names_from = cond,
    values_from = mean_rt
  )
as.data.frame(condition_means)`,
      out: `   id   cong incong
1 P01 505.35 560.40
2 P02 525.90 606.55
3 P03 479.80 584.35`,
      verify: { mode: "numeric", absoluteTolerance: 1e-8, relativeTolerance: 1e-8 },
      a: [
        "横長表は1行が1参加者で、congとincongが別々の列です。人が条件を横に比較するには便利ですが、条件名が列名の中へ埋め込まれています。",
        "縦長と横長のどちらが常に正しいわけではありません。後続の関数が期待する1行の意味と、作りたい成果物に合わせて選びます。元の試行データは別に保持します。",
      ],
    },
    {
      t: "pivot_longerで列名を値へ戻す",
      b: [
        "`pivot_longer()` は複数列を、列名を格納する列と値を格納する列へまとめます。cong列とincong列を、再び `cond` と `mean_rt` の2列へ戻します。",
      ],
      code: `long_again <- condition_means |>
  tidyr::pivot_longer(
    cols = c(cong, incong),
    names_to = "cond",
    values_to = "mean_rt"
  ) |>
  dplyr::arrange(id, cond)
original_long <- participant_summary |>
  dplyr::arrange(id, cond)
nrow(long_again)
isTRUE(all.equal(long_again, original_long))`,
      out: "[1] 6\n[1] TRUE",
      a: [
        "戻した表は6行で、idとcondの順に並べた後、列名・列型・値を含む表全体が変換前と一致しました。`all.equal()` の結果を `isTRUE()` で1つの論理値にしています。",
        "往復できるかは重要な検査です。ただし、同じid・condの組合せが複数行あるままpivot_widerすると1セルに複数値が対応し、list列や警告が生じます。先に1セル1値となる単位へ集計します。",
      ],
    },
    {
      t: "write_csvで成果物を保存する",
      b: [
        "分析結果はEnvironmentに置くだけでは、Rを終了すると失われます。`write_csv()` で要約表を `output` フォルダへ保存し、再び読み込んで形を検査します。",
        "スクリプトが `data` の原データを読み、`output` の成果物を作る構成にすると、入力と出力を混同しません。出力CSVを手で修正せず、変更が必要ならスクリプトを直して再生成します。",
        "`write_csv(x, file)` の第1引数は保存する表、第2引数は保存先です。親フォルダは自動作成されないため先に `dir.create()` を実行します。既定では同名ファイルを上書きし、行番号を余分な列として書き出しません。",
      ],
      code: `dir.create("output", showWarnings = FALSE)
readr::write_csv(
  condition_means,
  "output/condition_means.csv"
)
saved <- readr::read_csv(
  "output/condition_means.csv",
  show_col_types = FALSE
)
file.exists("output/condition_means.csv")
dim(saved)`,
      out: "[1] TRUE\n[1] 3 3",
      a: [
        "ファイルが存在し、再読込した表は3行3列です。これで「CSVを読む→絞る→集計する→形を変える→保存する」が1本につながりました。",
        "欠損値は既定で文字列 `NA` として保存されます。空欄にしたい場合は `na = \"\"` と指定できますが、読み手が空文字と欠損を区別できるかを考えて決めます。保存直後の再読込で、列名・型・行数も検査します。",
        "実践チェックではRStudioを再起動し、空のEnvironmentから同じ成果物を作り直します。過去の手作業や残ったオブジェクトに依存せず再現できて、はじめてSTEP 1の成果物が完成です。",
      ],
    },
    {
      t: "条件差を計算し、依頼へ答える",
      b: [
        "保存した参加者別要約から、各参加者の `incong - cong` を計算します。正の値なら、このデータでは不一致条件の平均反応時間の方が長かったことを表します。",
        "研究上の問いへ答えるときは、数値だけでなく、どの試行を使ったか、どこまで言えるかを一緒に記録します。ここでは正答試行だけを使い、3名の合成パイロットデータの範囲で記述します。",
      ],
      code: `scenario_result <- saved |>
  dplyr::mutate(
    incong_minus_cong = incong - cong
  )

analysis_note <- c(
  "分析対象: 正答試行だけを参加者×条件で要約した。",
  sprintf(
    "記述結果: 3名全員でincong平均がcong平均より長く、差は%.2f〜%.2f msだった。",
    min(scenario_result$incong_minus_cong),
    max(scenario_result$incong_minus_cong)
  ),
  "解釈の限界: 3名の合成データなので、母集団へ一般化せず、言語群差も結論しない。"
)
writeLines(
  analysis_note,
  "output/analysis_note.txt",
  useBytes = TRUE
)

unname(round(scenario_result$incong_minus_cong, 2))
all(scenario_result$incong_minus_cong > 0)
file.exists("output/analysis_note.txt")`,
      out: "[1]  55.05  80.65 104.55\n[1] TRUE\n[1] TRUE",
      verify: { mode: "numeric", absoluteTolerance: 1e-8, relativeTolerance: 1e-8 },
      a: [
        "P01、P02、P03の差はそれぞれ55.05、80.65、104.55msで、3名とも正です。この小さなデータ内では、正答試行の平均反応時間はincong条件の方が長い、と記述できます。同じ内容を、分析対象・記述結果・限界に分けて `analysis_note.txt` へ保存しました。",
        "ただし参加者は3名だけで、値は教材用に作った合成データです。母集団でも同じ差がある、bilingual群とmonolingual群で差が異なる、といった推測はできません。STEP 1の成果は推測統計ではなく、検査済みデータから追跡可能な記述結果を作ることです。",
      ],
    },
    {
      t: "TSV・Excel向けCSV・xlsxを区別する",
      b: [
        "タブ区切りで渡すなら `write_tsv()`、Excelで文字化けしにくいUTF-8のCSVが必要なら `write_excel_csv()` を使えます。どちらも表の値を区切りテキストへ書く関数で、シート・数式・セル書式を持つExcelブックにはなりません。",
        "本当の `.xlsx` が必要な場合は、書出し専用パッケージの `writexl::write_xlsx()` などを別途使います。分析の正本はRスクリプトと機械可読なデータに置き、Excel上の手修正だけで結果を変えない運用にします。",
      ],
      code: `readr::write_tsv(
  condition_means,
  "output/condition_means.tsv"
)
readr::write_excel_csv(
  condition_means,
  "output/condition_means_excel.csv"
)
c(
  file.exists("output/condition_means.tsv"),
  file.exists("output/condition_means_excel.csv")
)`,
      out: "[1] TRUE TRUE",
      a: [
        "`write_tsv()` はタブ区切り、`write_excel_csv()` はExcelがUTF-8だと判断するためのBOM付きCSVを書きます。後者の拡張子も `.csv` であり、`.xlsx` と取り違えません。",
        "受け渡し相手が何を読むかに合わせて形式を選びます。解析用には型と欠損表現を検査しやすいCSV/TSV、複数シートや書式が成果物要件ならxlsx、というように目的を分けます。",
      ],
    },
  ],
  ex: [
    {
      k: "choice",
      q: "`pivot_wider(names_from = cond, values_from = mean_rt)` で新しい列名になるのはどの値ですか?",
      opts: ["cond列の値", "mean_rt列の値", "id列の値"],
      ans: 0,
      why: "names_fromへ指定したcond列の値(cong・incong)が新しい列名になります。",
      hint: "names_fromという引数名に注目します。",
    },
    {
      k: "fill",
      q: "データフレームをCSVとして保存するreadr関数名を入力してください。",
      code: `___(condition_means, "output/condition_means.csv")`,
      verify: { mode: "manual", reason: "学習者が保存関数名を補う未完成コードのため" },
      accept: ["write_csv", "readr::write_csv"],
      show: "readr::write_csv",
      why: "`write_csv()` はデータフレームをカンマ区切りファイルへ保存します。",
      hint: "read_csvの反対で、writeとcsvをアンダースコアで結びます。",
    },
    {
      k: "tf",
      q: "表の変換と保存について、正しい(○)か、まちがっている(×)かを判定しましょう。",
      hint: "1行の意味と、再現可能な成果物の作り方を確認します。",
      items: [
        { s: "pivot_widerの前に、1セルへ対応する値が1つか確認する", a: true, why: "同じキーの組合せに複数値があると、単純な横長表へできません。" },
        { s: "出力CSVを直接修正する方が、スクリプトを直すより再現しやすい", a: false, why: "手修正は処理履歴が残らず、同じ成果物を再生成できません。" },
        { s: "保存後に再読込して行数・列数を確認する", a: true, why: "ファイルが意図した形で書かれたことを独立に確認できます。" },
      ],
    },
    {
      k: "choice",
      q: "`write_excel_csv()` が作るファイルについて正しい説明はどれですか?",
      opts: ["Excelで開きやすいUTF-8のCSVであり、xlsxではない", "複数シートを持つxlsxである", "セル書式と数式を必ず保存する"],
      ans: 0,
      why: "`write_excel_csv()` はBOM付きのCSVを書きます。Excelブックのシート・数式・書式は保持しません。",
      hint: "関数名の最後がcsvであることに注目します。",
    },
    {
      k: "reflect",
      q: "研究室のメンバーへ渡す結果メモを、3〜4文で書いてください。分析対象、3名の条件差、言える範囲の限界をすべて含めます。",
      minLength: 80,
      rubric: [
        "正答試行だけを参加者×条件で要約したと書いている",
        "3名全員でincong−congが正だったと、方向を取り違えずに書いている",
        "3名の合成データから母集団や言語群へ一般化しないと書いている",
      ],
      example: "分析対象は正答試行だけとし、参加者ごと・条件ごとに平均反応時間を求めた。3名全員でincong条件の平均がcong条件より長く、差は55.05〜104.55msだった。ただし3名の合成パイロットデータなので、母集団への一般化や言語群差の結論には使わない。",
    },
  ],
};
