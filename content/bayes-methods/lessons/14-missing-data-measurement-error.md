# 14 欠測・測定誤差を観測過程として扱う

## この回のゴール

欠測と測定誤差を「埋める作業」でなく観測過程として記述し、主張に必要な仮定と感度分析を区別できる。

## 前提

データ品質検査、回帰、事前分布、生成過程。

## 研究場面

疲労の高い参加者ほど反応時間課題を中断しやすく、自己報告の睡眠時間には測定誤差があるかもしれない。

## 解説

`NA`を平均で置くと、なぜ欠けたか・置換値の不確実性・分析対象が隠れます。まず、どの変数の何件が、どの時点・条件・参加者で欠けたかを表にします。Stanではknownな観測をdata block、未知の量をparameters blockに分けます。標準化済みの連続応答をモデル化する一例は次です。

\[
y_{obs}\sim\mathrm{normal}(\mu,\sigma),\qquad y_{mis}\sim\mathrm{normal}(\mu,\sigma)
\]

```stan
data {
  int<lower=0> N_obs;
  int<lower=0> N_mis;
  array[N_obs] real y_obs;
}
parameters {
  real mu;
  real<lower=0> sigma;
  array[N_mis] real y_mis;
}
model {
  mu ~ normal(0, 1);
  sigma ~ exponential(1);
  y_obs ~ normal(mu, sigma);
  y_mis ~ normal(mu, sigma);
}
```

この最小例は、欠測が観測済み値と同じモデルから来るという仮定を含みます。条件や疲労による中断が疑われるなら、その仮定を説明・変更し、結果の感度を示します。測定誤差では、測った`x_meas`と未知の真値`x_true`を別にし、`x_meas ~ normal(x_true, tau)`のような測定モデルを足します。`tau`を既知と呼ぶ根拠も必要です。

## 典型的誤解

- complete-case分析は、欠測を削るだけなので仮定を置かない。
- Stanが欠測値をparameterにすれば、欠測機構を考えなくてよい。
- 信頼性が低いなら予測子を標準化すれば測定誤差が直る。

## 理解問題

1. **選択**：Stanで未知の欠測値を置くblockはどれか。A. data B. parameters C. generated quantities。  
   **解答：B。** dataは既知、parametersは推定する未知量である。
2. **出力予測**：欠測値を平均で一度だけ置換し、通常回帰をfitすると何が失われやすいか。  
   **解答：置換値の不確実性。** 欠測の理由も解決しない。
3. **記述**：条件ごとに欠測率を報告する意義を書く。  
   **rubric：条件と欠測が関連するならcomplete-caseの比較対象や主張範囲が変わり得ると述べる。**
4. **レビュー**：`x_meas`を真値として回帰するだけの測定誤差上の問題を述べる。  
   **解答：観測値の誤差を無視し、傾き等の推定が歪み得る。**
5. **主張境界**：欠測モデルをfitしたので「欠測バイアスを除去した」と言えるか。  
   **解答：言えない。** 指定した欠測・測定モデルの仮定の下での推論である。

## 4段階練習

1. **まねる**：欠測率を変数・条件・participant別に表にし、平均補完を行わない。
2. **一つ変える**：観測済み応答だけのモデルに、欠測応答parameterを一つ追加する。
3. **見ずに作る＋デバッグ**：observed indexとmissing indexが重複するデータ契約違反を検出する。
4. **未見転移**：中断が疲労と関連し得る課題で、primary分析、代替仮定、限界の三つを書く。

## 歯応えある任意課題

測定誤差尺度`tau`の二つの妥当な値で感度分析を行い、真値の分布に置いたpriorも含めて何が変わったかを比較する。

## 一次資料

- [Stan User’s Guide: Missing Data and Partially Known Parameters](https://mc-stan.org/docs/stan-users-guide/missing-data.html)
- [Stan User’s Guide: Measurement Error and Meta-Analysis](https://mc-stan.org/docs/stan-users-guide/measurement-error.html)
