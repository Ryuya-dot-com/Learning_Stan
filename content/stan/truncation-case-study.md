# ケーススタディ：採用範囲のある測定器をStanで分析する

状態: `draft-unpublished`。このケースは、`distribution-grammar-lab.md`のg04〜g06を終えた後に実施します。

## 1. 分析依頼

研究室の測定器は、校正中の応答時間が0秒以上1.5秒以下だった測定だけをデータファイルへ保存します。範囲外だった測定は、境界値へ置換されるのではなく、ファイルへ入りません。

依頼は次の4点です。

1. データを見る前に、3組のハイパーパラメータから事前予測分布をStanで生成する。
2. 保存された2,000測定を、採用過程を含む切断正規モデルで推定する。
3. 入力範囲だけを制約し、切断正規化項を省いたモデルと比較する。
4. 計算診断と統計モデルの妥当性を、別々の根拠で報告する。

これは切断です。全個体は記録されているが「1.5秒以上」とだけ分かる打ち切りでも、負値を0へ変換するclampingでもありません。

## 2. データ生成過程

切断前の潜在測定を

\[
y_i^* \sim \mathrm{Normal}(\mu, \sigma),
\qquad
\mu = 0.15,
\qquad
\sigma = 0.45
\]

とし、保存規則を

\[
y_i = y_i^* \mid 0 \le y_i^* \le 1.5
\]

とします。保存される確率は

\[
P(0 \le Y^* \le 1.5)
= F(1.5 \mid \mu,\sigma)-F(0 \mid \mu,\sigma)
\approx 0.6292
\]

です。つまり、潜在測定の約37%がファイルに現れません。

合成データは逆CDF法で生成します。

\[
u_i \sim \mathrm{Uniform}
\left(F(0\mid\mu,\sigma), F(1.5\mid\mu,\sigma)\right),
\qquad
y_i = \mu + \sigma\Phi^{-1}(u_i)
\]

境界へ値を丸めないため、境界上に不自然な点質量はできません。

## 3. 事前予測――データを見る前の問い

事前分布は

\[
\mu \sim \mathrm{Normal}(0,\tau),
\qquad
\sigma \sim \mathrm{Exponential}(\lambda)
\]

です。`tau`と`lambda`を固定値として与えると、ここでは事前分布のハイパーパラメータです。

| 条件 | \(\tau\) | \(\lambda\) | Stan生成`y_sim`のSD | 5%点 | 95%点 |
|---|---:|---:|---:|---:|---:|
| narrow | 0.5 | 2.0 | 0.832 | -1.140 | 1.265 |
| baseline | 2.0 | 1.0 | 2.472 | -3.916 | 3.597 |
| wide | 4.0 | 0.5 | 4.923 | -8.233 | 7.245 |

`sigma ~ exponential(lambda)`では\(E[\sigma]=1/\lambda\)です。`lambda`を2、1、0.5と小さくするにつれて、実測した`sigma_sim`の平均も約0.471、0.997、1.990と大きくなりました。

ここでの問いは「最も平らな事前分布はどれか」ではありません。「この測定器と研究領域で、データを生成したときに現実的な秒数になるか」です。

実行コードは`examples/prior-predictive.stan`です。`parameters`や`model`を使わず、`generated quantities`内で`normal_rng`と`exponential_rng`を呼び、fixed-parameter samplerで各条件1,000回生成します。

## 4. もっともらしい誤答

次のコードは構文が通り、4 chainも正常終了します。

```stan
data {
  int<lower=1> N;
  real lower_bound;
  real upper_bound;
  vector<lower=lower_bound, upper=upper_bound>[N] y;
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

しかし、`vector<lower=..., upper=...>`は入力値が範囲内かを検査するだけです。次のパラメータ依存正規化項を尤度へ加えません。

\[
-N\log\left(
F(1.5\mid\mu,\sigma)-F(0\mid\mu,\sigma)
\right)
\]

教材では、このコードを`examples/wrong-naive-bounded-normal.stan`として、ファイル名・先頭コメント・出力ラベルの3か所で意図的な誤答だと明示しています。

## 5. 正しい切断モデル

正答モデルの中心は1行です。

```stan
y ~ normal(mu, sigma) T[lower_bound, upper_bound];
```

連続分布について、範囲内の1観測が`target`へ加える量は

\[
\log p(y_i\mid\mu,\sigma)
-\log\left(
F(U\mid\mu,\sigma)-F(L\mid\mu,\sigma)
\right)
\]

です。`examples/truncated-normal.stan`は、学習用に1観測分の対数正規化項も`truncation_log_normalizer`として保存します。

事後予測`y_rep`は、推定された`mu`・`sigma`を使った逆CDF法で生成します。`normal_rng(mu, sigma)`をそのまま使うと範囲外の値を含むため、観測された保存過程の再現になりません。

## 6. 実測比較

R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0で、4 chain、warmup 1,000、sampling 1,000を実行しました。

| モデル | パラメータ | 真値 | 事後平均 | 90%区間 |
|---|---|---:|---:|---:|
| 正しい切断 | `mu` | 0.15 | 0.150 | [0.087, 0.209] |
| 正しい切断 | `sigma` | 0.45 | 0.450 | [0.420, 0.482] |
| 正規化なし | `mu` | 0.15 | 0.417 | [0.407, 0.428] |
| 正規化なし | `sigma` | 0.45 | 0.294 | [0.287, 0.302] |

正規化なしモデルは、保存後データの平均と標準偏差を、切断前分布の`mu`と`sigma`だと誤って解釈します。その結果、`mu`を上へ、`sigma`を下へ大きくずらしました。

## 7. 診断が良い誤答

両モデルとも、次を満たしました。

- divergence: 全chainで0
- 最大treedepth到達: 全chainで0
- E-BFMI: 全chainで0.99以上
- R-hat最大: 正答1.005、誤答1.003
- bulk ESS最小: 正答709、誤答2,726

誤答モデルの方がESSまで大きい点が重要です。計算診断が確認するのは、主に「指定した`target`をサンプラーが探索できたか」です。観測過程を正しく指定したかまでは保証しません。

サンプリング中には、`sigma`が数値的に0へ近づく提案が散発的に棄却されたという情報メッセージも出ました。保存drawではdivergenceと最大treedepth到達が0で、E-BFMI・R-hat・ESSも基準内でした。メッセージを無視するのではなく、頻度と保存drawの診断を分けて記録します。

## 8. 実行手順

プロジェクトルートから実行します。

```powershell
Rscript content/stan/examples/run-distribution-models.R outputs/stan-truncation-case
```

ローカル隔離ランタイムを使う場合は、RパッケージライブラリとCmdStanの場所を設定します。

```powershell
$env:R_LIBS_USER = (Resolve-Path '.codex-r-lib-4.6.1').Path
$env:LEARNING_STAN_CMDSTAN = (Resolve-Path '.codex-cmdstan/cmdstan-2.39.0').Path
& '.\.codex-r-runtime-4.6.1\bin\Rscript.exe' `
  content/stan/examples/run-distribution-models.R `
  outputs/stan-truncation-case
```

生成物は次の8点です。

1. `scenario-data.csv`
2. `scenario-metadata.csv`
3. `prior-predictive-summary.csv`
4. `model-comparison.csv`
5. `diagnostics.csv`
6. `01-stan-prior-predictive.png`
7. `02-truncation-estimates.png`
8. `03-truncated-posterior-predictive.png`

コンパイル済みモデルとchain CSVは、指定した出力先のサブディレクトリへ分離します。教材原稿や`.stan`ファイルを上書きしません。

## 9. ステップ別練習

### 練習1：分類する

「範囲外の測定はファイルに入らない」という1文から、切断・打ち切り・clampingのどれかを選び、残り2つでない理由を書く。

### 練習2：式へ戻す

`T[L,U]`を見ずに、連続分布の正規化項\(F(U)-F(L)\)を含む対数密度を書く。

### 練習3：誤りを指摘する

`wrong-naive-bounded-normal.stan`で構文が通る箇所と、統計的に欠けている箇所を別々に指摘する。

### 練習4：結果を予想する

0より小さい測定が消えると、正規化なしモデルの`mu`と`sigma`がどちらへずれるか、実行前に予想する。

### 練習5：診断を判定する

R-hat、ESS、divergenceが良好な誤答モデルを採用してはいけない理由を、「計算」と「観測過程」を使って説明する。

### 練習6：境界を変更する

上限を1.5から0.8へ変更し、保存確率、推定差、事後予測図がどう変わるかを予想してから再実行する。

### 練習7：打ち切りへ転移する

範囲外の個体も残り、「1.5秒以上」と記録される設計へ変える。`T[0,1.5]`をそのまま使わず、観測値へ`normal_lpdf`、上限超過へ`normal_lccdf`を加える方針を書く。

### 練習8：自分の研究へ転移する

自分のデータについて、保存前に除かれる値、境界値として残る値、そもそも発生しない値を分け、データ収集者へ確認すべき質問を3つ作る。

## 10. 合格条件

- `T[L,U]`と入力制約の役割をコードなしで説明できる。
- 正規化項がパラメータへ依存するとき、省略が推定を変える理由を数式で説明できる。
- `generated quantities`で観測過程と同じ事後予測標本を作れる。
- 計算診断が良い誤指定モデルを、観測過程の根拠で棄却できる。
- 新しいシナリオを切断・打ち切り・clampingへ分類できる。

実行証拠とコードSHA-256は`scenario-validation.json`に記録しています。公開前には、固定されたクリーンCI環境での再実行とStan経験者による独立レビューを別途必要とします。
