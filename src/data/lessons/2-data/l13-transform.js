// STEP 1: 行・列操作とデータ品質
export default {
  id: "l13",
  title: "行・列操作と品質チェック",
  tag: "filter・mutate・case_when・stopifnot",
  pages: [
    {
      t: "filterで必要な行を残す",
      b: [
        "実データでは、正答試行だけを分析する、特定の条件だけを確認するなど、行を条件で絞る操作が頻繁にあります。`filter()` は条件がTRUEになる行だけを残します。",
        "ここからはL12で保存した `data/rt_data.csv` を読み込み、同じ表を最後まで加工します。このレッスンでは、行と列を加工し、重複・値域・カテゴリ・ID対応・欠損を検査して問題を記録できるようになります。",
      ],
      code: `rt <- readr::read_csv(
  "data/rt_data.csv",
  show_col_types = FALSE
)
correct_trials <- rt |>
  dplyr::filter(correct)
nrow(correct_trials)`,
      out: "[1] 10",
      a: [
        "`correct` は論理値の列なので、`filter(correct == TRUE)` を短く `filter(correct)` と書けます。12試行のうち正答は10試行です。",
        "絞り込み後の表を `correct_trials` という名前で保存しました。元の `rt` は変更されません。どの段階のデータか分かる名前を付けると、処理を検証しやすくなります。",
      ],
    },
    {
      t: "selectで使う列を選ぶ",
      b: [
        "`select()` は列を名前で選びます。分析に必要な列を明示すると、その後のコードが何を使うのか分かりやすくなります。ただし、元データを上書きして不要列を永久に消すのではなく、新しいオブジェクトとして保存します。",
      ],
      code: `analysis_data <- correct_trials |>
  dplyr::select(id, cond, rt)
names(analysis_data)`,
      out: `[1] "id"   "cond" "rt"`,
      a: [
        "結果は `id`、`cond`、`rt` の3列です。`correct` で絞り込んだ後なので、正誤列を分析用の表から外しても、どの行を採用したかはコードに残っています。",
        "`select()` は列、`filter()` は行です。名前が似ていないため覚えやすそうですが、初学者は役割を入れ替えてしまうことがあります。「filterは条件で行、selectは名前で列」と区別します。",
      ],
    },
    {
      t: "mutateで新しい列を作る",
      b: [
        "反応時間はミリ秒で記録されています。`mutate()` を使うと、既存列から計算した新しい列を表へ追加できます。ここでは1000で割り、秒単位の `rt_sec` を作ります。",
      ],
      code: `analysis_data <- analysis_data |>
  dplyr::mutate(rt_sec = rt / 1000)
head(analysis_data$rt_sec, 3)`,
      out: "[1] 0.5125 0.4982 0.5604",
      a: [
        "`rt_sec = rt / 1000` の左側が新しい列名、右側が各行で行う計算です。ベクトル化されているため、forループを書かなくても全行へ同じ計算が適用されます。",
        "単位変換後も元の `rt` 列を残しました。変換の妥当性を照合できるよう、元の測定値を保持するのが安全です。",
      ],
    },
    {
      t: "arrangeで確認しやすく並べる",
      b: [
        "`arrange()` は行の順序を変えます。`desc(rt)` を指定すると、反応時間が大きい順です。並べ替えは値を変更しませんが、極端な値を目で確認するときに役立ちます。",
      ],
      code: `analysis_data |>
  dplyr::arrange(dplyr::desc(rt)) |>
  dplyr::slice_head(n = 3) |>
  dplyr::pull(rt)`,
      out: "[1] 624.9 598.1 588.2",
      a: [
        "正答試行に絞った後の上位3件は624.9、598.1、588.2ミリ秒です。元データ全体では601.3が大きな値ですが、その行は誤答なので `correct_trials` には含まれません。",
        "この違いは処理順の重要性を示します。先に正答だけへ絞り、その結果を並べたため、「正答試行の中で大きい値」を見ています。コードを上から読むことで、対象集団を取り違えにくくなります。",
      ],
    },
    {
      t: "問題入りCSVで、読み込めた後を検査する",
      b: [
        "ファイルがエラーなく読み込めても、内容が正しいとは限りません。練習用の `rt_data_dirty.csv` には、重複行、不正な条件名、範囲外の反応時間、参加者表にないID、正誤の欠損を1件ずつ意図的に入れています。",
        "この表は失敗を見つけるための教材です。元のファイルを直接直したり上書きしたりせず、まず `dirty` という別オブジェクトへ読み込みます。参加者IDの対応確認に使う `participants.csv` も同時に読み込みます。",
      ],
      code: `dirty <- readr::read_csv(
  "data/rt_data_dirty.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)
participants <- readr::read_csv(
  "data/participants.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)
unname(c(
  nrow(dirty),
  sum(duplicated(dirty)),
  sum(is.na(dirty$correct))
))`,
      out: "[1] 17  1  1",
      a: [
        "出力は順に、17行、完全重複1行、`correct` の欠損1件です。これは入口検査の一部にすぎず、値域やカテゴリ、別表とのID対応も続けて確認します。",
        "`duplicated()` は後から現れた同一行をTRUEにします。どちらを正しい記録として残すかは研究記録や収集ログも見て決める必要があり、実データで機械的に削除してよいとは限りません。",
      ],
    },
    {
      t: "問題を消さず、issue列へ記録する",
      b: [
        "問題を見つけたら、すぐ値を書き換えるのではなく、判定結果を新しい `issue` 列へ残します。`case_when()` は上から順に条件を調べ、最初に当てはまったラベルを入れます。問題のない行は `NA` です。",
        "ここでは反応時間の許容範囲を100〜3000ms、条件名を `cong` と `incong` とします。これは教材用の仮ルールです。実研究では、除外基準をデータを見た後で都合よく変えず、研究計画や測定仕様に根拠を残します。",
      ],
      code: `allowed_cond <- c("cong", "incong")
reviewed <- dirty |>
  dplyr::mutate(
    issue = dplyr::case_when(
      duplicated(dirty) ~ "duplicate",
      !cond %in% allowed_cond ~ "invalid_cond",
      is.na(rt) | !dplyr::between(rt, 100, 3000) ~ "rt_out_of_range",
      !id %in% participants$id ~ "unknown_participant",
      is.na(correct) ~ "missing_correct",
      TRUE ~ NA_character_
    )
  )
reviewed |>
  dplyr::filter(!is.na(issue)) |>
  dplyr::count(issue, name = "rows") |>
  dplyr::arrange(issue) |>
  as.data.frame()`,
      out: `                issue rows
1           duplicate    1
2        invalid_cond    1
3     missing_correct    1
4     rt_out_of_range    1
5 unknown_participant    1`,
      a: [
        "5種類の問題が各1行ずつ見つかりました。合計だけでなく種類別の件数を残すことで、どの検査に失敗したかを追跡できます。",
        "1行に複数の問題がある場合、この書き方では最初の1件だけが記録されます。実務では検査ごとの論理列を作る方法もあります。まずは、判定の優先順が結果へ影響することを意識してください。",
      ],
    },
    {
      t: "品質ゲートを通してprocessedへ保存する",
      b: [
        "問題行と採用行を分け、採用後の表へ同じ検査をもう一度かけます。`anti_join()` は参加者表に対応するIDがない行を返すため、その行数が0であることを確認します。前提が1つでも崩れれば `stopifnot()` が処理を止めます。",
        "この練習データの5問題は意図的に追加した行なので除外します。実データでは、除外・修正・再測定のどれを選ぶかを根拠とともに決めてください。rawは上書きせず、問題一覧と採用データを `data/processed/` へ別々に保存します。",
      ],
      code: `issues <- reviewed |>
  dplyr::filter(!is.na(issue))
cleaned <- reviewed |>
  dplyr::filter(is.na(issue)) |>
  dplyr::select(-issue)
unmatched_ids <- cleaned |>
  dplyr::distinct(id) |>
  dplyr::anti_join(
    dplyr::distinct(participants, id),
    by = "id"
  )

stopifnot(
  !anyDuplicated(cleaned),
  all(cleaned$cond %in% allowed_cond),
  all(dplyr::between(cleaned$rt, 100, 3000)),
  !anyNA(cleaned$correct),
  nrow(unmatched_ids) == 0
)

dir.create("data/processed", recursive = TRUE, showWarnings = FALSE)
readr::write_csv(issues, "data/processed/rt_data_issues.csv")
readr::write_csv(cleaned, "data/processed/rt_data_checked.csv")
nrow(cleaned)
nrow(unmatched_ids)
file.exists(c(
  "data/processed/rt_data_issues.csv",
  "data/processed/rt_data_checked.csv"
))`,
      out: "[1] 12\n[1] 0\n[1] TRUE TRUE",
      a: [
        "品質ゲートを通った12行だけが採用され、未対応IDは0行です。問題一覧と採用データの2ファイルも作成できました。採用データは、意図的な問題を加える前の `rt_data.csv` と同じ内容です。",
        "この分離により、元データ、判定ルール、問題記録、分析入力の関係を後から説明できます。`stopifnot()` は正しさを自動的に保証する魔法ではなく、自分たちが定義した前提を毎回同じように検査する安全装置です。",
      ],
    },
  ],
  ex: [
    {
      id: "l13-q01", revision: 1, k: "choice",
      q: "条件を満たす行だけを残す関数はどれですか?",
      opts: ["filter", "select", "mutate"],
      ans: 0,
      why: "`filter()` は論理条件がTRUEになる行を残します。`select()` は列、`mutate()` は列の作成・変更です。",
      hint: "条件という網を通して行を絞る操作です。",
    },
    {
      id: "l13-q02", revision: 1, k: "fill",
      q: "正答行だけを残すため、空欄へ関数名を入力してください。",
      code: "rt |>\n  ___(correct)",
      verify: { mode: "manual", reason: "学習者が行操作の関数名を補う未完成コードのため" },
      accept: ["filter", "dplyr::filter"],
      show: "dplyr::filter",
      why: "`filter(correct)` はcorrect列がTRUEの行だけを残します。",
      hint: "行を条件で絞るdplyr関数です。",
    },
    {
      id: "l13-q03", revision: 1, k: "fill",
      q: "`rt` を1000で割った新しい列 `rt_sec` を作る関数名を入力してください。",
      code: "rt |>\n  ___(rt_sec = rt / 1000)",
      verify: { mode: "manual", reason: "学習者が列作成の関数名を補う未完成コードのため" },
      accept: ["mutate", "dplyr::mutate"],
      show: "dplyr::mutate",
      why: "`mutate()` は既存の表へ、計算した新しい列を追加します。",
      hint: "列を作成・変更するdplyr関数です。",
    },
    {
      id: "l13-q04", revision: 1, k: "tf",
      q: "データ操作について、正しい(○)か、まちがっている(×)かを判定しましょう。",
      hint: "4つの動詞が、行・列・値・順序のどれを扱うか確認します。",
      items: [
        { s: "`select()` は列名を指定して列を選ぶ", a: true, why: "selectは列の選択に使います。" },
        { s: "`arrange()` は値そのものを書き換える", a: false, why: "arrangeは行順を変えますが、各セルの値は変えません。" },
        { s: "`mutate()` では既存列から新しい列を計算できる", a: true, why: "各行にベクトル化された計算を適用して列を作れます。" },
      ],
    },
    {
      id: "l13-q05", revision: 1, k: "choice",
      q: "問題を含むrawデータを扱う方法として、最も追跡しやすいものはどれですか?",
      opts: [
        "rawは上書きせず、問題を記録してprocessedへ別名保存する",
        "見つけた値をrawファイル上で直接直して保存する",
        "エラーなく読めたので検査せず分析へ進む",
      ],
      ans: 0,
      why: "raw、問題記録、採用データを分けると、どのルールで何を変更・除外したかを追跡できます。",
      hint: "後から元の観測値と判断過程を再確認できる方法を選びます。",
    },
    {
      id: "l13-q06", revision: 1, k: "fill",
      q: "参加者表に存在しないIDだけを返す結合関数名を入力してください。",
      code: "dirty |>\n  dplyr::distinct(id) |>\n  ___(participants |> dplyr::distinct(id), by = \"id\")",
      verify: { mode: "manual", reason: "学習者が不一致IDを抽出する結合関数を補う未完成コードのため" },
      accept: ["anti_join", "dplyr::anti_join"],
      show: "dplyr::anti_join",
      why: "`anti_join()` は左表のうち、指定したキーが右表に対応しない行だけを返します。",
      hint: "対応しない行を残すfiltering joinです。",
    },
  ],
};
