# 典拠一覧

この教材は一次情報（公式ドキュメント・CRAN・パッケージ同梱のヘルプ）に依拠して書いています。
本文中の事実主張の裏づけをここにまとめます。**最終確認日: 2026-07-31**

バージョン番号や配布ページの構成は変わります。ここに書かれた確認日より後にご覧の方は、
リンク先の現物を優先してください。

## R 本体の配布

| 主張 | 典拠 | 確認内容 |
|---|---|---|
| macOS版RはApple Silicon(`arm64`)とIntel(`x86_64`)で別インストーラ | [CRAN macOS](https://cran.r-project.org/bin/macosx/) | `R-4.6.1-arm64.pkg`(macOS 14以降)と `R-4.6.1-x86_64.pkg`(macOS 11以降)が別々に配布されている |
| Windows版はCPUの種類を選ばない | [CRAN Windows](https://cran.r-project.org/bin/windows/base/) | `R-4.6.1-win.exe` の64bit単一インストーラ。UCRT を要するため Windows 10 以降が対象 |
| 現行リリース | 同上 | R 4.6.1（2026-06-24 リリース） |

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
| cmdstanr | **CRANでは配布されていない**（r-universe 経由で入れる） |

Stan本体は [stan-dev/stan](https://github.com/stan-dev/stan/releases) の v2.39.0（2026-05-19）が最新。
rstan が同梱する Stan はこれより古い世代であるため、本教材は `backend = "cmdstanr"` を標準とします。

## brms の挙動（同梱ヘルプで確認）

| 主張 | 典拠 | 原文 |
|---|---|---|
| 反応時間には `shifted_lognormal` / `exgaussian` が適する | `?brmsfamily` | "Family `exgaussian` ('exponentially modified Gaussian') and `shifted_lognormal` are especially suited to model reaction times" |
| `conditional_effects` は他の共変量を固定して描く | `?conditional_effects` | 連続変数は "using their means"、因子は "will get their first level assigned"。既定は `re_formula = NA`（ランダム効果を除く）・`robust = TRUE`（中央値）・`method = "posterior_epred"` |

## コード例の実行結果

レッスン本文のコードと実行結果は、すべて **R 4.6.0 (2026-04-24)** で実行した値をそのまま貼っています
（空白の数まで一致させています）。ロードマップの検定力シミュレーションの理論値
`33.77%` は `power.t.test(n = 20, delta = 0.5, sd = 1, sig.level = 0.05)` の実測値です。

乱数を使う例は `set.seed()` を置いていますが、Rのバージョンや乱数生成器の既定が変わると
結果はわずかに動きます。
