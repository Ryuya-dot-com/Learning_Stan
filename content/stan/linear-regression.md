# Stan単回帰を一行ずつ読む――縦切り教材原稿

> 状態: 非公開ドラフト。L34–L39の設計を、1本の小さなモデルで先に検証するための原稿です。

## 1. この教材でできるようになること

学習後は、次のことを自分の言葉と実行結果で示せるようになります。

1. R、CmdStanR、Stanの役割を区別する。
2. Rの`stan_data`とStanの`data`ブロックを名前・型・長さで対応付ける。
3. 6つのブロックが、いつ、何のために実行されるか説明する。
4. 単回帰の事前分布と尤度をコードから読み取る。
5. distribution statement（旧称sampling statement）の`~`が、乱数生成ではなく`target`への対数密度加算であると説明する。
6. CmdStanRで構文確認、コンパイル、4 chainのサンプリングを行う。
7. 推定値を解釈する前に計算診断を確認する。
8. `y_rep`を観測値と比べ、モデルが再現できない特徴を説明する。

この原稿は、Stanを「魔法の推定ボタン」としてではなく、データ生成過程を明示するプログラムとして読むことを目的にしています。

## 2. Rから結果までの責務を分ける

処理の流れは次のとおりです。

```text
Rのdata.frame
  → Rの名前付きlist
  → CmdStanRがデータを書き出す
  → StanプログラムをC++へ変換・コンパイル
  → CmdStanが複数chainをサンプリング
  → CSV形式のdraw
  → CmdStanRが診断・要約・予測確認に使える形で読む
```

Stanプログラムの中から、Rの`study`や`stan_data`を直接参照することはできません。両者の境界は、Stanの`data`ブロックとRの名前付きlistです。

| Stan側 | Stanの型 | R側 | 契約 |
|---|---|---|---|
| `N` | `int<lower=1>` | `nrow(study)` | 1以上の整数 |
| `x` | `vector[N]` | `study$x` | 長さNの数値 |
| `y` | `vector[N]` | `study$y` | 長さNの数値 |

名前が違う、`N`と長さが違う、文字列が混ざる、欠損値が残る、といった不一致はモデルの問題ではなく、まずデータ契約の問題として切り分けます。

## 3. 教材で使うStanプログラム

```stan
data {
  int<lower=1> N;
  vector[N] x;
  vector[N] y;
}
transformed data {
  vector[N] x_centered = x - mean(x);
}
parameters {
  real alpha;
  real beta;
  real<lower=0> sigma;
}
transformed parameters {
  vector[N] mu = alpha + beta * x_centered;
}
model {
  alpha ~ normal(0, 2);
  beta ~ normal(0, 1);
  sigma ~ exponential(1);
  y ~ normal(mu, sigma);
}
generated quantities {
  vector[N] log_lik;
  vector[N] y_rep;
  for (n in 1:N) {
    log_lik[n] = normal_lpdf(y[n] | mu[n], sigma);
    y_rep[n] = normal_rng(mu[n], sigma);
  }
}
```

### `data`: 外から受け取る既知の値

`int<lower=1> N;`は、観測数`N`が整数で1以上だという契約です。`vector[N] x;`と`vector[N] y;`は、どちらも長さ`N`の実数ベクトルを要求します。

ここに宣言した値はStanが推定する未知量ではありません。R側から1回のモデル実行ごとに渡します。`<lower=1>`は、条件に違反したデータを早く停止させる検査でもあります。

### `transformed data`: データだけで一度計算できる値

`x_centered = x - mean(x)`は、説明変数から平均を引きます。このブロックはデータを読み込んだ直後に実行され、サンプリングの各ステップで繰り返す必要がありません。

中心化により、`x_centered = 0`は平均的な`x`を表します。したがって`alpha`は「xが0のとき」ではなく「平均的なxにおけるyの期待値」になります。中心化は係数の意味を変えるので、単なる高速化として扱ってはいけません。

### `parameters`: Stanが探索する未知量

- `alpha`: 中心化後の切片
- `beta`: xが1増えたときのyの期待変化
- `sigma`: 観測が回帰直線からどれくらい散らばるかを表す正の尺度

`real<lower=0> sigma;`の制約は、Stanが正の領域と無制約な内部表現を変換することを意味します。この宣言だけではproperな事前分布は決まりません。`model`で密度項を加えなければ、正の支持範囲上の暗黙の不適切一様事前分布として解釈されます。この教材では`model`ブロックにproperな事前分布を明示します。

### `transformed parameters`: パラメータから導く保存対象

`mu = alpha + beta * x_centered`は、各観測の正規分布の平均です。`x_centered`がvector、`beta`がrealなので、`beta * x_centered`もvectorになります。

このブロックは対数密度を評価するたびに実行され、宣言した`mu`はdrawとともに出力されます。モデル計算に不要で出力だけに使う量なら、後述する`generated quantities`に置く方が効率的です。

### `model`: 事前分布と尤度で対数密度を定義する

```stan
alpha ~ normal(0, 2);
beta ~ normal(0, 1);
sigma ~ exponential(1);
y ~ normal(mu, sigma);
```

最初の3行は事前分布です。最後の1行は、各`y[n]`が平均`mu[n]`、標準偏差`sigma`の正規分布から生成されたという尤度です。

重要なのは、`alpha ~ normal(0, 2)`が`alpha`へ乱数を代入する命令ではないことです。概念的には、現在の`alpha`における正規分布の対数密度を`target`へ加えます。

```stan
target += normal_lupdf(alpha | 0, 2);
```

distribution statementの`~`は、パラメータ探索中に何度も評価される非正規化対数密度の定義です。`target += normal_lpdf(alpha | 0, 2)`と書く場合は正規化定数も含むため、通常は同じ事後推論になりますが、`target()`の数値は定数だけ違い得ます。旧版資料ではsampling statementと呼ばれます。乱数生成には`normal_rng`のような`_rng`関数を使い、原則として`generated quantities`など許可された場所に書きます。

`y ~ normal(mu, sigma)`はベクトル化されています。意味は次のloopと同じです。

```stan
for (n in 1:N) {
  y[n] ~ normal(mu[n], sigma);
}
```

ベクトル化した形は短いだけでなく、Stanが効率よく計算できる形です。ただし、長さと型の対応を理解せずに省略記法として暗記してはいけません。

### `generated quantities`: draw後の予測と検査

`generated quantities`は、各drawが得られた後に実行されます。ここで計算した値は保存されますが、パラメータの事後分布には影響しません。

- `log_lik[n]`: 観測nの対数尤度。LOOなどのモデル比較で利用できる。
- `y_rep[n]`: 現在のdrawのパラメータから生成した架空の観測。事後予測チェックに使う。

`y_rep`が観測データに似ているだけで、モデルが真だと証明されるわけではありません。観測データの重要な特徴を再現できない場合に、モデルの不足を発見する道具です。

## 4. CmdStanRから実行する

```r
library(cmdstanr)

study <- data.frame(
  x = 1:8,
  y = c(-0.7, 0.1, 0.4, 1.4, 2.1, 2.5, 3.4, 3.7)
)

stan_data <- list(
  N = nrow(study),
  x = study$x,
  y = study$y
)

source_file <- file.path("content", "stan", "examples", "linear-regression.stan")
temporary_stan_file <- file.path(tempdir(), "learning-stan-linear-regression.stan")
file.copy(source_file, temporary_stan_file, overwrite = TRUE)

model <- cmdstan_model(temporary_stan_file, compile = FALSE)
model$check_syntax()
model$compile()

physical_cores <- parallel::detectCores(logical = FALSE)
parallel_chains <- if (is.na(physical_cores)) 1L else max(1L, min(4L, physical_cores))

fit <- model$sample(
  data = stan_data,
  seed = 20260801,
  chains = 4,
  parallel_chains = parallel_chains,
  iter_warmup = 1000,
  iter_sampling = 1000,
  refresh = 500
)

print(fit$summary(c("alpha", "beta", "sigma")))
print(fit$diagnostic_summary())

y_rep <- fit$draws("y_rep", format = "matrix")
print(rbind(observed = study$y, predicted_mean = colMeans(y_rep)))
```

`compile = FALSE`としてから`$check_syntax()`を呼ぶことで、構文確認とC++コンパイルを別工程として観察できます。教材ファイルを一時ディレクトリへコピーするのは、学習用リポジトリにOS固有の実行ファイルを残さないためです。

`seed`は再現手順に必要ですが、異なるOS、コンパイラ、CPUでもdrawがビット単位で完全一致する保証ではありません。再現性は、版、データ、コード、seed、chain設定、診断結果をまとめて記録して判断します。

## 5. 推定値より先に診断する

`fit$summary()`の係数だけを読んで結論へ進んではいけません。少なくとも次を確認します。

| 診断 | 問うこと | 問題があるとき |
|---|---|---|
| R-hat | chainが同じ分布へ混ざったか | 推定値の解釈を止め、traceとモデルを確認する |
| ESS | 自己相関を考慮した有効な情報量が十分か | MCSEと必要な推定精度を照合する |
| MCSE | MCMC近似による誤差が目的に対して小さいか | draw追加の前に混合・自己相関の原因を確認する |
| divergence | HMCが事後分布の幾何を正しく探索できたか | 該当領域、尺度、事前分布、パラメータ化を調べる |
| treedepth | NUTSが上限まで探索を打ち切られていないか | 効率と幾何を調べ、上限増加だけで済ませない |
| E-BFMI | 運動エネルギーの探索が不十分でないか | パラメータ化と事後分布の形を調べる |

警告が出たとき、最初から`adapt_delta`を上げるだけでは原因を説明できません。標準化、識別可能性、事前分布、外れ値、階層構造、centered／non-centered表現を検討し、変更前後の診断を比較します。

## 6. 誤解を見抜く練習

### 課題A――データ契約

R側で`N = 8`、`x = 1:7`を渡したとき、どの契約に違反するかを説明し、R側を修正してください。

合格基準: `vector[N] x`が長さNを要求していることを指摘し、Nを`length(x)`またはデータの行数から作る。

### 課題B――`~`の意味

「`beta ~ normal(0, 1)`は、各iterationでbetaへ正規乱数を代入する」という説明を訂正してください。

合格基準: 現在のbetaにおける対数密度を`target`へ加え、事後分布の形を定義することを説明する。

### 課題C――切片の意味

`transformed data`から中心化を削除し、`mu = alpha + beta * x`へ変えた場合、`alpha`の意味がどう変わるか説明してください。

合格基準: 平均的なxにおける期待値から、x=0における期待値へ変わることを説明する。

### 課題D――予測検査

`y_rep`の平均だけでなく、標準偏差と最大値を観測データと比較してください。再現できない特徴があれば、どの仮定を疑うか書いてください。

合格基準: 観測統計量をdrawごとの複製統計量と比較し、正規誤差、線形性、一定分散など具体的な仮定へ結び付ける。

### 課題E――コード変更

`beta`の事前分布を`normal(0, 0.2)`へ変更し、変更前後のprior predictiveとposteriorを比較してください。

合格基準: 狭い事前分布が傾きへ与える規則化を、尺度と予測値の両方で説明する。posteriorの変化だけを見て事前分布を選ばない。

## 7. この最小モデルがまだ扱わないもの

- 欠損値と測定誤差
- 外れ値に頑健な尤度
- 複数予測変数、交互作用、カテゴリカル予測変数
- 階層構造とnon-centered parameterization
- 二値・順序・カウント・反応時間モデル
- prior predictiveを実行する専用プログラム構成
- LOOによるモデル比較の適用条件

単回帰が動いたことは、これらを自動的に扱えることを意味しません。後続レッスンでは、モデルを複雑にする前に「データ生成過程のどの仮定を変えるのか」を言語化します。

## 8. 公式資料

- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
- [Stan Reference Manual: Program Execution](https://mc-stan.org/docs/reference-manual/execution.html)
- [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
- [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html)
- [CmdStan diagnose utility](https://mc-stan.org/docs/2_39/cmdstan-guide/diagnose_utility.html)

最終確認日: 2026-08-09。
