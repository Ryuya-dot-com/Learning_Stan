# 15 予測単位・parameter recovery・SBC

## この回のゴール

予測したい対象からholdout単位を決め、単発の真値回収とsimulation-based calibration（SBC）の役割を区別できる。

## 前提

階層モデル、PPC、PSIS-LOO、Rでのシミュレーション。

## 研究場面

同一参加者から多数試行を得た。次に予測したいのは「既存参加者の次試行」か「新参加者の成績」かを決める必要がある。また、手書きStan実装を公開前に検査したい。

## 解説

予測単位は行数でなく、将来何を知らない状態にするかで決めます。既存参加者の次試行なら、その人の他試行を学習に残すことがあり得ます。新参加者を予測するなら、participant全体をholdoutにする必要があります。前者の良い成績を後者へ一般化しません。

parameter recoveryでは、既知の値で一つか数個のデータを生成してfitし、実装の明白な誤りを探します。しかし真値が一回95%区間に入っただけでは校正の証拠になりません。SBCは次を多数回繰り返します。

\[
\theta^{sim}\sim p(\theta),\quad y^{sim}\sim p(y\mid\theta^{sim}),\quad
\theta^{(m)}\sim p(\theta\mid y^{sim})
\]

各回で真の`theta_sim`が事後draw中の何位かを数えます。モデル・実装・サンプラーが整合するならrankは一様です。

```r
# 擬似コード：1回のrecovery
library(brms)

set.seed(2026)
theta_true <- rnorm(1, 0, 1)
sigma_true <- rexp(1, rate = 1)
y <- rnorm(30, theta_true, sigma_true)
priors <- c(
  prior(normal(0, 1), class = "Intercept"),
  prior(exponential(1), class = "sigma")
)
fit <- brm(y ~ 1, prior = priors, seed = 2026)
draws <- posterior::as_draws_df(fit)$b_Intercept
rank <- sum(draws < theta_true)
```

SBCは現実データにおける尤度の妥当性を保証しません。PPCは観測データの重要な特徴を再現するか、SBCは生成した世界で実装・推論が校正されるかを調べます。

## 典型的誤解

- 参加者内の一行LOOは新参加者予測を評価している。
- 真値回収が一回成功すればモデルは検証済み。
- SBCが一様なら現実の観測過程も正しい。

## 理解問題

1. **選択**：新参加者を予測する評価で外すべき単位はどれか。A. 1試行 B. participant全体 C. 係数1個。  
   **解答：B。** 同じ人の他試行を学習側に残さない。
2. **出力予測**：rank histogramが両端に多いとき、何を疑うか。  
   **解答：事後分布が真値を十分覆っていない、または実装・サンプラー上の問題。** 単一原因は断定しない。
3. **記述**：PPCとSBCが答える問いを一つずつ書く。  
   **rubric：PPC=観測データ特徴の再現、SBC=モデルから生成した反復世界での校正を区別する。**
4. **レビュー**：SBCでデータ生成にStudent-t、fitにnormalを使うときの問題は何か。  
   **解答：生成モデルと推論モデルが一致せず、校正失敗の原因になり得る。** 意図的な誤指定検査なら明記する。
5. **主張境界**：「SBCが良好だから、実験の条件操作は因果的に有効」は妥当か。  
   **解答：不適切。** SBCは計算・実装の校正で、実験設計の因果仮定を検査しない。

## 4段階練習

1. **まねる**：二つの予測課題を文章で書き、各々に残せる学習情報を列挙する。
2. **一つ変える**：recoveryの真の切片だけを変更し、事前とデータ生成を整合させたまま再fitする。
3. **見ずに作る＋デバッグ**：simulate→fit→draw抽出→rankの最小ループを書き、draw列名の誤りを修正する。
4. **未見転移**：participant×itemデータで、新item予測、新participant予測、既存参加者次試行の三課題にholdout単位を割り当てる。

## 歯応えある任意課題

小さな階層正規モデルでSBCを複数回実行し、全体平均・群尺度・一人の群効果のrankを別々に可視化する。ESS不足とrankの見かけの偏りも点検する。

## 一次資料

- [Stan User’s Guide: Held-Out Evaluation and Cross-Validation](https://mc-stan.org/docs/stan-users-guide/cross-validation.html)
- [Stan User’s Guide: Simulation-Based Calibration](https://mc-stan.org/docs/stan-users-guide/simulation-based-calibration.html)
- Talts et al., [Validating Bayesian Inference Algorithms with Simulation-Based Calibration](https://doi.org/10.48550/arXiv.1804.06788)
