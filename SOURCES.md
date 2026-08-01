# 典拠一覧

この教材は一次情報（公式ドキュメント・CRAN・パッケージ同梱のヘルプ）に依拠して書いています。
本文中の事実主張の裏づけをここにまとめます。**最終確認日: 2026-08-01**

バージョン番号や配布ページの構成は変わります。ここに書かれた確認日より後にご覧の方は、
リンク先の現物を優先してください。

## 開発ツールチェーン

| 主張 | 典拠 | 確認内容 |
|---|---|---|
| CIで固定するNode.jsとnpm | [Node.js公式リリース索引](https://nodejs.org/dist/index.json) | Node.js 22.23.1（LTS Jod、2026-06-22）の配布メタデータに同梱npm 10.9.8と記載 |

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
| 単回帰の正規尤度はvector化できる | [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html) | `y ~ normal(alpha + beta * x, sigma)`と観測ごとのloopが同じモデルを表す |
| CmdStanRは`.stan`をコンパイルし、名前付きR listをdataとして`$sample()`へ渡す | [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html) | `cmdstan_model()`、`$sample()`、複数chain、seed、fit要約の基本経路を確認 |
| 診断はdivergence、treedepth、E-BFMI、ESS、R-hatを含む | [CmdStan diagnose utility](https://mc-stan.org/docs/2_39/cmdstan-guide/diagnose_utility.html) | 推定値の解釈前に計算上の問題を確認する構成とした |

Stan教材パックの一次資料は`mc-stan.org`に限定し、最終確認日は2026-08-01とする。静的検証の成功はStanコンパイラでの構文確認やMCMC診断の代替ではない。

## brms の挙動（同梱ヘルプで確認）

| 主張 | 典拠 | 原文 |
|---|---|---|
| 反応時間には `shifted_lognormal` / `exgaussian` が適する | `?brmsfamily` | "Family `exgaussian` ('exponentially modified Gaussian') and `shifted_lognormal` are especially suited to model reaction times" |
| `conditional_effects` は他の共変量を固定して描く | `?conditional_effects` | 連続変数は "using their means"、因子は "will get their first level assigned"。既定は `re_formula = NA`（ランダム効果を除く）・`robust = TRUE`（中央値）・`method = "posterior_epred"` |

## コード例の実行結果

レッスン本文と実機チェックで期待出力を載せる25件のコードは、検証器により **R 4.6.1 (2026-06-24)** で再実行し、表示内容を照合しています。改行コードと行末空白のみ正規化し、通常は厳密比較します。丸め差を許す例は `numeric` として許容誤差を明示します。コンソール転記・未完成の穴埋めコード・ネットワークやライブラリを変更する導入コマンドの16件は `manual` とし、自動化しない理由を教材データに記録しています。ロードマップの検定力シミュレーションの理論値
`33.77%` は `power.t.test(n = 20, delta = 0.5, sd = 1, sig.level = 0.05)` の実測値です。

乱数を使う例は `set.seed()` を置いていますが、Rのバージョンや乱数生成器の既定が変わると
結果はわずかに動きます。
