# 06 prior predictiveと感度分析――データを見る前と後の両方でpriorを問う

## この回のゴール

応答と予測子の単位に照らしてproperなpriorを指定し、事前予測と代替priorで結論の頑健さを点検・記録できる。

## 前提

事前分布・尤度・事後分布の役割を区別できること。ここでは連続応答の回帰を用いるが、考え方は二値・件数・階層モデルでも同じである。

## 研究場面：睡眠時間と翌日の注意得点

60人について、前夜の睡眠時間 `sleep_h` と翌日の注意得点 `score`（0〜100点）を測った。8時間を基準にした睡眠時間 `sleep_c = sleep_h - 8` を使う。中心化によりinterceptは「8時間睡眠時の平均得点」となる。

| participant | sleep_h | sleep_c | score |
|---|---:|---:|---:|
| P01 | 6.5 | -1.5 | 63 |
| P02 | 8.0 | 0.0 | 72 |
| P03 | 9.0 | 1.0 | 76 |

## データ表から生成過程へ

\[
\begin{aligned}
score_i &\sim \operatorname{Normal}(\mu_i, \sigma),\\
\mu_i &= \alpha + \beta\,sleep\_c_i.
\end{aligned}
\]

ここで \(\alpha\) は8時間睡眠時の平均得点、\(\beta\) は睡眠1時間増加あたりの平均得点差、\(\sigma\) は同じ睡眠時間でも残る個人差・測定差である。0〜100点という支持範囲に厳密に収めるには別の尤度も検討できるが、まず正規尤度が作る複製得点を確認して判断する。

次のpriorは、得点尺度を基準にした説明用の出発点である。

\[
\alpha\sim\operatorname{Normal}(70,15),\quad
\beta\sim\operatorname{Normal}(0,5),\quad
\sigma\sim\operatorname{Exponential}(1/15).
\]

これは「睡眠の効果は絶対に小さい」ではない。例えば \(\beta=20\) は睡眠1時間で20点差を意味するため、強い根拠なしには中心から離れた値として扱う、という尺度上の宣言である。`Exponential(1/15)` は正の \(\sigma\) にpriorを置く（Rの`rexp()`はrate、平均は`1/rate`）。

```text
priorから (alpha, beta, sigma) を1組描く
          ↓
各睡眠時間で mu = alpha + beta × sleep_c を計算
          ↓
Normal(mu, sigma) から仮想のscoreを描く
          ↓
現実にあり得る得点・傾き・散らばりかを研究者が判定する
```

## Rで事前予測を描く

このコードは推定前なので、`score`列を使わない。`sample_prior = "only"` は尤度を無視してproper priorからdrawを取り、事前予測を可能にする。すべての必要なpriorがproperでなければならない。

```r
library(brms)

dat <- data.frame(sleep_h = c(6.5, 8, 9, 7, 8.5),
                  score = c(63, 72, 76, 66, 74))
dat$sleep_c <- dat$sleep_h - 8

priors <- c(
  set_prior("normal(70, 15)", class = "Intercept"),
  set_prior("normal(0, 5)", class = "b"),
  set_prior("exponential(1/15)", class = "sigma")
)

prior_fit <- brm(
  score ~ sleep_c, data = dat, family = gaussian(), prior = priors,
  sample_prior = "only", chains = 4, iter = 1000, seed = 123
)
pp_check(prior_fit, type = "dens_overlay")
```

`pp_check()`は通常は事後予測チェックだが、`sample_prior = "only"` のfitではpriorからの複製データを比較する図として働く。図に負の得点や150点が頻繁に出るなら、prior、正規尤度、あるいは得点尺度の扱いを見直す。元データが少ないのは意図的であり、事前予測の段階では観測値に合わせ込まない。

続いて、もっと広いが依然properな代替priorでfitし、主要な事後量を比べる。

```r
wide_priors <- c(
  set_prior("normal(70, 30)", class = "Intercept"),
  set_prior("normal(0, 10)", class = "b"),
  set_prior("exponential(1/30)", class = "sigma")
)

fit_a <- update(prior_fit, sample_prior = "no", prior = priors)
fit_b <- update(prior_fit, sample_prior = "no", prior = wide_priors)
posterior_summary(fit_a, pars = "b_sleep_c")
posterior_summary(fit_b, pars = "b_sleep_c")
```

この比較で近い結論なら「この範囲の合理的なprior変更には頑健」と報告できる。異なるなら失敗ではなく、データだけでは傾きを十分に識別できない、またはpriorの実質的な意味をもっと検討すべきという発見である。`get_prior(score ~ sleep_c, data = dat)`で、どのparameter classにpriorを置けるかを先に確認する。

## 典型的誤解

- **「広いpriorは無情報だから常に安全」**：尺度から見て非現実的な予測を大量に許したり、計算を不安定にしたりする。広さと中立性は同義でない。
- **「事前予測が観測データに似なければ悪い」**：事前予測はデータをまだ見ない段階の検査である。観測値へ合わせるためにpriorを調整すると二重使用になる。
- **「感度分析は結論が同じときだけ示す」**：異なった結果こそ、結論が仮定に依存するという重要な情報である。

## 理解問題

### 1. 選択

得点が0〜100点で、睡眠時間は通常4〜12時間である。`normal(0, 50)`を \(\beta\) のpriorに置く前に最もよい行動はどれか。

A. とにかくfitしてR-hatだけを見る  
B. `beta`の単位を確認し、prior predictiveで得点と傾きを描く  
C. `beta`を必ず0に固定する  
D. 標本平均をprior平均にする

**解答：B。** 50は「1時間あたり50点」の尺度であり、許容する含意を確認する必要がある。Aはデータ後の計算診断だけで、CとDは研究上の根拠なしに情報を固定・再利用している。

### 2. 出力予測

`set_prior("normal(0, 5)", class = "b")` を `normal(0, 1)` に変えると、事前予測の回帰線はどう変わるか。

**解答：睡眠時間に対する線の傾きは0付近へより強く集中し、極端な傾きが減る。** interceptや`sigma`が同じなら、8時間付近の水準や残差の揺れを直接変える設定ではない。「得点が必ず70になる」は誤り。

### 3. 記述

prior predictiveで120点の複製得点が少数、−20点が多数出た。次に調べることを二つ書きなさい。

**採点基準：** priorの尺度、尤度が支持範囲を無視していること、データ変換・別familyの候補を具体的に二つ挙げれば可。例：interceptと`sigma`のpriorを分けて図示する／得点が上下限に張り付くなら順序・二項・切断の生成過程を検討する。観測値を消すだけでは不可。

### 4. レビュー

論文は「default priorを使ったのでpriorの影響はない」と記した。短い査読コメントを書きなさい。

**解答例：** 「defaultはモデルとデータ尺度に応じて確認すべき設定です。`get_prior()`の出力、proper priorの根拠、事前予測、および少なくとも一つの合理的な代替priorによる主要な事後量の比較を示してください。」defaultが存在することは、影響がゼロである証拠ではない。

### 5. 主張境界

代替priorでも \(P(\beta>0\mid y)=0.97\) だった。ここから「睡眠を1時間増やす介入は得点を改善する」と結論してよいか。

**解答：そのままでは不可。** これは観測された睡眠と得点の条件付き関連に関する事後確率である。介入効果には交絡、逆因果、測定、対象集団についての設計・仮定が別途必要である。

## 4段階練習

1. **まねる：** 上の`prior_fit`をfitし、`pp_check()`で複製得点の範囲を読み、0〜100外の値の有無を記録する。
2. **一つ変える：** `b`のpriorだけを`normal(0, 2)`と`normal(0, 10)`に替え、事前予測の線の広がりを比較する。
3. **見ずに作る＋デバッグ：** 別の連続尺度と予測子を選び、中心化、`get_prior()`、properな3種類のprior、`sample_prior = "only"`を自力で書く。エラーが出たら、まずparameter class名とproper priorが全parameterにあるかを確認する。
4. **未見転移：** 0〜10のLikert尺度を正規尤度で分析する案について、prior predictiveで何を見て、どの代替生成過程を候補にするかを設計する。

## 任意課題

睡眠時間が4〜12時間の格子に対し、priorから100本の平均線 \(\alpha+\beta x\) を描きなさい。次に得点が0〜100へ収まる確率をprior predictive drawごとに計算し、「現実的」の判定基準を研究領域の知識とともに文章化する。境界を守ることだけを目的に都合よくpriorを狭めないこと。

## 一次資料

- [brms `brm()` reference（`sample_prior`）](https://paulbuerkner.com/brms/reference/brm.html)
- [brms `set_prior()` reference](https://paulbuerkner.com/brms/reference/set_prior.html)
- [brms `pp_check()` reference](https://paulbuerkner.com/brms/reference/pp_check.brmsfit.html)
- [Stan User's Guide: prior predictive checks](https://mc-stan.org/docs/stan-users-guide/prior-predictive-checks.html)
