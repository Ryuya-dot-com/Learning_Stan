# 09 反復測定と部分プーリング

## この回のゴール

参加者内試行の階層構造を式・brms式・予測課題へ対応付け、部分プーリングが必要な理由を説明できる。

## 前提

因子を含む回帰、事後draw、participant ID列を使えること。

## 研究場面

各参加者が一致・不一致条件を20試行ずつ行った。条件効果は参加者ごとに異なる可能性がある。

## 解説

1行は一試行でも、同じ参加者の試行は交換可能ではありません。参加者jの切片と条件効果を全体分布から生成し、その人の試行を生成します。

\[
 y_{ij}\sim\mathrm{normal}(\alpha+a_j+(\beta+b_j)c_{ij},\sigma),\quad
 (a_j,b_j)\sim\mathrm{multi\_normal}(0,\Sigma)
\]

```r
library(brms)

priors <- c(
  prior(normal(600, 150), class = "Intercept"),
  prior(normal(0, 100), class = "b"),
  prior(exponential(1 / 100), class = "sigma"),
  prior(exponential(1 / 100), class = "sd"),
  prior(lkj(2), class = "cor")
)
fit <- brm(
  rt_ms ~ condition + (1 + condition | participant),
  data = trials, family = gaussian(), prior = priors,
  seed = 2026, chains = 4
)
ranef(fit)$participant
conditional_effects(fit, effects = "condition")
pp_check(fit, type = "stat_grouped", group = "participant", stat = "mean")
```

`(1 + condition | participant)`は、参加者ごとの基準値と条件効果を許し、それらを母集団分布へ部分プーリングします。`ranef()`では参加者ごとの全体効果からのずれ、`conditional_effects()`では母集団全体の条件差を確認できます。少数試行の人ほど全体情報を強く借ります。これは全員を同じにすることではありません。既存参加者の次試行の予測と、未参加者の試行の予測では使える情報が異なります。

## 典型的誤解

- random interceptを入れれば、順序効果や刺激差も自動で解決する。
- 部分プーリングは個人差を消す処理である。
- non-centered parameterizationは研究上のモデルを変える。

## 理解問題

1. **選択**：参加者jの条件効果を表すのはどれか。A. 全体`b_condition`だけ B. `b_condition + b_j` C. 残差`σ`。  
   **解答：B。** 全体効果に参加者偏差を足す。
2. **出力予測**：1試行しかない参加者の推定は、no-poolingよりどちらへ近づきやすいか。  
   **解答：全体分布。** 情報量が少ないため。ただし値が同一になるとは限らない。
3. **記述**：新参加者予測で既存参加者の偏差drawを使えない理由を書く。  
   **rubric：新参加者のID効果は未観測で、群分布から新たに生成する必要を述べる。**
4. **レビュー**：`rt_ms ~ condition + (1 | participant)`で個人別の条件差を結論してよいか。  
   **解答：原則不可。** varying slopeがないため、条件効果は全員共通と仮定している。
5. **主張境界**：条件差の事後分布があることから「条件が因果的に差を作る」と言えるか。  
   **解答：設計次第。** モデルだけでは無作為化・交絡の仮定を満たさない。

## 4段階練習

1. **まねる**：participantごとの平均PPCを描き、全体PPCだけでは隠れる失敗を予測する。
2. **一つ変える**：`(1|participant)`を`(1+condition|participant)`へ替え、増えたparameterと研究上の仮定を書く。
3. **見ずに作る＋デバッグ**：参加者IDをnumeric連番へ変換したデータ契約を作る。ID数とindex範囲が合わない不具合を修正する。
4. **未見転移**：participantとitemが交差する課題で、二つの群構造と予測対象をモデルカードに書く。

## 歯応えある任意課題

pooling、参加者別、階層モデルの予測を同じ図に重ね、どの参加者で縮小が大きいかを試行数と結び付けて説明する。

## 一次資料

- [brms: Group-level effects](https://paulbuerkner.com/brms/reference/brmsformula.html)
- [Stan User’s Guide: Hierarchical Regression](https://mc-stan.org/docs/stan-users-guide/regression.html)
