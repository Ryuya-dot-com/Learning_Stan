# Stan分布文法ラボ（ベータ公開中）

このラボの目的は、分布名を暗記することではありません。次の往復を、見本なしでできる状態を目指します。

> 生成過程 → 数式 → Stanの型とブロック → 対数密度 → 乱数シミュレーション → 可視化 → 仮定の見直し

公開状態は`beta-public`です。全32課題の定義は`grammar-drills.json`にあり、各単元を必ず「写経 → 変更 → 白紙再現 → 転移」の順で進めます。

## 0. 先に区別する3つの操作

同じ分布名でも、何をしているかは接尾辞と置き場所で変わります。

| 目的 | Stanの例 | 意味 |
|---|---|---|
| 対数密度を`target`へ加える | `y ~ normal(mu, sigma);` | `model`内のdistribution statement。乱数代入ではない |
| 正規化済み対数密度を計算する | `normal_lpdf(y | mu, sigma)` | 連続分布のlog PDFを値として返す |
| 対数累積確率を計算する | `normal_lcdf(y | mu, sigma)` | `log P(Y <= y)`を返す |
| 対数上側確率を計算する | `normal_lccdf(y | mu, sigma)` | `log P(Y > y)`を返す |
| 乱数を1つ生成する | `normal_rng(mu, sigma)` | `transformed data`または`generated quantities`で使う |

離散分布では`_lpdf`ではなく`_lpmf`を使います。たとえば二値観測なら`bernoulli_lpmf(y | p)`です。

`y ~ normal(mu, sigma);`は概念的には次に対応します。

```stan
target += normal_lupdf(y | mu, sigma);
```

distribution statementは、パラメータに依存しない加法定数を省いた`_lupdf`相当です。旧版資料ではsampling statementと呼ばれていましたが、乱数生成と誤解しやすいため、Stan 2.39の現行マニュアルはdistribution statementという用語を使います。正規化定数まで含む`normal_lpdf`と数値が常に完全一致する、という説明はしません。事後分布の同じ核を表す場合でも、「乱数を発生させる命令」ではない点が重要です。

## 1. 正規分布――位置と尺度をコードへ結ぶ

正規分布の密度は

\[
p(y \mid \mu, \sigma)
= \frac{1}{\sigma\sqrt{2\pi}}
  \exp\left\{-\frac{(y-\mu)^2}{2\sigma^2}\right\},
\qquad \sigma > 0
\]

です。

- `mu`は中心を左右へ動かします。
- `sigma`は標準偏差であり、分散ではありません。分散は` square(sigma) `、すなわち\(\sigma^2\)です。
- `real<lower=0> sigma;`という制約と、`sigma ~ exponential(1);`という事前分布は別の役割です。

最小の尤度は次のように書けます。

```stan
data {
  int<lower=1> N;
  vector[N] y;
}
parameters {
  real mu;
  real<lower=0> sigma;
}
model {
  mu ~ normal(0, 2);
  sigma ~ exponential(1);
  y ~ normal(mu, sigma);
}
```

独立な観測なら、数式では

\[
\log p(\boldsymbol y \mid \mu, \sigma)
= \sum_{n=1}^{N}\log p(y_n \mid \mu, \sigma)
\]

です。`y ~ normal(mu, sigma);`は、この和をベクトル化して書いています。ループをベクトル化しても、独立性や同じ`mu`・`sigma`を使うという統計的仮定は勝手には変わりません。

## 2. Beta分布――形状パラメータを目で読む

\(0 < p < 1\)の量にはBeta分布が候補になります。

\[
p \sim \mathrm{Beta}(\alpha, \beta),
\qquad
E[p] = \frac{\alpha}{\alpha + \beta},
\qquad
\mathrm{Var}(p)
= \frac{\alpha\beta}
{(\alpha+\beta)^2(\alpha+\beta+1)}
\]

`alpha`と`beta`はBeta分布の形状パラメータです。名前が`alpha`や`beta`だから自動的にハイパーパラメータになるわけではありません。別の未知量`p`の事前分布を規定する固定値として使うときに、`p`から見たハイパーパラメータと呼べます。

```stan
data {
  real<lower=0> alpha;
  real<lower=0> beta;
}
parameters {
  real<lower=0, upper=1> p;
}
model {
  p ~ beta(alpha, beta);
}
```

可視化では少なくとも次を比較します。

- `beta(1, 1)`: 0から1で一様
- `beta(2, 2)`: 0.5付近を好む対称形
- `beta(2, 8)`: 小さい値を好む
- `beta(8, 2)`: 大きい値を好む

## 3. ハイパーパラメータ――事前予測で意味を点検する

次のモデルを考えます。

\[
\begin{aligned}
\mu &\sim \mathrm{Normal}(m_0, \tau),\\
\sigma &\sim \mathrm{Exponential}(\lambda),\\
y_i &\sim \mathrm{Normal}(\mu, \sigma).
\end{aligned}
\]

ここで`m0`、`tau`、`lambda`を固定して外から与えるなら、`mu`と`sigma`の事前分布を規定するハイパーパラメータです。指数分布をrateで指定するStan/Rの約束では

\[
E[\sigma] = \frac{1}{\lambda}
\]

なので、`lambda`を大きくすると典型的な`sigma`は小さくなります。

一方、階層モデルで`tau`自体をデータから推定するなら、`tau`は上位レベルの未知パラメータです。「固定された設定値」と「推定対象」を同じ意味のハイパーパラメータとして曖昧に扱いません。

事前予測は

\[
\mu^{\mathrm{sim}} \sim p(\mu),
\qquad
\sigma^{\mathrm{sim}} \sim p(\sigma),
\qquad
y^{\mathrm{sim}} \sim p(y \mid \mu^{\mathrm{sim}}, \sigma^{\mathrm{sim}})
\]

と順番に生成します。その周辺分布は

\[
p(y) = \int p(y \mid \theta)p(\theta)\,d\theta
\]

です。データを見る前に、`y_sim`が現実にあり得る範囲かを図で点検します。「弱情報事前分布」という名前だけで妥当性を決めません。

実行可能なStan例は`examples/prior-predictive.stan`です。`parameters`と`model`を置かず、`generated quantities`で`normal_rng`と`exponential_rng`を呼びます。CmdStan/CmdStanRではfixed-parameter samplerで独立な事前予測標本を生成できます。

## 4. 切断分布――範囲を切るだけでは終わらない

元の密度を\(p(y\mid\theta)\)、CDFを\(F(y\mid\theta)\)とします。\(L \le y \le U\)だけが観測される切断分布は

\[
p_T(y \mid \theta)
=
\begin{cases}
\dfrac{p(y \mid \theta)}
{F(U \mid \theta)-F(L \mid \theta)}, & L \le y \le U,\\
0, & \text{otherwise}
\end{cases}
\]

です。分母が、残った範囲の密度を1へ戻す正規化項です。Stanでは次の構文が使えます。

```stan
y ~ normal(mu, sigma) T[lower_bound, upper_bound];
```

1観測が範囲内にあるとき、正規化済み対数密度は概念的に

```stan
target += normal_lpdf(y | mu, sigma)
          - log_diff_exp(
              normal_lcdf(upper_bound | mu, sigma),
              normal_lcdf(lower_bound | mu, sigma)
            );
```

です。`vector[N] y`に同じ境界と分布パラメータを使う場合、正規化項は観測数分必要です。`T[lower_bound, upper_bound]`はその処理を含めて変換されます。

下側だけを0で切断するなら

```stan
y ~ normal(mu, sigma) T[0, ];
```

であり、範囲内では概念的に

```stan
target += normal_lpdf(y | mu, sigma)
          - normal_lccdf(0 | mu, sigma);
```

となります。

### 制約・切断・打ち切りは別物

| 概念 | 何が起きるか | 典型的なStan上の扱い |
|---|---|---|
| パラメータ制約 | 未知パラメータが取り得る領域を定める | `real<lower=0> sigma;` |
| 切断 | 範囲外の個体が標本へ入らない | `T[L, U]`または正規化項を含む尤度 |
| 打ち切り | 個体は入るが、閾値を超えた正確な値が見えない | 観測部分に`_lpdf`、閾値超過に`_lccdf`など |

`<lower=0>`は、それだけでdistribution statementへ切断正規化項を自動追加する構文ではありません。正規化項がすべての未知パラメータに対して定数なら事後分布の核へ影響しない場合がありますが、分布パラメータや境界が未知なら省略はモデルを変えます。

負値を0へ置換するclampingも切断ではありません。0に点質量ができ、連続な切断密度とは異なる分布になります。`04-truncation-vs-clamping.png`では、この誤りを並べて可視化します。

実行可能な推定例は`examples/truncated-normal.stan`です。入力データの境界制約、`T[lower_bound, upper_bound]`、対数正規化項を同時に確認できます。

## 5. Rでシミュレーションと可視化を実行する

Stanの構文だけを眺めず、Rで分布を直接発生させて図にします。追加パッケージは不要です。

```powershell
Rscript content/stan/examples/simulate-distributions.R .tmp/stan-distribution-lab
```

生成物は次の5点です。

1. `01-normal-parameters.png`: `mu`と`sigma`を1つずつ変えた正規密度
2. `02-beta-shapes.png`: 4組の`alpha`と`beta`による形状
3. `03-prior-predictive.png`: `tau`と`lambda`を変えた事前予測感度
4. `04-truncation-vs-clamping.png`: 正しい切断と誤った丸め処理
5. `simulation-summary.csv`: 理論平均・標準偏差とシミュレーション値の差

スクリプトは固定seedを使いますが、学習時にはseedを3つ変えます。図の細部は変わっても、パラメータ変更による大局的な差が残るかを確認してください。

自動検証は次で実行します。

```powershell
npm run test:stan-distributions
npm run test:stan-content
```

この基礎可視化を終えたら、`truncation-case-study.md`へ進みます。同じ切断データに正しい`T[L,U]`モデルと、正規化を省いた意図的な誤答モデルを実際に当て、両方の計算診断が良好でも推定結果が大きく異なることを確認します。

## 6. 4段階をどう反復するか

各単元で次の記録を1行ずつ残します。

1. **写経**: どの記号を何の意味で入力したか。
2. **変更**: 変更したパラメータと、変わると予想した分布の特徴。
3. **白紙再現**: 最初の構文エラーと、その原因。
4. **転移**: 元の問題から変えた仮定、維持した仮定、検証方法。

同じ正解を4回写すのではありません。支援を段階的に外し、最後は別の分布・データ型・観測過程へ移すのが反復の目的です。

## 7. 内容理解問題

### 問1

`y ~ normal(mu, sigma);`は`y`へ正規乱数を代入する命令ですか。違うなら何をしますか。

### 問2

`normal_lpdf`と`normal_rng`は、それぞれどのブロックで何のために使いますか。

### 問3

Beta分布の`alpha`と`beta`は、どんな場合にハイパーパラメータと呼べますか。

### 問4

`sigma ~ exponential(lambda)`で`lambda`を0.5から2へ変えると、事前平均`E[sigma]`はどう変わりますか。

### 問5

`real<lower=0> theta; theta ~ normal(mu, sigma);`と、`theta ~ normal(mu, sigma) T[0, ];`は常に同じモデルですか。

### 問6

範囲外の値を境界へ丸める処理が、切断分布のシミュレーションにならない理由は何ですか。

### 問7

上限を超えた正確な値だけが不明なデータは、切断と打ち切りのどちらですか。上限超過の尤度にはどの関数族を使いますか。

### 問8

事前予測図が現実離れして広いとき、サンプラーの設定より先に何を見直しますか。

<details>
<summary>解答と自己説明の基準</summary>

1. 乱数代入ではなく、分布の非正規化対数密度を`target`へ加えます。
2. `_lpdf`は密度評価、`_rng`は乱数生成です。`_rng`は`transformed data`か`generated quantities`、または`_rng`で終わるユーザー関数内に限られます。
3. 形状パラメータである`alpha`・`beta`が、別の未知量`p`の事前分布を規定する固定値または上位量として働く場合です。
4. `E[sigma]=1/lambda`なので、2から0.5へ下がります。
5. 常に同じではありません。制約だけでは切断正規化項をdistribution statementへ追加しません。その項が未知量に依存すれば事後分布も変わります。
6. 境界へ確率質量が集中するからです。連続な切断分布は残った範囲全体を再正規化します。
7. 打ち切りです。上側打ち切りの寄与には通常`_lccdf`を使います。
8. 生成過程と事前分布の位置・尺度・rateなどのハイパーパラメータ、および単位・データ尺度を見直します。

</details>

## 8. 合格条件

- 6単元すべてで白紙再現と転移を1回以上成功する。
- `_lpdf`・`_lpmf`・`_lcdf`・`_lccdf`・`_rng`を用途から選べる。
- 数式中の分布パラメータをStanの変数・型・制約へ対応付けられる。
- 事前予測図から、少なくとも1つのハイパーパラメータ修正案を根拠付きで出せる。
- 制約、切断、打ち切り、clampingを新しいシナリオで区別できる。
- 構文が通ることと、統計モデルが妥当であることを別々に検証できる。

## 公式資料

- [Stan Reference Manual: Program blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
- [Stan Reference Manual: Language syntax](https://mc-stan.org/docs/reference-manual/syntax.html)
- [Stan Reference Manual: User-defined functions](https://mc-stan.org/docs/reference-manual/user-functions.html)
- [Stan Functions Reference: Probability-function conventions](https://mc-stan.org/docs/2_39/functions-reference/conventions_for_probability_functions.html)
- [Stan Reference Manual: Statements and truncation](https://mc-stan.org/docs/reference-manual/statements.html)
- [Stan User's Guide: Prior predictive checks](https://mc-stan.org/docs/stan-users-guide/posterior-predictive-checks.html#prior-predictive-checks)

最終照合日: 2026-08-02。
