# 10 二値・順序応答をモデル化する

## この回のゴール

0/1の正答と順序尺度を、それぞれの支持範囲に合う尤度と応答尺度の予測で報告できる。

## 前提

線形予測子、因子、部分プーリングの基礎。

## 研究場面

認知課題の各試行には正答/誤答があり、別調査には1〜5の疲労評定がある。

## 解説

正答`correct`は0か1であり、確率`p`を介して生成します。`bernoulli_logit`は線形予測子を安定に確率へ写します。

\[
 y_i\sim\mathrm{Bernoulli}(p_i),\quad \mathrm{logit}(p_i)=\alpha+\beta c_i+a_{j[i]}
\]

```r
library(brms)

accuracy_priors <- c(
  prior(normal(0, 1.5), class = "Intercept"),
  prior(normal(0, 1), class = "b"),
  prior(exponential(1), class = "sd")
)
rating_priors <- c(
  prior(normal(0, 2), class = "Intercept"),
  prior(normal(0, 1), class = "b"),
  prior(exponential(1), class = "sd")
)
fit_acc <- brm(correct ~ condition + (1 | participant),
  data = trials, family = bernoulli(link = "logit"),
  prior = accuracy_priors, seed = 2026)
fit_rate <- brm(rating ~ condition + (1 | participant),
  data = ratings, family = cumulative(link = "logit"),
  prior = rating_priors, seed = 2026)
conditional_effects(fit_acc)
conditional_effects(fit_rate, categorical = TRUE)
```

順序尺度では5が4より高いという順序は使えますが、隣接カテゴリの間隔が等しいとは仮定しません。`cumulative()`は閾値と線形予測子から各カテゴリ確率を作ります。logit係数を確率差と読まず、条件ごとの予測確率・カテゴリ確率へ戻します。

## 典型的誤解

- logit係数0.4は、確率が常に40%上がる意味である。
- 5件法は数値なので必ず正規回帰にすべきである。
- 二値データを参加者平均にすれば試行モデルと同じである。

## 理解問題

1. **選択**：`correct`のdata制約として適切なのはどれか。A. real B. int 0〜1 C. int 1〜5。  
   **解答：B。** Bernoulli観測の支持範囲である。
2. **出力予測**：同じlogit係数でも基準確率が異なる二群で確率差は同じか。  
   **解答：一般に同じでない。** inverse-logitは非線形である。
3. **記述**：順序モデルが「間隔等しい」を要求しない理由を書く。  
   **rubric：カテゴリ閾値を推定し、数値ラベルの差を連続量の差として扱わないと述べる。**
4. **レビュー**：Stanで`y ~ normal(mu, sigma)`に0/1正答を渡す問題を一つ述べる。  
   **解答：支持範囲と分散構造が二値観測に合わない。** コンパイル成功は妥当性の証拠でない。
5. **主張境界**：予測正答確率が高い条件を「学習効果がある」と呼べるか。  
   **解答：設計・estimandの根拠が必要。** 予測確率だけでは因果を示さない。

## 4段階練習

1. **まねる**：二条件の`conditional_effects()`を確率尺度で描く前に、どの出力を読むか予測する。
2. **一つ変える**：participant切片だけを追加し、対象となる反復構造を説明する。
3. **見ずに作る＋デバッグ**：0/1以外の値を含む`correct`を検査し、削除ではなく発生原因を記録する。
4. **未見転移**：5件法を用いる調査について、カテゴリ確率で答える研究質問を一つ設計する。

## 歯応えある任意課題

条件別の予測カテゴリ確率を積み上げ図にし、平均評定だけでは異なる二分布を作る。

## 一次資料

- [brms: brm families](https://paulbuerkner.com/brms/reference/brmsfamily.html)
- [Stan User’s Guide: Logistic and Ordered Logistic Regression](https://mc-stan.org/docs/stan-users-guide/regression.html)
