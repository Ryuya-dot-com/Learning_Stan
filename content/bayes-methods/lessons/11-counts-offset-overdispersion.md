# 11 件数・offset・過分散

## この回のゴール

観測時間や試行数が異なる件数データについて、offsetと過分散の要否を観測過程から判断できる。

## 前提

log link、二値応答、PPCの基礎。

## 研究場面

参加者ごとに自由行動中の注意逸脱を数えたが、観察時間は10〜60分と異なる。

## 解説

件数`lapses_i`は非負整数です。Poissonでは平均と分散がともに`lambda_i`です。観察時間`observation_minutes_i`が異なるなら、件数でなく時間当たりの率を比較するため既知の曝露量をoffsetにします。

\[
y_i\sim\mathrm{Poisson}(\lambda_i),\qquad
\log\lambda_i=\alpha+\beta c_i+\log(\mathrm{minutes}_i)
\]

```r
library(brms)

rate_priors <- c(
  prior(normal(log(0.1), 1), class = "Intercept"),
  prior(normal(0, 1), class = "b")
)
nb_priors <- c(rate_priors, prior(exponential(1), class = "shape"))

fit_pois <- brm(lapses ~ condition + offset(log(observation_minutes)),
  data = counts, family = poisson(), prior = rate_priors, seed = 2026)
fit_nb <- brm(lapses ~ condition + offset(log(observation_minutes)),
  data = counts, family = negbinomial(), prior = nb_priors, seed = 2026)
pp_check(fit_pois, type = "stat", stat = "sd")
pp_check(fit_nb, type = "stat", stat = "sd")
```

offsetの係数は推定しません。曝露量を二倍にすれば、同じ率なら期待件数も二倍です。PoissonのPPCで分散や零の数を再現できないなら、負の二項、ゼロ過剰、参加者差、未モデル化の構造を候補として検討します。過分散は「負の二項を必ず使う」合図ではありません。

## 典型的誤解

- 観察時間が違っても件数をそのまま比べればよい。
- offsetは通常の予測子なので係数を推定する。
- 分散が大きければ直ちにzero-inflatedモデルを使う。

## 理解問題

1. **選択**：10分で2回と40分で4回の注意逸脱を同率と呼べるか。A. はい B. いいえ。  
   **解答：B。** 率は1分当たり0.20回と0.10回である。
2. **出力予測**：offset以外が同じで曝露量が二倍なら、Poissonの期待件数はどうなるか。  
   **解答：二倍。** log offsetが期待値の倍率を表す。
3. **記述**：PPCで件数の標準偏差を見る理由を書く。  
   **rubric：Poissonが平均=分散を仮定し、過分散の検出に役立つと述べる。**
4. **レビュー**：`lapses / observation_minutes`を正規モデルへ渡すだけの弱点を一つ述べる。  
   **解答：分母による精度差と非負離散の観測過程を失いやすい。**
5. **主張境界**：負の二項のLOOがPoissonより良いとき、「参加者が二種類いる」と結論できるか。  
   **解答：できない。** 予測差の原因は特定しない。

## 4段階練習

1. **まねる**：曝露量を指定した予測件数を描く前に、比較する率を言葉で書く。
2. **一つ変える**：Poissonからnegative binomialへ一つだけ替え、残したoffsetと予測課題を記録する。
3. **見ずに作る＋デバッグ**：`observation_minutes=0`または負値を検査し、`log()`前に停止させる。
4. **未見転移**：参加時間が異なる行動観察で、時間offsetの妥当性と「時間当たり一定率」という仮定をレビューする。

## 歯応えある任意課題

零件数の割合、平均、分散を三つのPPC統計量として比較し、候補モデルを増やす前に必要な観測上の問いを列挙する。

## 一次資料

- [brms: Count data families](https://paulbuerkner.com/brms/reference/brmsfamily.html)
- [Stan Functions Reference: Poisson distributions](https://mc-stan.org/docs/functions-reference/poisson.html)
