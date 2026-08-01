// STEP 1: 表形式ファイルを読む
export default {
  id: "l12",
  title: "CSV・テキスト・Excelを読む",
  tag: "表形式ファイルを安全に取り込む",
  pages: [
    {
      t: "CSVとプロジェクトのdataフォルダ",
      b: [
        "CSV(Comma-Separated Values)は、1行目に列名、その後の各行に値をカンマ区切りで保存するテキスト形式です。表計算ソフトだけでなく、多くの実験ソフトや調査システムから書き出せます。",
        "この教材のCSVは、個人情報を含まない架空の反応時間実験を表す小さな合成データです。操作の学習用に値と欠損を設計しており、実在する研究結果として解釈するものではありません。",
        "レッスン冒頭のボタンから反応時間CSVをダウンロードし、RStudio Projectの中に `data` フォルダを作って `rt_data.csv` という名前で保存してください。Projectを起点にした相対パス `data/rt_data.csv` なら、別のPCでも同じフォルダ構成で再実行できます。",
        "このレッスンでは、CSV・TSV・Excelファイルを読み込み、行数・列名・列型を確認できるようになります。",
      ],
      code: `rt <- readr::read_csv(
  "data/rt_data.csv",
  show_col_types = FALSE
)
c(nrow(rt), ncol(rt))`,
      out: "[1] 12  4",
      a: [
        "`read_csv()` はCSVを読み、tibbleとして返します。結果を `rt` に代入したので、読み込んだ表を後の処理でも使えます。",
        "結果は12行4列です。`show_col_types = FALSE` は、readrが推測した列型のメッセージをこの表示では省略する指定です。型確認そのものを不要にする指定ではありません。次のページで明示的に確認します。",
      ],
    },
    {
      t: "列名と列型を必ず確認する",
      b: [
        "ファイルがエラーなく読めても、分析の準備が終わったとは限りません。参加者IDが数値扱いになっていないか、反応時間が文字列になっていないか、正誤列が論理値になっているかを確認します。",
      ],
      code: `names(rt)
c(
  id = typeof(rt$id),
  rt = typeof(rt$rt),
  correct = typeof(rt$correct)
)`,
      out: `[1] "id"      "cond"    "rt"      "correct"
         id          rt     correct
"character"    "double"   "logical"`,
      a: [
        "列名は `id`、`cond`、`rt`、`correct` の4つです。`typeof()` では、IDは文字列、反応時間は倍精度数値、正誤はTRUE/FALSEの論理値だと確認できます。",
        "readrは既定で列型を推測します。便利ですが、データ先頭部だけでは誤推測する場合があります。読み込み直後に列名・型・行数を確認する習慣が、後の静かな分析ミスを防ぎます。",
        "実データで型を固定したい場合は `col_types = readr::cols(id = readr::col_character(), rt = readr::col_double())` のように指定します。読込時の変換失敗は `readr::problems(rt)` で確認できます。",
      ],
    },
    {
      t: "空欄を欠損値として読む",
      b: [
        "レッスン冒頭から参加者CSVもダウンロードし、`data/participants.csv` として保存してください。このCSVではP03の年齢が空欄です。",
        "`na = c(\"\", \"NA\")` は、空文字と文字列NAを欠損値として扱う指定です。read_csvの既定値も同じですが、研究用スクリプトでは何を欠損とみなしたかを明示しておくと、後から判断を追跡しやすくなります。",
      ],
      code: `participants <- readr::read_csv(
  "data/participants.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)
sum(is.na(participants$age))`,
      out: "[1] 1",
      a: [
        "`age` 列には欠損値が1つあります。空欄を0歳として埋めたり、文字列のまま無視したりせず、まずNAとして読み込めたことを確認します。",
        "欠損値を除外・補完するかどうかは、分析目的と欠損理由に基づく別の判断です。読み込み時に自動で行を捨ててはいけません。",
      ],
    },
    {
      t: "ファイルが見つからないとき",
      b: [
        "`cannot open file` や `does not exist` と表示されたら、コードの文法より先に、Projectとファイル配置を確認します。RStudio右上に学習用Project名が表示され、Filesペインに `data` フォルダ、その中にCSVがあるかを見ます。",
        "作業PC固有の `C:/Users/...` のような絶対パスをスクリプトへ貼ると、別の人や別のPCで動きません。Projectを起点に `data/rt_data.csv` と書くのが再現可能な方法です。",
      ],
      code: `file.exists("data/rt_data.csv")
file.exists("data/participants.csv")`,
      out: "[1] TRUE\n[1] TRUE",
      a: [
        "2つともTRUEなら、現在のProjectから相対パスで見つけられています。FALSEなら、ファイル名の大文字小文字、拡張子、保存先を確認します。",
        "ファイルが見つからない問題を `setwd()` の繰り返しで直すと、スクリプトがどのフォルダを前提とするか不明瞭になります。この教材ではProjectと相対パスを使います。",
      ],
    },
    {
      t: "TSVと区切り文字のあるテキストを読む",
      b: [
        "`.txt` という拡張子だけでは、列の区切り方は分かりません。タブ区切りなら `read_tsv()`、任意の1文字で区切られているなら `read_delim(delim = ...)` を使います。ファイル名ではなく、実際の区切り文字を確認して関数を選びます。",
        "冒頭から反応時間TSVと参加者パイプ区切りTXTをダウンロードし、それぞれ `data/rt_data.tsv`、`data/participants_pipe.txt` として保存します。CSVと同じ内容でも、区切り文字に合う関数を選ばなければ正しい列に分かれません。",
      ],
      code: `rt_tsv <- readr::read_tsv(
  "data/rt_data.tsv",
  show_col_types = FALSE
)
participants_pipe <- readr::read_delim(
  "data/participants_pipe.txt",
  delim = "|",
  na = c("", "NA"),
  show_col_types = FALSE
)
c(
  tsv_rows = nrow(rt_tsv),
  tsv_cols = ncol(rt_tsv),
  text_rows = nrow(participants_pipe),
  text_cols = ncol(participants_pipe)
)`,
      out: ` tsv_rows  tsv_cols text_rows text_cols
       12         4         3         3`,
      a: [
        "`read_tsv()` はタブ区切りのTSVを12行4列、`read_delim(delim = \"|\")` は縦線区切りのTXTを3行3列として読みました。`names()` と列型もCSVと同じ要領で確認します。",
        "固定幅テキストは区切り文字を持たない別形式です。その場合は `read_fwf()` を使い、列位置または列幅を指定します。まずファイルをテキストエディタで開き、区切り形式か固定幅かを確認します。",
      ],
    },
    {
      t: "Excelはシートと範囲を明示して読む",
      b: [
        "`.xls` と `.xlsx` はテキストではなくExcelブックです。`read_csv()` ではなく `readxl::read_excel()` を使います。readxlはtidyverseと一緒に導入されることがありますが、`library(tidyverse)` では自動的に読み込まれないため、ここでは `readxl::` を明示します。未導入ならConsoleで一度だけ `install.packages(\"readxl\")` を実行します。",
        "Excelブックには複数シート、タイトル行、脚注、空白セルがあり得ます。`sheet`、必要なら `range` または `skip` を明示し、読み込んだ後はCSVと同じく行数・列名・列型を確認します。セルの色や結合状態を分析データとして頼らず、1行1観測・1列1変数の表にします。",
        "冒頭からExcel読込サンプルをダウンロードし、`data/trials.xlsx` として保存します。このブックには説明用の `README` と、1行1試行の `trials` があります。見出し1行とデータ12行なので、表の範囲は `A1:D13` です。",
      ],
      code: `excel_path <- "data/trials.xlsx"
readxl::excel_sheets(excel_path)
trials <- readxl::read_excel(
  excel_path,
  sheet = "trials",
  range = "A1:D13",
  na = c("", "NA")
)
c(nrow(trials), ncol(trials))`,
      out: `[1] "README" "trials"
[1] 12  4`,
      a: [
        "`excel_sheets()` で先にシート名を確認すると、先頭シートを無意識に読む事故を防げます。`range` は指定した長方形を厳密に読むため、表の位置が変わる可能性がある運用では固定範囲が適切かも検討します。",
        "数値と文字が同じ列に混在すると、Excel読込時の型推測が意図と異なることがあります。列型の確認に加え、IDの一意性、欠損数、想定行数など研究上の契約も検査します。",
      ],
    },
    {
      t: "複数のExcelを一括で読み込む",
      b: [
        "参加者ごと・実施日ごとにExcelが分かれていても、ファイルを1つずつコピー&ペーストしません。`list.files()` で対象だけを列挙し、`purrr::map()` で同じ読込関数を適用し、`purrr::list_rbind()` で行方向へ結合します。古い `map_dfr()` ではなく、現在推奨される `map()` と `list_rbind()` の組合せを使います。",
        "一括読込では、対象0件、バックアップファイルの混入、列名の不一致を先に止める必要があります。結合後も元ファイル名を `source_file` 列へ残すと、異常値を原ファイルまで追跡できます。",
        "冒頭から一括Excel 1・2をダウンロードし、`data/batches/batch_01.xlsx` と `data/batches/batch_02.xlsx` に保存します。前者にはP01・P02の8試行、後者にはP03の4試行があり、結合すると元CSVと同じ12試行になります。",
      ],
      code: `files <- list.files(
  "data/batches",
  pattern = "\\\\.xlsx$",
  full.names = TRUE,
  ignore.case = TRUE
)
files <- sort(files[!startsWith(basename(files), "~$")])
stopifnot(length(files) > 0)
names(files) <- basename(files)

tables <- files |>
  purrr::map(\\(path) {
    readxl::read_excel(
      path,
      sheet = "trials",
      na = c("", "NA")
    )
  })

expected_cols <- c("id", "cond", "rt", "correct")
stopifnot(purrr::every(
  tables,
  \\(table) identical(names(table), expected_cols)
))

all_trials <- tables |>
  purrr::list_rbind(names_to = "source_file")

unname(c(
  length(files),
  nrow(all_trials),
  length(unique(all_trials$source_file))
))`,
      out: "[1]  2 12  2",
      a: [
        "`pattern = \"\\\\.xlsx$\"` は拡張子が.xlsxで終わるファイルを対象にし、`ignore.case = TRUE` で `.XLSX` も扱います。`startsWith()` でExcelが作る一時ファイル `~$...xlsx` を除外し、`sort()` で処理順を固定します。対象一覧 `files` は実行前に目でも確認します。",
        "`every()` で全ファイルの列名と順序が契約どおりかを確認し、不一致なら結合前に停止します。`list_rbind(names_to = \"source_file\")` は、名前付きリストの名前、ここでは元ファイル名を列として保持します。",
      ],
    },
  ],
  ex: [
    {
      k: "choice",
      q: "Project内の `data/rt_data.csv` を再現可能に指定しているのはどれですか?",
      opts: ["data/rt_data.csv", "C:/Users/me/Desktop/rt_data.csv", "rt_data"],
      ans: 0,
      why: "Projectを起点にした相対パスなら、同じフォルダ構成を保つことで別のPCでも実行できます。",
      hint: "特定の利用者名やPCの場所を含まない指定を選びます。",
    },
    {
      k: "fill",
      q: "CSVをtibbleとして読み込むreadrの関数名を入力してください。",
      code: `rt <- ___("data/rt_data.csv")`,
      verify: { mode: "manual", reason: "学習者が関数名を補う未完成コードのため" },
      accept: ["read_csv", "readr::read_csv"],
      show: "readr::read_csv",
      why: "`readr::read_csv()` はカンマ区切りのCSVファイルをtibbleとして読み込みます。",
      hint: "readrパッケージの、readとcsvをアンダースコアで結ぶ関数です。",
    },
    {
      k: "tf",
      q: "CSVの読み込みについて、正しい(○)か、まちがっている(×)かを判定しましょう。",
      hint: "読み込み成功と内容確認は別の作業です。",
      items: [
        { s: "読み込み後は、行数・列名・列型を確認する", a: true, why: "エラーなく読めても、型や列が意図どおりとは限りません。" },
        { s: "空欄のある行は、読み込み時に必ず削除する", a: false, why: "まずNAとして保持し、扱いは欠損理由と分析目的に基づいて決めます。" },
        { s: "相対パスはRStudio Projectを起点に解釈できる", a: true, why: "Projectと同じフォルダ構成なら、PC固有の絶対パスを避けられます。" },
      ],
    },
    {
      k: "choice",
      q: "タブ区切りのテキストファイルを読む関数はどれですか?",
      opts: ["readr::read_tsv", "readr::read_csv", "readxl::read_excel"],
      ans: 0,
      why: "TSVはTab-Separated Valuesなので、タブ区切り専用の `read_tsv()` を使います。",
      hint: "ファイル名より、列を区切る文字に注目します。",
    },
    {
      k: "fill",
      q: "Excelブックを読むreadxlの関数名を入力してください。",
      code: `trials <- ___("data/trials.xlsx", sheet = "trials")`,
      verify: { mode: "manual", reason: "学習者がExcel読込関数を補う未完成コードのため" },
      accept: ["read_excel", "readxl::read_excel"],
      show: "readxl::read_excel",
      why: "`readxl::read_excel()` は拡張子とファイル内容からxlsまたはxlsxを判定して読み込みます。",
      hint: "readとexcelをアンダースコアで結ぶ関数です。",
    },
    {
      k: "choice",
      q: "複数Excelを行方向へ結合する前に、最も先に確認すべきことはどれですか?",
      opts: ["対象ファイルがあり、各表の列契約が一致すること", "ファイル名をすべて短くすること", "Excelで各表を1つずつコピーすること"],
      ans: 0,
      why: "対象0件や列構造の不一致を結合前に止め、元ファイル名も保持することで追跡可能な一括処理になります。",
      hint: "結合後に静かにNA列が増える状況を防ぐ検査を選びます。",
    },
  ],
};
