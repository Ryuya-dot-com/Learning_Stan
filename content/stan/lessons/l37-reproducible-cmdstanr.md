# L37 CmdStanRで再現可能に実行する

> このレッスンはStanベータ編の一部です。L36で作った確率モデルを、手元の環境で再実行できる形へ進めます。

L34ではR・CmdStanR・Stanの責務、L35ではStanのブロックと型、L36では生成過程から対数密度への翻訳を学びました。L37では同じ単回帰モデルを、別の人が追跡・再実行できる形で構文確認、コンパイル、4 chainのサンプリング、成果物保存まで進めます。

このレッスンの「再現可能」は、seedだけを同じにすることではありません。コード、データ、ソフトウェア版、実行設定、chain ID、出力ファイル、診断を一緒に記録し、どの工程で停止したかを説明できる状態を指します。

## このレッスンのゴール

終了時には、次のことができるようになります。

1. CmdStanRとCmdStanの導入状態・版・パスを記録する。
2. `cmdstan_model(..., compile = FALSE)`、`$check_syntax()`、`$compile()`、`$sample()`を別工程として実行する。
3. `seed`、`chains`、`chain_ids`、`parallel_chains`、`iter_warmup`、`iter_sampling`の役割を区別する。
4. 一時CSVと永続成果物を区別し、出力CSV、入力JSON、fit、実行記録を保存する。
5. 構文、C++コンパイル、データ契約、初期化、サンプリング、出力保存の失敗を分類する。
6. 同じ実行契約を未見のBernoulli-logitモデルへ移す。

### このレッスンで作るもの

- 版、ソース指紋、データ指紋、サンプリング設定を持つ実行記録
- 初回エラー、停止工程、修正版、再実行結果を分けたデバッグ記録
- 単回帰と未見の二値応答モデルについて、保存済みCmdStan CSVとfitオブジェクト

教材の単回帰例は、R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0で構文確認から4 chainの実行まで確認しています。ただし、教材側の成功は、あなたのPCでも同じように実行できることを保証しません。手元で得た初回結果を上書きせずに残しましょう。

## 1. 実行前に環境を記録する

CmdStanRはRからCmdStanを呼び出すインターフェースです。CmdStanの実行には、CmdStan本体とC++ツールチェーンが必要です。まず、既存環境を変更せずに状態を確認します。

```r
library(cmdstanr)

R.version.string
packageVersion("cmdstanr")
cmdstan_path()
cmdstan_version()
```

初回導入時またはコンパイル環境に問題があるときは、次も確認します。

```r
check_cmdstan_toolchain()
```

`check_cmdstan_toolchain()`の成功は、C++ツールチェーンを利用できるという証拠です。Stanプログラムが正しい、データが契約を満たす、MCMCが適切に探索できる、という証拠ではありません。

CmdStanのインストールや更新は環境を変更します。この教材では、実行スクリプトの途中で`install_cmdstan()`を自動実行しません。必要な版を導入する作業と、固定した環境でモデルを再実行する作業を分離します。

### 最低限記録する環境情報

| 項目 | 例 | 理由 |
|---|---|---|
| OS・アーキテクチャ | Windows AMD64 | 実行ファイルと数値環境を識別する |
| R | 4.6.1 | R側の変換・依存関係を識別する |
| CmdStanR | 0.9.0 | Rインターフェースの挙動を識別する |
| CmdStan | 2.39.0 | stanc3・Stan Math・CmdStanの版を識別する |
| CmdStanパス | `cmdstan_path()`の結果 | どのインストールを使ったか確認する |

固定seedがあっても、OS、コンパイラ、数値ライブラリ、Stanの版が異なれば、drawがビット単位で一致するとは限りません。再現性は、同じ結論を支える実行条件と結果を追跡できることとして扱います。

## 2. ソースとデータを一意にする

L37では、L36で書いた単回帰プログラムを使います。

```r
source_file <- file.path(
  "content", "stan", "examples", "linear-regression.stan"
)

stopifnot(file.exists(source_file))
source_md5 <- unname(tools::md5sum(source_file))
```

MD5は、同じ名前のファイルが途中で変わっていないかを照合する内容指紋として使います。ファイルの作成者や安全性を証明する署名ではありません。

データは、同じ表から`N`、`x`、`y`を作ります。

```r
study <- data.frame(
  x = 1:8,
  y = c(-0.7, 0.1, 0.4, 1.4, 2.1, 2.5, 3.4, 3.7)
)

stopifnot(
  nrow(study) >= 1L,
  !anyNA(study),
  is.numeric(study$x),
  is.numeric(study$y),
  length(study$x) == length(study$y)
)

stan_data <- list(
  N = nrow(study),
  x = study$x,
  y = study$y
)

temporary_data_file <- file.path(
  tempdir(), "learning-stan-linear-regression-data.json"
)
write_stan_json(stan_data, temporary_data_file)
data_md5 <- unname(tools::md5sum(temporary_data_file))
```

CmdStanRは、名前付きlistを`$sample(data = stan_data)`へ渡すと内部でCmdStan用JSONへ変換します。L37では実際に渡す入力を指紋付きで残すため、同じ変換を`write_stan_json()`で先に行い、このJSONパスを`$sample()`へ渡します。

`$check_syntax()`と`$compile()`にはまだデータを渡しません。したがって、`N = 8`なのに`x`が7個という動的なデータ契約違反は、構文確認では検出されません。上のR側`stopifnot()`があればJSON作成前に停止し、R側検査を通さず不正なJSONを渡せば`$sample()`のデータ読込時に停止します。工程を分けると、エラーの候補を狭められます。

## 3. 構文確認とコンパイルを分ける

`cmdstan_model()`は既定でコンパイルまで進みます。教材では工程を観察するため、最初は`compile = FALSE`にします。

```r
temporary_stan_file <- file.path(
  tempdir(), "learning-stan-linear-regression.stan"
)
stopifnot(file.copy(source_file, temporary_stan_file, overwrite = TRUE))
stopifnot(
  identical(
    unname(tools::md5sum(temporary_stan_file)),
    source_md5
  )
)

model <- cmdstan_model(
  temporary_stan_file,
  compile = FALSE
)
```

教材ファイルを一時ディレクトリへコピーするのは、OS固有の実行ファイルを教材ソースの隣へ残さないためです。実際にコンパイルした入力が元ソースと同じであることは、コピー結果と指紋で確認します。

### 構文確認

```r
model$check_syntax(pedantic = TRUE)
```

`$check_syntax()`はStanコードをstanc3で解析し、構文と型が有効なら`TRUE`を不可視で返します。`pedantic = TRUE`は、事前分布の欠落候補や分布引数の問題など、構文エラー以外の警告も試みます。

pedantic警告は重要なレビュー材料ですが、完全なモデル査読器ではありません。偽陽性や検出限界があり、警告0件でも生成過程が正しいとは言えません。

### C++コンパイル

```r
model$compile()
model$exe_file()
```

`$compile()`は、構文確認、StanからC++への変換、実行ファイルの作成までを行います。構文確認が成功しても、C++ツールチェーン、ファイル権限、空き容量などの問題でコンパイルが失敗する場合があります。

作成された実行ファイルはOSと環境に依存します。通常はGitHubへコミットせず、元の`.stan`、環境情報、コンパイル手順を正本にします。

## 4. chain数と並列数を分けて指定する

教材では、4 chainを実行します。利用可能な物理コア数に応じて、同時実行数だけを調整します。

```r
physical_cores <- parallel::detectCores(logical = FALSE)
parallel_chains <- if (is.na(physical_cores)) {
  1L
} else {
  max(1L, min(4L, physical_cores))
}
```

`chains = 4`は生成するMCMC chainの本数、`parallel_chains`は同時に走らせる最大chain数です。2コアのPCで`parallel_chains = 2`としても、4 chainのうち2本ずつを実行するのであり、chain数を2本へ減らすわけではありません。

サンプリング契約を名前付き定数として先に固定します。

```r
run_seed <- 20260801L
run_chains <- 4L
run_chain_ids <- seq_len(run_chains)
run_warmup <- 1000L
run_sampling <- 1000L
```

```r
fit <- model$sample(
  data = temporary_data_file,
  seed = run_seed,
  chains = run_chains,
  chain_ids = run_chain_ids,
  parallel_chains = parallel_chains,
  iter_warmup = run_warmup,
  iter_sampling = run_sampling,
  refresh = 500
)
```

1つの`seed`を複数chainへ渡すと、CmdStanRはchain IDを使って各chainの乱数列を分けます。再実行条件には`seed`だけでなく、`chains`と`chain_ids`も含めます。

`iter_warmup`は適応を含むwarmup回数、`iter_sampling`はwarmup後に保存する回数をchainごとに指定します。4 chain、`iter_sampling = 1000`なら、thinを変更しない限り、事後drawは合計4000です。warmup drawは既定では保存されません。

`refresh`は画面への進捗表示間隔です。モデルや事後分布を変える設定ではありません。対して、`adapt_delta`や`max_treedepth`はアルゴリズムの挙動に関わります。警告を隠すために無言で変更せず、変更理由と前後の診断を記録します。

## 5. 「実行できた」を段階別に判定する

サンプリング関数からfitが返っただけで完了にしません。L37では詳細解釈をL38へ残しつつ、少なくとも次を保存・確認します。

```r
parameter_summary <- fit$summary(c("alpha", "beta", "sigma"))
sampler_summary <- fit$diagnostic_summary()
run_metadata <- fit$metadata()

print(parameter_summary)
print(sampler_summary)
```

`$diagnostic_summary()`が返すのは、chainごとのdivergence数、最大treedepth到達数、E-BFMIです。R-hatとESSのようなparameter別診断は`$summary()`で確認します。この区別をせず、「diagnostic summaryが成功したからR-hatも確認済み」とは記録しません。

`$metadata()`からは、CSVに記録されたStan版、method、chain ID、seed、設定などを取り出せます。スクリプトに書いた予定値だけでなく、実際の出力に記録された値も照合します。

### 停止工程による分類

| 停止した工程 | 最初に疑う範囲 | まだ言えないこと |
|---|---|---|
| ファイル確認 | パス、作業ディレクトリ、権限 | Stan構文の正否 |
| `$check_syntax()` | Stan構文、型、関数シグネチャ | C++ツールチェーンが使えるか |
| `$compile()` | C++ツールチェーン、Make、権限、容量 | 実データが契約を満たすか |
| `$sample()`開始前後 | data名・型・長さ・値域、初期値 | MCMCの探索が十分か |
| sampling警告 | 事後分布の幾何、尺度、パラメータ化 | 推定値を解釈してよいか |
| 出力保存 | 保存先、権限、容量、命名 | メモリ上のfitが妥当か |

同じエラーメッセージを消すことと、原因を直すことを分けます。初回メッセージ、停止工程、原因仮説、単一の修正、再実行結果を残します。

## 6. 一時CSVを永続成果物へ移す

`output_dir`を指定しない場合、CmdStanのCSVは一時ディレクトリに作られます。fitオブジェクトが破棄されると一時ファイルも削除され得るため、`fit$output_files()`のパスをメモしただけでは長期保存になりません。

実行ごとに固有の保存先を作ります。

```r
run_id <- "run-20260809-l37"
run_dir <- file.path("outputs", "stan-linear-regression", run_id)
dir.create(run_dir, recursive = TRUE, showWarnings = FALSE)
```

一時領域でサンプリングした後なら、出力CSVと入力JSONを移します。

```r
saved_csv <- fit$save_output_files(
  dir = run_dir,
  basename = "linear-regression"
)

saved_data <- fit$save_data_file(
  dir = run_dir,
  basename = "linear-regression-data",
  timestamp = FALSE,
  random = FALSE
)
```

`$save_output_files()`は、CSVを指定先へ移し、fit内部の参照先も更新します。別の方法として、`$sample(output_dir = run_dir, output_basename = "linear-regression")`を指定すれば、最初から永続ディレクトリへ書けます。

fitはCmdStan CSVを必要になった時点で読み込むため、Rオブジェクトを長期保存する場合は専用メソッドを使います。

```r
fit$save_object(file.path(run_dir, "fit.rds"))
```

`saveRDS(fit, ...)`を直接使うより、`$save_object()`は必要なdrawと診断を確実に読み込んでから保存する安全な方法です。

### 実行記録を保存する

```r
run_record <- data.frame(
  run_id = run_id,
  stan_file = source_file,
  source_md5 = source_md5,
  data_md5 = data_md5,
  r_version = R.version.string,
  cmdstanr_version = as.character(packageVersion("cmdstanr")),
  cmdstan_version = as.character(cmdstan_version()),
  seed = run_seed,
  chains = run_chains,
  chain_ids = paste(run_chain_ids, collapse = ","),
  parallel_chains = parallel_chains,
  iter_warmup = run_warmup,
  iter_sampling = run_sampling,
  stringsAsFactors = FALSE
)

write.csv(
  run_record,
  file.path(run_dir, "run-record.csv"),
  row.names = FALSE
)

csv_record <- data.frame(
  file = basename(saved_csv),
  md5 = unname(tools::md5sum(saved_csv)),
  stringsAsFactors = FALSE
)

write.csv(
  csv_record,
  file.path(run_dir, "output-files.csv"),
  row.names = FALSE
)
```

出力CSVの既定名にはtimestampやランダム文字列が入ります。ファイル名を無理に固定するより、固有のrunディレクトリと実際のファイル名・内容指紋を記録します。

研究データから作った入力JSON、draw、コンソールログには、機微情報や研究上非公開の値が含まれ得ます。教材GitHubへ自動コミットせず、研究計画と保存規則に従う場所へ置きます。

## 7. 6回の練習で実行経路を身につける

### 1回目: 読む・予測する

実行前に、各行が環境確認、ファイル確認、構文確認、コンパイル、データ検査、サンプリング、診断、保存のどこで動くかを予測します。失敗した場合に、どこまで成功したと言えるかも書きます。

### 2回目: 穴埋めする

次の設定を見本なしで補います。

```r
fit <- model$sample(
  data = __________,
  seed = __________,
  chains = __________,
  chain_ids = __________,
  parallel_chains = __________,
  iter_warmup = __________,
  iter_sampling = __________
)
```

補った値を、実行記録の列へ対応付けます。

### 3回目: 一部を変える

`parallel_chains`だけを4から1へ変えます。chain数、chain ID、保存draw数、実行時間のうち、変わるものと変わらないものを予測してから実行します。

### 4回目: エラーを直す

Stan側が`vector[N] x`を要求するのに、R側の`x`が`N - 1`個しかない状態を実行します。構文確認とコンパイルは通るがデータ読込時に停止することを確認し、初回メッセージを保存してR側だけを直します。

### 5回目: 見本なし

完成スクリプトを閉じ、環境記録からCSV・入力データ・fit・実行記録の保存までを白紙で再構成します。初回コードを残した後に公式資料を参照し、修正版と参照した資料や助けを記録します。

### 6回目: 別文脈へ移す

L36のBernoulli-logitモデルへ同じ実行契約を移します。0/1の整数配列を渡し、別のrunディレクトリへ4 chainのCSVと入力JSONを保存します。L40後には、見本を閉じて別のPoisson-logモデルでも再実行します。

## よくある誤り

1. **seedだけで再現可能になったと考える**
   コード、データ、版、chain ID、iteration、出力、診断も記録します。

2. **`parallel_chains`をchain数だと考える**
   `chains`は生成するchain数、`parallel_chains`は同時実行数です。

3. **構文確認成功を実行成功と呼ぶ**
   `$check_syntax()`はC++コンパイル、実データ読込、サンプリングを実行しません。

4. **コンパイル成功をモデル妥当性の証明にする**
   コンパイラは研究上の生成過程や事後分布の探索品質を保証しません。

5. **fitが返れば診断済みと考える**
   `$diagnostic_summary()`と`$summary()`の対象を分け、警告があれば解釈を止めます。

6. **一時CSVのパスだけを結果として記録する**
   一時ファイルは削除され得ます。永続先へ移し、保存後のパスと指紋を記録します。

7. **実行ファイルや研究drawを無条件にGitへ入れる**
   OS固有バイナリ、機微データ、巨大なdrawをソース管理へ混ぜず、保存方針を分けます。

8. **エラー後に複数設定を同時変更する**
   停止工程を分類し、原因仮説に対応する変更を1つずつ行います。

## 内容理解問題

回答は`foundation-assessments.json`に対応します。選択問題は選択肢をシャッフルして提示し、初回回答をフィードバック前に保存します。

1. `stan-l37-q1-execution-stages`: 構文確認、コンパイル、サンプリングの成功範囲を区別できるか。
2. `stan-l37-q2-output-lifetime`: 既定の一時CSVを永続成果物と誤認しないか。
3. `stan-l37-q3-reproduction-record`: 再実行に必要な環境・入力・設定・出力を記録できるか。
4. `stan-l37-q4-chains-parallelism`: chain数、chain ID、並列数、seedの関係を説明できるか。
5. `stan-l37-q5-transfer-logit-run`: 同じ実行契約を二値応答モデルへ移せるか。

理解問題の正答は練習支援です。直接評価では、自分のPCで得た初回ログ、保存ファイル、実行記録を確認します。

## 直接評価

### A. 単回帰の実行記録

環境確認から4 chainの実行、診断、CSV・入力JSON・fit・実行記録の保存までを行います。

合格の観点:

- R、CmdStanR、CmdStanの版とパスを記録する。
- 元の`.stan`とデータの正本・内容指紋を示す。
- seed、chain ID、並列数、warmup、sampling回数を分けて記録する。
- 一時パスではない保存済みCSVと入力JSONを特定できる。

### B. データ契約エラーの修正記録

`x`の長さを意図的に1つ不足させ、R側の事前検査、構文確認、コンパイル、Stanのデータ読込のどこで検出できるかを記録します。その後、R側だけを修正して同じ設定で再実行します。

合格の観点:

- R側の事前検査が最初に停止し、これを行わない場合も構文確認・コンパイルではなくStanのデータ読込時に停止すると説明する。
- 初回メッセージ、停止工程、原因、単一修正、再実行結果が分かれている。
- MCMC設定を変更してデータ契約違反を隠していない。

### C. Bernoulli-logitへの未見転移

単回帰の完成スクリプトを見ずに、L36の二値応答モデルを別ディレクトリで実行・保存します。

合格の観点:

- 0/1の整数配列をStanのdata契約へ合わせる。
- `compile = FALSE`から構文確認、コンパイル、4 chain実行を分ける。
- 単回帰と同じ再現性項目を記録する。
- 応答型とStanファイルが違うため、run IDと成果物を単回帰へ上書きしない。

## 公式資料

- [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html)
- [CmdStanR: Check syntax](https://mc-stan.org/cmdstanr/reference/model-method-check_syntax.html)
- [CmdStanR: Compile a Stan program](https://mc-stan.org/cmdstanr/reference/model-method-compile.html)
- [CmdStanR: Run Stan's MCMC algorithms](https://mc-stan.org/cmdstanr/reference/model-method-sample.html)
- [CmdStanR: Write data to JSON](https://mc-stan.org/cmdstanr/reference/write_stan_json.html)
- [CmdStanR: Save output and data files](https://mc-stan.org/cmdstanr/reference/fit-method-save_output_files.html)
- [CmdStanR: Save fitted model object](https://mc-stan.org/cmdstanr/reference/fit-method-save_object.html)
- [CmdStanR: Extract metadata](https://mc-stan.org/cmdstanr/reference/fit-method-metadata.html)
- [CmdStanR: Sampler diagnostic summaries](https://mc-stan.org/cmdstanr/reference/fit-method-diagnostic_summary.html)

L37を終えたら、別の人が「何を、どの環境で、どの設定で実行し、どのファイルと診断を得たか」を追跡できるか確かめてください。同じ実行手順を別の応答型へ移すと、記録の不足にも気づきやすくなります。
