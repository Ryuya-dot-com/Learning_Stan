# 05 ベイズ更新と事後分布――事前の見通しをデータで更新する

## この回のゴール

同じ未知の平均について、事前分布・尤度・事後分布を図で対応させ、事後分布に基づく限定付きの結論を書ける。

## 前提

平均、標準偏差、正規分布の山の位置と広がりを知っていること。このレッスンでは、正規分布は「あり得る値とその相対的なもっともらしさ」を表す道具として使う。頻度論の信頼区間を信用区間と同じ意味で使わない。

## 研究場面：短い休憩は注意課題の成績を変えるか

24人が、休憩なし条件と10分休憩条件を行った。分析単位を参加者ごとの**差**（休憩あり−なし、正なら休憩ありが高得点）にする。ここで知りたい量を母平均 \(\mu\)、参加者間の散らばりを \(\sigma\) とする。

| participant | score_no_break | score_break | diff |
|---|---:|---:|---:|
| P01 | 72 | 75 | 3 |
| P02 | 80 | 79 | -1 |
| P03 | 68 | 73 | 5 |
| … | … | … | … |

この表では、行は参加者であり、`diff` がモデルの応答である。試行を独立な24×試行回として数え直してはいけない。

## データ表から生成過程へ

一人ひとりの差を、母平均の周りで揺れる値と仮定する。

\[
y_i \sim \operatorname{Normal}(\mu,\sigma), \qquad i=1,\ldots,24
\]

これは「全員がちょうど同じだけ改善する」ではなく、個人差を \(\sigma\) で表す生成過程である。ここでは説明を見通しよくするため \(\sigma=4\) 点と既知と仮定する。本来は通常、\(\sigma\) も推定する。

データを見る前には、過去の似た課題を踏まえ、平均効果は0点付近で、±8点程度は十分あり得ると考えたとする。

\[
\mu \sim \operatorname{Normal}(0,4)
\]

この事前分布と、観測したデータが各 \(\mu\) でどれほど整合的かを表す尤度を掛け、全体を確率分布になるよう割り直したものが事後分布である。

\[
p(\mu\mid y) = \frac{p(y\mid\mu)p(\mu)}{p(y)}
\]

分母 \(p(y)\) は \(\mu\) についての全体の正規化定数である。更新は、priorを「足す」ことでも、データを「無視する」ことでもない。尤度とpriorの両方で支持される \(\mu\) に相対的な重みが集まる。

```text
データ前                 データが支持する範囲              データ後
prior p(mu)       ×       likelihood p(y | mu)     →       posterior p(mu | y)
   0点を中心                    標本平均を中心                   両者を反映
```

## Rで格子近似して見る

次のコードは、候補となる \(\mu\) を細かく並べ、各候補のpriorと尤度を計算する。`dnorm(..., log = TRUE)`で対数尤度を足し、最大値を引いてから指数に戻すと、極小値の丸め落ちを避けやすい。

```r
diff <- c(3, -1, 5, 2, 4, 0, 1, 6, 2, 3, -2, 4,
          1, 5, 0, 2, 3, 1, 4, -1, 2, 5, 0, 3)
mu_grid <- seq(-8, 8, length.out = 2001)

prior <- dnorm(mu_grid, mean = 0, sd = 4)
log_lik <- sapply(mu_grid, function(mu) sum(dnorm(diff, mu, 4, log = TRUE)))
lik_scaled <- exp(log_lik - max(log_lik))
posterior_unnormalized <- prior * lik_scaled
grid_width <- mu_grid[2] - mu_grid[1]
posterior_density <- posterior_unnormalized /
  sum(posterior_unnormalized * grid_width)
posterior_weight <- posterior_density * grid_width

plot(mu_grid, prior, type = "l", ylim = c(0, max(prior, posterior_density)),
     ylab = "密度", xlab = expression(mu))
lines(mu_grid, posterior_density, col = "firebrick", lwd = 2)
legend("topright", c("prior", "posterior"), col = c("black", "firebrick"), lty = 1)
weighted.mean(mu_grid, posterior_weight)

posterior_draws <- sample(
  mu_grid,
  size = 100000,
  replace = TRUE,
  prob = posterior_weight
)
quantile(posterior_draws, c(.05, .95))
```

最後の二行は概念説明用の細かい格子近似である。この例では事後90%区間はおよそ `[0.8, 3.4]` 点になる。「このモデル、prior、データに条件づけると、母平均差 \(\mu\) の事後確率の90%がこの範囲にある」と読める。これは、反復した実験で区間が90%の確率で真値を含む、という信頼区間の説明とは別である。

## 典型的誤解

- **「事後90%区間は効果が90%の確率で存在する」**：区間は \(\mu\) の範囲であり、「効果が存在する」は別の主張である。たとえば実用上意味のある差を事前に2点と定めたなら、\(P(\mu>2\mid y)\) をdrawで計算する。
- **「priorは主観だから不正確」**：尤度だけでも、分布・独立性・欠測などの仮定を置く。priorは隠さず、尺度と根拠を示し、現実的な代替priorで感度を確認する。
- **「統計的に有意でなければ \(\mu=0\)」**：このモデルでは \(\mu\) は連続量であり、ちょうど0に確率を置くには、0に点質量を置く別のモデルが必要である。

## 理解問題

### 1. 選択

`diff`の標本平均が2.1点、priorが \(\operatorname{Normal}(0,4)\) である。データのばらつきが小さく参加者数も多いとき、事後平均として最も妥当なのはどれか。

A. 必ず0点  
B. 必ず2.1点  
C. 通常は0点と2.1点の間だが、2.1点により近い  
D. 必ず4点

**解答：C。** 尤度が鋭いほどデータの重みが大きい。AとDはpriorの平均や標準偏差を事後平均と取り違え、Bはpriorを無視している。

### 2. 出力予測

`prior <- dnorm(mu_grid, 0, 4)` を `dnorm(mu_grid, 3, 1)` に替え、同じデータで更新する。事後分布はどちらへ変わるか。

**解答：全体として右（3点側）へ、かつより狭いpriorの影響を受ける。** ただし尤度が非常に鋭ければ変化は小さい。「必ず3点になる」は誤りで、データとの組合せで決まる。

### 3. 記述

上の例について、「休憩あり−なしの平均差は2.1点だった」とだけ書く代わりに、事後分布の不確実性を含む一文を書きなさい。

**採点基準：** \(\mu\) が何の平均か、モデル・データに条件づけた表現、区間または確率を含めば可。例：「参加者内差を正規分布で表したこのモデルでは、休憩あり−なしの母平均差の事後中央値は約2.1点で、90%信用区間は約[0.8, 3.4]点だった。」因果的な「休憩が改善させた」は、割付け設計なしには不可。

### 4. レビュー

研究者が、測定尺度が0〜20点なのに \(\mu\sim\operatorname{Normal}(0,100)\) を「無情報prior」と呼んだ。レビューコメントを一つ書きなさい。

**解答例：** 「0〜20点の尺度で100点規模の差を強く許す根拠と、そこから生じる事前予測を示してください。広いことは中立性ではなく、非現実的な複製データを許す可能性があります。」単に「主観的だから削除」は誤りである。

### 5. 主張境界

観察研究で、休憩を自分で選んだ人ほど事後的に高得点だった。この結果から「休憩を強制すれば全員の得点が上がる」と言えるか。

**解答：言えない。** ベイズ更新は与えた観測モデル内の不確実性を表すが、自己選択、疲労、課題難易度などの交絡を消さない。言えるのは条件付きの関連までであり、因果主張には割付けや交絡への仮定・設計が必要である。

## 4段階練習

1. **まねる：** コードを実行し、priorとposteriorを同じ図に描く。標本平均と事後平均の違いを数値で確認する。
2. **一つ変える：** priorの標準偏差を1、4、10に替え、事後の中心と広がりを表にする。なぜ変わるかを尺度で説明する。
3. **見ずに作る＋デバッグ：** 別の12個の差データを作り、格子・対数尤度・正規化を自力で書く。`sum(posterior_weight)`が1でない、または`NaN`なら、正規化前の値と`max(log_lik)`を確認する。
4. **未見転移：** 参加者ごとの「正答数/20」に対し、平均差の正規モデルがどこで不自然かを列挙し、二項モデルを候補にする理由を述べる。

## 任意課題

\(\sigma\) も未知として \(\sigma\sim\operatorname{Exponential}(1/4)\) を置き、\(\mu,\sigma\) の二次元格子で事後を近似しなさい。\(\sigma\) を4に固定した結論と、事後90%区間がどう違うかを説明する。格子の範囲を広げても結論が大きく変わらないことも点検する。

## 一次資料

- [Stan User's Guide: Bayesian inference](https://mc-stan.org/docs/stan-users-guide/bayesian-inference.html)
- [Stan Reference Manual: probability functions and log density](https://mc-stan.org/docs/reference-manual/statements.html)
- [R `dnorm` documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Normal.html)
