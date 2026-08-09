# 典拠一覧

この教材は一次情報（公式ドキュメント・CRAN・パッケージ同梱のヘルプ）に依拠して書いています。
本文中の事実主張の裏づけをここにまとめます。**最終確認日: 2026-08-01**

バージョン番号や配布ページの構成は変わります。ここに書かれた確認日より後にご覧の方は、
リンク先の現物を優先してください。

## 開発ツールチェーン

| 主張 | 典拠 | 確認内容 |
|---|---|---|
| CIで固定するNode.jsとnpm | [Node.js公式リリース索引](https://nodejs.org/dist/index.json) | Node.js 22.23.1（LTS Jod、2026-06-22）の配布メタデータに同梱npm 10.9.8と記載 |
| Excel教材の生成ランタイム | [ExcelJS公式リポジトリ](https://github.com/exceljs/exceljs) | ExcelJS 4.4.0を開発依存へ固定し、ワークブック・ワークシート・型付きセル・書式・固定行・XLSX保存を使用する |
| ExcelJSの推移依存に対する安全更新 | [uuid公式リポジトリ](https://github.com/uuidjs/uuid) | CommonJS対応が残るuuid 11.1.1へ上書き固定し、生成互換性と`npm audit`脆弱性0件を検査する |

## R 本体の配布

| 主張 | 典拠 | 確認内容 |
|---|---|---|
| macOS版RはApple Silicon(`arm64`)とIntel(`x86_64`)で別インストーラ | [CRAN macOS](https://cran.r-project.org/bin/macosx/) | `R-4.6.1-arm64.pkg`(macOS 14以降)と `R-4.6.1-x86_64.pkg`(macOS 11以降)が別々に配布されている |
| Windows版はCPUの種類を選ばない | [CRAN Windows](https://cran.r-project.org/bin/windows/base/) | `R-4.6.1-win.exe` の64bit単一インストーラ。UCRT を要するため Windows 10 以降が対象 |
| 現行リリース | 同上 | R 4.6.1（2026-06-24 リリース） |

## R 基本文法

| 主張 | 根拠 | 確認内容 |
|---|---|---|
| 型を指定しない `NA` は logical の欠損値定数 | [R base: NA](https://stat.ethz.ch/R-manual/R-devel/library/base/html/NA.html) | `NA` は長さ1の logical 定数。型付きの `NA_integer_` などとは区別される |
| `factor()` の既定の水準順はロケールに依存しうる | [R base: factor](https://stat.ethz.ch/R-manual/R-devel/library/base/html/factor.html) | `levels` を省略すると一意な値をソートして水準を決めるため、順序を再現したい教材例では明示する |

## STEP 1 データ操作

| 教材上の主張 | 一次資料 | 確認内容 |
|---|---|---|
| `read_csv()` はCSVをtibbleとして読み、列型を推測する | [readr: read_delim](https://readr.tidyverse.org/reference/read_delim.html) | `read_csv()` の入力、`col_types`、`na`、`show_col_types` の挙動を確認。教材では読込後に行数・列名・列型を別途検査する |
| TSVと任意区切りテキストを読む | [readr: read_delim](https://readr.tidyverse.org/reference/read_delim.html) | タブ区切りには`read_tsv()`、その他の1文字区切りには`read_delim(delim = ...)`を使用する |
| `.xls` / `.xlsx`をシート・範囲指定で読む | [readxl: read_excel](https://readxl.tidyverse.org/reference/read_excel.html) | `sheet`、`range`、`col_types`、`na`と、空白セルの扱いを確認。readxl 1.5.0を検証下限とする |
| 複数表へ同じ読込処理を適用し、元ファイル名付きで行結合する | [purrr: map](https://purrr.tidyverse.org/reference/map.html)、[purrr: list_rbind](https://purrr.tidyverse.org/reference/list_c.html) | supersededの`map_dfr()`ではなく`map()`と`list_rbind(names_to = ...)`を使用。purrr 1.2.2を検証下限とする |
| 値が指定範囲内かを検査する | [dplyr: between](https://dplyr.tidyverse.org/reference/between.html) | `between(x, left, right)`が両端を含む論理ベクトルを返すことを確認。教材では反応時間の仮の許容範囲を検査する |
| 複数条件を優先順に分類する | [dplyr: case_when](https://dplyr.tidyverse.org/reference/case-and-replace-when.html) | 条件を上から評価し、最初に一致した右辺を使う。教材では問題種別を`issue`列へ記録し、複数問題を扱う場合の限界も明記する |
| 別表に対応しないキーだけを抽出する | [dplyr: filtering joins](https://dplyr.tidyverse.org/reference/filter-joins.html) | `anti_join()`が右表に一致がない左表の行を返すことを確認。参加者表にないIDの品質検査へ使う |
| `summarise()` はグループの組合せごとに要約行を作る | [dplyr: summarise](https://dplyr.tidyverse.org/reference/summarise.html) | `group_by()` 後の要約単位と、出力のグループ状態を明示する `.groups` を確認 |
| `left_join()` は左表の行を保ち、結合関係を検査できる | [dplyr: mutating joins](https://dplyr.tidyverse.org/reference/mutate-joins.html) | `by` によるキー指定と、`relationship = "many-to-one"` による想定外の多対多関係の検出を確認 |
| `pivot_longer()` / `pivot_wider()` で縦長・横長を変換する | [tidyr: pivot_longer](https://tidyr.tidyverse.org/reference/pivot_longer.html) | 列名を値へ移す縦長化と、その逆変換に使う引数を確認 |
| `write_csv()`・`write_tsv()`・`write_excel_csv()`で区切りテキストを保存する | [readr: write_delim](https://readr.tidyverse.org/reference/write_delim.html) | 列名、欠損値、上書き、BOM付きExcel向けCSVの挙動を確認。`write_excel_csv()`は`.xlsx`を作らないことを明記する |
| 真の`.xlsx`を書き出すには専用関数が必要 | [writexl: write_xlsx](https://docs.ropensci.org/writexl/reference/write_xlsx.html) | `write_xlsx()`はdata frameまたは名前付きdata frameリストをxlsxへ書き出す。STEP 1の必須成果物はツール非依存のCSVとし、xlsx出力は任意紹介に留める |

教材例の検証下限はdplyr 1.2.1、readr 2.2.0、readxl 1.5.0、tidyr 1.3.2、tibble 3.3.1、purrr 1.2.2、ggplot2 4.0.3、NB1抽出実行用knitr 1.51、Quarto描画用rmarkdown 2.31とし、CIが不足版を導入してから実行する。

## STEP 2 記述統計・可視化

| 教材上の主張 | 一次資料 | 確認内容 |
|---|---|---|
| `quantile()`の既定`type = 7`でQ1・中央値・Q3を計算する | [R stats: quantile](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html) | 分位点には複数定義があるため、教材値と他ソフトを照合するときは計算法も記録する |
| `aes()`はデータ列を視覚属性へ対応付け、geomと役割が異なる | [ggplot2: ggplot](https://ggplot2.tidyverse.org/reference/ggplot.html)、[ggplot2: aes](https://ggplot2.tidyverse.org/reference/aes.html) | カテゴリ`condition`をx、連続量`mean_rt`をyへ対応付け、箱ひげと点を別レイヤーとして重ねる |
| 箱ひげへ全参加者点を重ね、外れ値記号の二重表示を避ける | [ggplot2: geom_boxplot](https://ggplot2.tidyverse.org/reference/geom_boxplot.html) | `outlier.shape = NA`はデータ行の除外ではなく箱ひげ層の外れ値記号を非表示にする指定として使う |
| jitterの横位置を再現可能にする | [ggplot2: position_jitter](https://ggplot2.tidyverse.org/reference/position_jitter.html) | `width = 0.08`、`height = 0`、`seed = 20260802`により反応時間の縦位置を変えず、横方向の重なりだけを固定して避ける |
| 同じ参加者の2条件だけを線で結ぶ | [ggplot2: grouping](https://ggplot2.tidyverse.org/reference/aes_group_order.html)、[ggplot2: geom_line](https://ggplot2.tidyverse.org/reference/geom_path.html) | 離散xの既定groupへ任せず`aes(group = id)`を線レイヤーへ指定し、24名を24本の線・48点として描く |
| PNGの対象plot・寸法・解像度を明示する | [ggplot2: ggsave](https://ggplot2.tidyverse.org/reference/ggsave.html) | `plot`、7×5 inch、300 dpi、白背景を指定し、2100×1500pxの出力を検査する |
| L17〜L19を1つの入口から順番に実行する | [R: source](https://stat.ethz.ch/R-manual/R-devel/library/base/html/source.html) | 3スクリプトを専用environmentで順に評価し、Global Environmentの既存オブジェクトに依存しない入口を作る |
| 入力と6成果物の内容指紋を記録する | [R tools: md5sum](https://stat.ethz.ch/R-manual/R-devel/library/tools/html/md5sum.html) | 入力が実行前後で不変であることと、成果物の再実行一致を検査する。妥当性・真正性の証明とは区別する |

ggplot2公式サイトで4.0.3を確認し、L18〜L20はR 4.5.1 + ggplot2 4.0.3でもローカル実行した。公開CIではR 4.6.1と同じ検証下限を使う。

## RStudio

| 主張 | 典拠 | 確認内容 |
|---|---|---|
| RStudioの入手先 | [RStudio User Guide](https://docs.posit.co/ide/user/) | 旧 `posit.co/download/rstudio-desktop/` は301でこのページへ転送される。ページ下部の Direct Downloads に macOS(.dmg)・Windows(.exe/zip)の無料版がある |
| 画面は4ペイン。ただしスクリプトは初期状態では非表示 | [同ガイド ui-panes](https://docs.posit.co/ide/user/ide/guide/ui/ui-panes.html) | "The RStudio user interface has 4 primary panes and an optional sidebar pane." Sourceペインは "can be launched by opening any editable file in RStudio" |
| Posit社はRStudioの保守継続を表明している | [Announcing Positron, a new Data Science IDE](https://posit.co/blog/positron-product-announcement-aug-2025)（2025-08-14） | 原文: "RStudio includes 14+ years of R focused optimizations and we are committed to maintaining and updating RStudio." |

## パッケージ（ロードマップ記載分）

CRAN の DESCRIPTION で確認した版。

| パッケージ | 版 |
|---|---|
| brms | 2.23.0 |
| bayestestR | 0.18.1 |
| sjPlot | 2.9.0 |
| loo | 2.10.1 |
| rstan | 2.32.7 |
| tidybayes | 3.0.7 |
| cmdstanr | 0.9.0（CRANでは配布されていないためr-universe経由） |

Stan本体は [stan-dev/stan](https://github.com/stan-dev/stan/releases) の v2.39.0（2026-05-19）が最新。
rstan が同梱する Stan はこれより古い世代であるため、本教材は `backend = "cmdstanr"` を標準とします。

## Stan教材原稿

| 教材上の主張 | 一次資料 | 確認内容 |
|---|---|---|
| ブロックごとに実行時期・保存対象・許可される処理が異なる | [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html) | transformed dataはデータ読込後、transformed parametersとmodelは対数密度評価時、generated quantitiesはdraw生成後に実行される |
| 制約付きparameterは内部の無制約空間との間で変換される | [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html) | parametersの制約変換とJacobian調整を、事前分布そのものと区別した |
| すべての変数は明示的な型を持ち、array・vector・row_vector・matrixは相互交換できない | [Stan Reference Manual: Data Types and Declarations](https://mc-stan.org/docs/reference-manual/types.html) | L35で要素数と型を分離し、直接代入できない例と明示的変換を扱う |
| distribution statementは乱数生成ではなく、非正規化対数密度を`target`へ加える | [Stan Reference Manual: Statements](https://mc-stan.org/docs/reference-manual/statements.html)、[Stan User's Guide: Proportionality Constants](https://mc-stan.org/docs/stan-users-guide/proportionality-constants.html) | L36で`~`を`target += ..._lupdf`へ対応付け、正規化定数を含む`..._lpdf`とは`target()`の数値が違い得ることを説明した |
| 単回帰の正規尤度はvector化できる | [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html) | `y ~ normal(alpha + beta * x, sigma)`と観測ごとのloopが同じモデルを表す |
| parameterに明示的な事前分布がなくてもモデルは構文上成立し得るが、宣言支持上の暗黙の一様事前分布は不適切になり得る | [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)、[Stan User's Guide: Problematic Posteriors](https://mc-stan.org/docs/stan-users-guide/problematic-posteriors.html) | L36で事前分布欠落をコンパイルエラーではなくモデルレビュー課題とし、事後分布の適切性を別に確認する |
| `bernoulli_logit`はlogit尺度の線形予測子を直接受け取り、`bernoulli(inv_logit(...))`より数値的に安定である | [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)、[Stan Functions Reference: Binary Distributions](https://mc-stan.org/docs/functions-reference/binary_distributions.html) | L36で0/1観測、確率、logit尺度を分け、`inv_logit`による応答尺度への変換を扱う |
| CmdStanRは`.stan`をコンパイルし、名前付きR listをdataとして`$sample()`へ渡す | [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html) | `cmdstan_model()`、`$sample()`、複数chain、seed、fit要約の基本経路を確認 |
| `$check_syntax()`はコンパイルせずStan構文を検査し、`$compile()`はStan-to-C++変換と実行ファイル生成を行う | [CmdStanR: Check syntax](https://mc-stan.org/cmdstanr/reference/model-method-check_syntax.html)、[CmdStanR: Compile](https://mc-stan.org/cmdstanr/reference/model-method-compile.html) | L34とL37で構文確認・コンパイル・サンプリングの成功範囲を分離した |
| 複数chainへ単一seedを渡すとchain IDで乱数列が分けられ、`chains`と`parallel_chains`は生成本数と同時実行数を別々に指定する | [CmdStanR: Run Stan's MCMC algorithms](https://mc-stan.org/cmdstanr/reference/model-method-sample.html) | L37でseed、chain ID、並列数、warmup・sampling回数を別の再現性項目として記録する |
| `output_dir = NULL`のCmdStan CSVは一時領域に置かれ、fit破棄時に削除され得る | [CmdStanR: Run Stan's MCMC algorithms](https://mc-stan.org/cmdstanr/reference/model-method-sample.html)、[CmdStanR: Save output and data files](https://mc-stan.org/cmdstanr/reference/fit-method-save_output_files.html) | L37で`save_output_files()`または永続`output_dir`を必須の保存判断として扱う |
| fitのmetadataはCSVに記録されたStan版・seed・chain ID・設定を含み、`save_object()`は遅延読込されるdrawと診断を保存前に確実に読む | [CmdStanR: Extract metadata](https://mc-stan.org/cmdstanr/reference/fit-method-metadata.html)、[CmdStanR: Save fitted model object](https://mc-stan.org/cmdstanr/reference/fit-method-save_object.html) | L37でスクリプト上の予定値と実出力metadataを照合し、CSV・入力JSON・fit・実行記録を同じrunへ結ぶ |
| warmup後のdivergenceは推定の偏りにつながり得るため原因を調べ、最大treedepth到達とは重大度を分ける | [CmdStan Guide: Diagnose utility](https://mc-stan.org/docs/cmdstan-guide/diagnose_utility.html) | L38ではdivergenceがあれば実質的解釈を止める。最大treedepth到達は主に効率問題として、尺度・相関・ESS・計算時間を調べる |
| E-BFMI 0.30未満はエネルギー探索を調べる名目的な警告線 | [CmdStan Guide: Diagnose utility](https://mc-stan.org/docs/cmdstan-guide/diagnose_utility.html) | 合否の自然法則ではなく、chain、heavy tail、尺度、parameterizationを調べ始める目安として扱う |
| rank-normalized split R-hatの一般推奨は1.01未満で、収束は全parameterについて調べる | [Stan Reference Manual: Posterior Analysis](https://mc-stan.org/docs/reference-manual/analysis.html) | 表示上の1.00だけで収束を証明したとせず、全parameter・重要生成量・HMC診断を合わせて確認する |
| ESSはbulkとtailを報告し、概ね各chain 100以上を確認する | [RStan: R-hat and effective sample size](https://mc-stan.org/rstan/reference/Rhat.html) | 4 chainでは400を一般確認線とするが、研究目的に必要な精度を保証する万能値とはしない |
| CmdStanRの要約はposteriorの要約関数を追加でき、平均・SD・分位点には対応するMCSEがある | [CmdStanR: Compute summary estimates and diagnostics](https://mc-stan.org/cmdstanr/reference/fit-method-summary.html)、[posterior: MCMC diagnostics](https://mc-stan.org/posterior/reference/diagnostics.html)、[posterior: Quantile MCSE](https://mc-stan.org/posterior/reference/mcse_quantile.html) | posterior SDとMonte Carlo近似誤差を分け、MCSEを実際に報告する量と研究上必要な精度に照らして判断する |
| `generated quantities`は各sample後に実行され、そこで作る量はsampling済みparameterへ影響しない | [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html) | L39で`log_lik`と`y_rep`をdraw後の保存量として実装し、sampling中の`target`定義と分離する |
| 事後予測チェックは同じ観測設計の複製データを生成し、観測値と複製へ同じ統計量を適用する | [Stan User's Guide: Posterior and Prior Predictive Checks](https://mc-stan.org/docs/2_39/stan-users-guide/posterior-predictive-checks.html) | 全体平均だけでなくSD・最大値・予測子区間別統計量を比較し、合否検定ではなく再現できない特徴を探すモデル批判として扱う |
| `loo()`へ渡すpointwise対数尤度はdraw×観測、またはiteration×chain×観測である | [loo: Efficient approximate leave-one-out cross-validation](https://mc-stan.org/loo/reference/loo.html) | `log_lik[n]`を観測nの寄与へ対応付け、モデル間で観測集合・ID・順序・除外単位をそろえる |
| PSISの主要なPareto k診断線はposterior sample size Sに依存する | [loo package glossary](https://mc-stan.org/loo/reference/loo-glossary.html) | `min(1 - 1/log10(S), 0.7)`を使い、固定0.7の暗記ではなくrunごとの閾値と影響観測を確認する |
| `loo_compare()`の`elpd_diff`は最良モデルを0とする差で、`se_diff`は点別差から作るpairedな標準誤差である | [loo: Model comparison](https://mc-stan.org/loo/reference/loo_compare.html) | Pareto k、`diag_diff`、PPCを確認してから差と不確実性を一緒に読み、順位を真実性へ格上げしない |
| stackingは候補のLOO予測分布を組み合わせる重みを最適化する | [loo: Model averaging and weighting](https://mc-stan.org/loo/reference/loo_model_weights.html) | stacking weightをposterior model probabilityと呼ばず、候補集合と予測課題に依存する予測上の重みとして扱う |
| 階層尺度が変わるfunnelはHMCに難しい幾何を作り、non-centered表現は標準正規の座標から同じ階層分布を構成できる | [Stan User's Guide: Reparameterization and Change of Variables](https://mc-stan.org/docs/stan-users-guide/reparameterization.html) | L40で`z ~ std_normal()`、`theta = mu + tau * z`へ書き換え、生成的構成と一般のJacobian調整を区別する |
| centeredとnon-centeredの効率はデータ情報量に依存し、データが少ない場合はnon-centered、多い場合はcenteredが有利になり得る | [Stan User's Guide: Reparameterization and Change of Variables](https://mc-stan.org/docs/stan-users-guide/reparameterization.html) | 一方を常時正解にせず、弱い群情報と強い群情報で診断・MCSE・ESS/secを比較する |
| 予測子・応答の標準化は計算効率を改善し得るが、prior尺度と元尺度への逆変換を対応させる必要がある | [Stan User's Guide: Standardizing Predictors and Outputs](https://mc-stan.org/docs/stan-users-guide/efficiency-tuning.html#standardizing-predictors-and-outputs) | 中心・尺度を保存し、prior predictive checkと元尺度での係数・予測報告までをL40の契約に含める |
| 強く変化する曲率では数値積分誤差によるdivergenceや小さいstep sizeによる長いtrajectoryが生じ得る | [Stan Reference Manual: Hamiltonian Monte Carlo](https://mc-stan.org/docs/reference-manual/mcmc.html) | `adapt_delta`だけを原因説明にせず、funnel、尺度、divergent位置、treedepth、効率を診断する |
| prior predictive checkは観測データで条件付ける前、posterior predictive checkは条件付けた後の生成含意を調べる | [Stan User's Guide: Posterior and Prior Predictive Checks](https://mc-stan.org/docs/stan-users-guide/posterior-predictive-checks.html) | L41のコード前protocolでprior predictiveを正式fit前のgateとし、posterior predictiveを重要な全体・条件付き統計量のモデル批判へ使う |
| 新しいデータのposterior predictionは、既存観測の複製によるモデル検査とは予測対象・入力が異なる | [Stan User's Guide: Posterior Prediction](https://mc-stan.org/docs/stan-users-guide/posterior-prediction.html) | estimand、既存参加者の次観測、新規参加者の予測を分け、holdout単位と生成する量を先に定義する |
| CmdStanR fit metadataは実際の出力CSVに記録された版・seed・chain ID・設定を取得できる | [CmdStanR: Extract metadata](https://mc-stan.org/cmdstanr/reference/fit-method-metadata.html) | スクリプト上の予定値ではなくrun実績をartifact manifestとreportへ対応付ける |

Stan教材パックの一次資料は`mc-stan.org`に限定し、最終確認日は2026-08-09とする。静的検証の成功はStanコンパイラでの構文確認やMCMC診断の代替ではない。

## brms の挙動（同梱ヘルプで確認）

| 主張 | 典拠 | 原文 |
|---|---|---|
| 反応時間には `shifted_lognormal` / `exgaussian` が適する | `?brmsfamily` | "Family `exgaussian` ('exponentially modified Gaussian') and `shifted_lognormal` are especially suited to model reaction times" |
| `conditional_effects` は他の共変量を固定して描く | `?conditional_effects` | 連続変数は "using their means"、因子は "will get their first level assigned"。既定は `re_formula = NA`（ランダム効果を除く）・`robust = TRUE`（中央値）・`method = "posterior_epred"` |

## コード例の実行結果

レッスン本文と実機チェックで期待出力を載せるコードは、検証器により **R 4.6.1 (2026-06-24)** で再実行し、表示内容を照合しています。STEP 1では公開CSVを検証用の一時Projectへ複製し、教材と同じ相対パスで実行します。改行コードと行末空白のみ正規化し、通常は厳密比較します。丸め差を許す例は `numeric` として許容誤差を明示します。コンソール転記・未完成の穴埋めコード・ネットワークやライブラリを変更する導入コマンドは `manual` とし、自動化しない理由を教材データに記録しています。ロードマップの検定力シミュレーションの理論値
`33.77%` は `power.t.test(n = 20, delta = 0.5, sd = 1, sig.level = 0.05)` の実測値です。

乱数を使う例は `set.seed()` を置いていますが、Rのバージョンや乱数生成器の既定が変わると
結果はわずかに動きます。
