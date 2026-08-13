# 07 brmsで連続応答を一周する――式から予測・報告まで

## この回のゴール

連続応答の研究質問を`brms`のformula・family・priorへ翻訳し、推定後のdrawから予測と不確実性を研究質問に沿って報告できる。

## 前提

線形回帰のintercept・傾き・残差、事前予測の目的、Rのdata frameを知っていること。ここではまず独立な参加者を仮定する。反復測定なら、参加者の行を独立とみなす代わりに後の階層モデルを使う。

## 研究場面：練習時間と記憶テスト得点

45人が、学習前の基礎テスト `baseline`、練習時間 `practice_h`、翌日の記憶得点 `memory`（0〜100点）を記録した。「練習時間が1時間長い参加者は、同じ基礎得点なら平均でどれだけ異なる翌日得点を示すか」を推定量とする。これは観察データなら関連であり、練習を増やした因果効果ではない。

| participant | baseline | practice_h | memory |
|---|---:|---:|---:|
| P01 | 54 | 1.0 | 61 |
| P02 | 67 | 2.5 | 77 |
| P03 | 73 | 1.5 | 76 |

予測子を平均の周りに中心化すると、interceptに意味が出る。

```r
dat$practice_c <- dat$practice_h - mean(dat$practice_h)
dat$baseline_c <- dat$baseline - mean(dat$baseline)
```

## データ表から生成過程へ

各行の得点は、その行の平均 \(\mu_i\) の周りに正規的に揺れるとする。

\[
\begin{aligned}
memory_i &\sim \operatorname{Normal}(\mu_i,\sigma),\\
\mu_i &= \alpha + \beta_p practice\_c_i + \beta_b baseline\_c_i.
\end{aligned}
\]

\(\beta_p\) は、基礎得点を同じにしたときの練習1時間あたりの平均差である。\(\sigma\) は説明変数で説明しても残る個人差・測定差を表す。`family = gaussian()`はこの尤度を明示する。0〜100の境界近くに観測が多いなら、正規モデルの複製値が境界を越えないかを後で確認し、別の生成過程も検討する。

```text
formula: memory ~ practice_c + baseline_c
       ↓
mu_i = Intercept + b_practice × practice_c_i + b_baseline × baseline_c_i
       ↓
memory_i は Normal(mu_i, sigma) から1つ生成された値
       ↓
prior + likelihood → posterior draws → 予測・要約
```

前の回の格子近似は、未知量が増えると格子点が急増します。StanはHamiltonian Monte Carloを使い、事後分布の代表となるdrawを作ります。各chainのwarmup中に計算方法を調整し、その後のdrawを事後分布の近似として使います。複数chainは、異なる出発点から同じ分布を探索できたかを確かめる助けになります。drawは独立な正解の一覧ではないため、個数だけでなくR-hat、ESS、divergenceも確認します。

## Rでfitしてdrawを使う

`brm()`はformula・data・family・priorを受け取り、Stanを用いたベイズ推定を行う。`get_prior()`でpriorを置けるclassを確認してから指定する。`seed`は再現の助けになるが、環境・パッケージ版・データも記録する。

```r
library(brms)

get_prior(memory ~ practice_c + baseline_c, data = dat, family = gaussian())

priors <- c(
  set_prior("normal(70, 15)", class = "Intercept"),
  set_prior("normal(0, 8)", class = "b"),
  set_prior("exponential(1/15)", class = "sigma")
)

fit <- brm(
  memory ~ practice_c + baseline_c,
  data = dat, family = gaussian(), prior = priors,
  chains = 4, iter = 2000, warmup = 1000, seed = 2026
)

summary(fit)
nuts_params(fit)
pp_check(fit, type = "dens_overlay")
```

`summary(fit)`の係数は事後drawの要約であり、単一の「真の係数」そのものではない。推定値を読む前に、chainの混ざり、R-hat、ESSを確認し、`nuts_params()`でdivergenceも確認する。R-hatが1に近いことだけでは十分ではなく、divergenceがあれば幾何やモデル化を再検討する。`pp_check()`は観測データと、事後drawから再生成した得点の形・中心・尾を比べる。適合が良くても因果性は保証しない。

研究質問に近いのは、係数を表で読むことだけではなく、代表的な練習時間における予測である。`posterior_epred()`は平均応答のdraw、`posterior_predict()`は残差の揺れも含む将来の個人得点のdrawを返す。

```r
new_dat <- data.frame(
  practice_c = c(-1, 0, 1),
  baseline_c = 0
)
mean_draws <- posterior_epred(fit, newdata = new_dat)
person_draws <- posterior_predict(fit, newdata = new_dat)

apply(mean_draws, 2, quantile, probs = c(.05, .5, .95))
apply(person_draws, 2, quantile, probs = c(.05, .5, .95))
```

前者は「平均的な人の期待得点」の不確実性、後者は「次の一人の得点」の不確実性であり、通常後者の方が広い。目的に応じて混同しない。ここでの`new_dat`は中心化済みの変数を明示しているので、`baseline_c = 0`は標本平均の基礎得点を意味する。

## 典型的誤解

- **「`brm()`が動けば分析は完了」**：コンパイル・sampling成功は、生成過程の妥当性、HMC診断、予測チェックの証拠ではない。
- **「iterationを増やせばdivergenceも自動的に直る」**：draw数を増やすだけでは、探索しにくい事後分布の形は直らない。尺度、prior、parameterization、モデル自体を点検する。
- **「係数の90%区間が0をまたがなければ因果効果」**：区間はこのモデルの関連の不確実性である。割付けや交絡の仮定はformulaだけでは追加されない。
- **「`posterior_epred()`と`posterior_predict()`は同じ予測」**：前者は平均 \(\mu\)、後者は新しい観測値 \(y\) を含むため、答える問いが異なる。

## 理解問題

### 1. 選択

基礎得点が平均の人について、「練習が1時間増えたときの平均得点差」に最も直接対応するのはどれか。

A. `sigma`  
B. `b_practice_c`  
C. `Intercept`  
D. `Rhat`

**解答：B。** `b_practice_c`は練習時間の平均差を表す。Aは残差規模、Cは両予測子が平均のときの平均得点、Dはsamplingの収束指標である。

### 2. 出力予測

同じ`new_dat`で`posterior_epred()`の90%区間が[68, 76]、`posterior_predict()`の90%区間が[48, 94]だった。なぜ後者が広いか。

**解答：後者は平均 \(\mu\) の不確実性に加え、個人ごとの残差 \(\sigma\) を含む新観測値を再生成するから。** 「MCMCが失敗したから広い」とは限らない。

### 3. 記述

`b_practice_c`の事後中央値が3.2、90%信用区間が[0.8, 5.7]だった。適切な結果文を一文で書きなさい。

**採点基準：** 条件付き（同じ基礎得点）、単位（1時間・得点）、モデルに条件づけた不確実性を含める。例：「この正規回帰モデルでは、基礎得点が同じ参加者で練習時間が1時間長いことに対応する翌日得点差の事後中央値は3.2点、90%信用区間は[0.8, 5.7]点だった。」無条件の因果表現は不可。

### 4. レビュー

論文が「R-hatは1.00なのでモデルは正しい」と結論した。何を追加するよう求めるか。

**解答例：** divergence・ESS・trace plotを含むsampling診断、`pp_check()`などの事後予測チェック、得点の支持範囲と残差構造の確認を求める。R-hatはchainsの混ざりの一指標であり、モデルの真実性や予測妥当性の検査ではない。

### 5. 主張境界

自主的に長く練習した参加者ほど高得点だった。prior・PPC・診断がすべて良好なら、「練習時間を増やす介入は高得点を生む」と書けるか。

**解答：書けない。** 意欲、事前能力、支援環境などが練習と得点の両方に影響し得る。良いベイズ推定・診断は与えた関連モデルの品質を支えるが、因果識別を代替しない。

## 4段階練習

1. **まねる：** データを中心化し、上のformula・priorでfitする。`summary()`、診断、`pp_check()`を順に保存する。
2. **一つ変える：** `baseline_c`をformulaから外し、`b_practice_c`のdrawとPPCを比べる。係数の変化を「因果効果の変化」と呼ばない。
3. **見ずに作る＋デバッグ：** 別の連続応答で、研究質問→応答単位→formula→family→prior→fit→平均予測と個人予測を自力で作る。`newdata`エラーなら、formulaで使った全列があり、中心化の基準が学習時と同じかを確認する。
4. **未見転移：** 得点が正答数20問に変わった場合、`gaussian()`をそのまま使うことの問題と、候補family・予測図を提案する。

## 任意課題

練習時間を0、1、2、3時間（中心化は元の学習データの平均で行う）に固定し、基礎得点を平均と平均+1 SDの二通りにした予測表を作りなさい。平均応答と新しい参加者の予測区間を別々に示し、どちらが意思決定に必要かを、対象（個人への助言か、集団プログラムか）を明記して論じる。

## 一次資料

- [brms `brm()` reference](https://paulbuerkner.com/brms/reference/brm.html)
- [brms `get_prior()` / `default_prior()` reference](https://paulbuerkner.com/brms/reference/default_prior.html)
- [brms posterior prediction methods](https://paulbuerkner.com/brms/reference/posterior_predict.brmsfit.html)
- [Stan User's Guide: posterior predictive checks](https://mc-stan.org/docs/stan-users-guide/posterior-predictive-checks.html)
