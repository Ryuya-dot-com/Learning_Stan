# 08 brmsで診断・PPC・予測比較

## この回のゴール

自分でfitしたモデルについて、計算診断、事後予測チェック、予測比較がそれぞれ答える問いを分け、根拠の範囲を限定して報告できる。

## 前提

正規・二値回帰、事後draw、`brm()`の基本的な実行、Rのdata frameを使えること。

## 研究場面

80人が色語課題を行い、一人につき正答試行の平均反応時間を一つ記録した。候補は「実験条件だけ」と「実験条件と標準化した課題前の基礎得点」の二つである。

## 解説

まず観測過程を決めます。ここでは各行が一人、`mean_rt_ms`が観測値、`condition`と標準化した`baseline_z`が既知の説明変数です。正規モデルを最初の候補にすると、各人の平均反応時間は説明変数から作る平均のまわりにばらつく、と表します。

\[
y_n \sim \mathrm{normal}(\alpha+\beta_c c_n+\beta_b b_n,\sigma)
\]

```r
library(brms)
priors <- c(
  prior(normal(600, 150), class = "Intercept"),
  prior(normal(0, 100), class = "b"),
  prior(exponential(1 / 100), class = "sigma")
)
fit_c <- brm(mean_rt_ms ~ condition, data = people,
             family = gaussian(), prior = priors, seed = 2026, chains = 4)
fit_cb <- brm(mean_rt_ms ~ condition + baseline_z, data = people,
              family = gaussian(), prior = priors, seed = 2026, chains = 4)
summary(fit_cb)
nuts_params(fit_cb)
pp_check(fit_cb, type = "stat_grouped", group = "condition", stat = "median")
loo_c <- loo(fit_c)
loo_cb <- loo(fit_cb)
loo_compare(loo_c, loo_cb)
```

`summary()`のR-hatとESS、`nuts_params()`のdivergenceは「指定した事後分布を計算できたか」を見る入口です。`pp_check()`は「そのモデルが、条件別中央値や尾部など重要な特徴を再現するか」を見る検査です。`loo()`は、同じ予測課題・同じ観測単位の候補間での相対的な予測性能です。どれも、因果効果やモデルの真実を保証しません。LOOの結果ではPareto kも確認します。

## 典型的誤解

- R-hatが良ければ尤度や除外規則も正しい。
- PPCが見た目で似ていれば、何を再現したかを決めなくてよい。
- LOOで一位なら、そのモデルが真であり因果主張もできる。

## 理解問題

1. **選択**：divergenceがあるrunで最初に避けるべき行為はどれか。A. 推定値を結論に使う B. どのparameter付近で起きたか調べる C. モデル尺度を確認する。  
   **解答：A。** divergenceは探索が不十分な可能性を示す。B/Cは調査の候補である。
2. **出力予測**：条件別中央値のPPCが一方の条件だけ一貫して低い。何が分かるか。  
   **解答：その条件の中央値をモデルが再現していない疑い。** 全体平均が合っているか、係数が有意かは直接分からない。
3. **記述**：`loo_compare()`の前に揃えるものを二つ書く。  
   **rubric：同じ観測（またはgroup）単位、同じ将来予測課題を明記する。**
4. **レビュー**：`log_lik[n] = normal_lpdf(y | mu, sigma);` がN回書かれている。何が問題か。  
   **解答：各列が観測nの寄与でなく全尤度の複製になる。** `y[n]`と`mu[n]`を使う。
5. **主張境界**：「LOOが良いので条件がRTを変えた」は妥当か。  
   **解答：不適切。** LOOは候補間の予測比較であり、因果の設計仮定を与えない。

## 4段階練習

1. **まねる**：上の二モデルを実行前に、`baseline_z`を加えたPPCで何を比較するか書く。
2. **一つ変える**：PPC統計量を中央値から90%分位点へ一つだけ替え、変えなかった予測課題を記録する。
3. **見ずに作る＋デバッグ**：最小の`brm()`、`summary()`、`pp_check()`、`loo()`を書き直す。意図的に片方だけ別データでfitし、比較を止める理由を書く。
4. **未見転移**：一人20試行の反復測定へ移した場合に、新参加者を予測するなら行単位LOOでよいか、参加者単位holdoutが必要かを決める。

## 歯応えある任意課題

条件別の中央値と遅い反応の割合を事前にPPC統計量として決め、二候補の比較表を作る。順位ではなく、各モデルが失敗した特徴も報告する。

## 一次資料

- [brms: Posterior Predictive Checks](https://paulbuerkner.com/brms/reference/pp_check.brmsfit.html)
- [loo: Pareto-k diagnostics](https://mc-stan.org/loo/reference/pareto-k-diagnostic.html)
- [Stan User’s Guide: Posterior and Prior Predictive Checks](https://mc-stan.org/docs/stan-users-guide/posterior-predictive-checks.html)
