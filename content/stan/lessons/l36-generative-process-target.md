# L36 生成過程を対数密度へ翻訳する

> このレッスンはStanベータ編の一部です。L34・L35で扱った実行経路、ブロック、型、制約を使います。

L34ではRからStanまでの実行経路、L35ではブロック・型・制約を読みました。L36では、研究上の生成過程を数式へ分け、その数式を`model`ブロックの事前分布と尤度へ翻訳します。構文が通ることと、意図した確率モデルになっていることは別々に確かめます。

## このレッスンのゴール

終了時には、次のことができるようになります。

1. 単回帰の生成過程を、決定論的な線形予測子、パラメータの事前分布、観測の尤度へ分解する。
2. distribution statementの`~`が代入や乱数生成ではなく、対数密度を`target`へ加える記法だと説明する。
3. `~`と`target += ..._lpdf(...)`の定数項の扱いを区別し、「常に完全に同じ数値」とは説明しない。
4. ループとベクトル化した尤度の対応を読み、型・次元も確認する。
5. 事前分布がモデルの一部であり、省略してもコンパイラが研究上の妥当性を保証しないと説明する。
6. 二値応答へ移すとき、線形予測子、リンク尺度、応答尺度を区別する。

### このレッスンで作るもの

- 生成過程・数式・Stanコードの対応表
- 事前分布が1つ欠けた、コンパイル可能なモデルのレビュー記録
- 見本なしで書いた単回帰モデルと、二値応答への転移モデル

初回コード、構文確認結果、自分の説明、修正版を残します。後続のL37や、時間を置いた復習で、どこを自力で再現できたか見直せるようにしましょう。

## 1. まず生成過程を言葉で固定する

教材用の単回帰を、次のように考えます。

> 各観測の平均は、説明変数を平均0に中心化した値に応じて直線的に変わる。観測値はその平均の周囲に、共通の標準偏差をもつ正規分布から生じる。

観測数を \(N\)、中心化前の説明変数を \(x_n\)、応答を \(y_n\) とします。まず、データだけから計算できる量を定義します。

\[
\bar{x}=\frac{1}{N}\sum_{n=1}^{N}x_n,
\qquad
x_{c,n}=x_n-\bar{x}.
\]

次に、線形予測子を定義します。

\[
\mu_n=\alpha+\beta x_{c,n}.
\]

ここまでは、値が決まれば結果が一意に決まる決定論的な計算です。確率分布から新しい値を発生させる文ではありません。

教材では、説明のため次の事前分布と観測モデルを置きます。

\[
\begin{aligned}
\alpha &\sim \operatorname{Normal}(0,2),\\
\beta  &\sim \operatorname{Normal}(0,1),\\
\sigma &\sim \operatorname{Exponential}(1),\\
y_n \mid \alpha,\beta,\sigma,x_n
       &\sim \operatorname{Normal}(\mu_n,\sigma).
\end{aligned}
\]

この数値は万能な推奨値ではありません。実際には、変数の単位、現実的な効果量、測定誤差、先行研究に合わせて設定し、事前予測と感度分析で検討します。

### 数式とStanの対応

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
```

対応を次の順序で確認します。

| 生成過程の要素 | 数式 | Stanでの場所 | 確認すること |
|---|---|---|---|
| 観測済みの値 | \(N,x,y\) | `data` | 名前、型、長さ、値域 |
| データだけの変換 | \(x_c=x-\bar{x}\) | `transformed data` | parameterへ依存しないこと |
| 未知量 | \(\alpha,\beta,\sigma\) | `parameters` | 支持範囲と単位 |
| 決定論的な予測子 | \(\mu=\alpha+\beta x_c\) | `transformed parameters` | 次元と解釈 |
| 事前分布 | \(p(\alpha),p(\beta),p(\sigma)\) | `model` | 尺度と根拠 |
| 尤度 | \(p(y\mid\alpha,\beta,\sigma,x)\) | `model` | 観測過程と支持範囲 |

中心化したため、`alpha`は標本内の平均的な`x`における平均応答です。`beta`は`x`が1単位変化したときの平均応答の変化、`sigma`は応答と同じ単位を持つ条件付き標準偏差です。

## 2. `~`は代入でも乱数生成でもない

Stanの`model`ブロックにある次の文を読みます。

```stan
y ~ normal(mu, sigma);
```

これは「`y`へ正規乱数を代入する」という意味ではありません。現在の`y`、`mu`、`sigma`から正規分布の対数密度を評価し、モデルの対数密度の蓄積先である`target`へ加えます。

概念的には、次の形に対応します。

```stan
target += normal_lupdf(y | mu, sigma);
```

`normal_lupdf`の`u`は、パラメータに依存しない加法定数を落としたunnormalizedな対数密度であることを表します。通常のdistribution statementも、推定に不要な定数項を落とします。

一方、次の明示的な文は正規化定数を含む`normal_lpdf`を使います。

```stan
target += normal_lpdf(y | mu, sigma);
```

したがって、`y ~ normal(mu, sigma)`と`target += normal_lpdf(y | mu, sigma)`は、パラメータに依存しない定数だけ異なり、通常は同じ事後推論を定義します。しかし、各地点での`target()`が完全に同じ数値になるとは限りません。「推論上等価」と「数値として同一」を分けて説明します。

`target +=`は、`model`ブロックまたは名前が`_lp`で終わる関数内でだけ使えます。乱数を生成したい場合は、`generated quantities`など許可された場所で`normal_rng`を使います。

```stan
generated quantities {
  vector[N] y_rep;
  for (n in 1:N) {
    y_rep[n] = normal_rng(mu[n], sigma);
  }
}
```

この区別を短くまとめると次のとおりです。

- `y ~ normal(mu, sigma);`: 観測済み`y`の対数密度を`target`へ加える。
- `target += normal_lpdf(y | mu, sigma);`: 正規化された対数密度を明示的に加える。
- `y_rep[n] = normal_rng(mu[n], sigma);`: 新しい乱数を生成して代入する。

## 3. 事前分布と尤度は同じ`target`へ入る

ベイズモデルの事後分布は、比例記号を使えば次のように書けます。

\[
p(\alpha,\beta,\sigma\mid y,x)
\propto
p(y\mid\alpha,\beta,\sigma,x)
p(\alpha)p(\beta)p(\sigma).
\]

対数を取ると積は和になります。Stanでは事前分布のdistribution statementも尤度のdistribution statementも、同じ`target`へ寄与します。

```stan
model {
  alpha ~ normal(0, 2);          // log p(alpha)
  beta ~ normal(0, 1);           // log p(beta)
  sigma ~ exponential(1);        // log p(sigma)
  y ~ normal(mu, sigma);         // log p(y | alpha, beta, sigma, x)
}
```

コメントで「prior」と「likelihood」を区別しても、Stanにとってはすべて対数密度への加算です。区別は研究上の役割から生じます。

### 事前分布は飾りではない

次のコードは、`beta`の事前分布がなくても構文・型検査を通る可能性があります。

```stan
model {
  alpha ~ normal(0, 2);
  sigma ~ exponential(1);
  y ~ normal(alpha + beta * x_centered, sigma);
}
```

Stanは「研究者が`beta`の事前分布を意図的に省いたのか」を知りません。parameterについて事前分布として明示的な密度項を加えなければ、宣言された支持範囲上で暗黙に一様な不適切事前分布を置いたものとして解釈できます。`beta`はこの例でも尤度を通じて`target`へ寄与しますが、データとモデルによっては事後分布が不適切になり得ます。

この例の意図が \(\beta\sim\operatorname{Normal}(0,1)\) なら、修正は次です。

```stan
beta ~ normal(0, 1);
```

コンパイラが確認するのは、構文、型、関数シグネチャなどです。事前分布の尺度が研究上妥当か、尤度が標本抽出や測定過程に合うかは、モデルレビュー、事前予測、感度分析で確認します。

## 4. ベクトル化とループを往復する

単回帰の尤度は、ベクトル化して次のように書けます。

```stan
y ~ normal(mu, sigma);
```

同じ尤度の因子分解を、観測ごとのループで書けば次の形です。

```stan
for (n in 1:N) {
  y[n] ~ normal(mu[n], sigma);
}
```

`y`と`mu`はともに長さ`N`で、スカラーの`sigma`は各観測へ再利用されます。この2つは同じ正規尤度を表します。ベクトル化は短い表記というだけでなく、Stanの自動微分計算を効率化できる場合があります。

ただし、「ベクトル化できたから観測独立性が自動的に証明された」とは言えません。条件付き独立という因子分解はモデルとして置いた仮定です。また、長さや型が適合しない式は、短く書いても正しくなりません。

観測ごとの対数尤度を後でモデル比較に使う場合は、`generated quantities`で明示的に作ります。

```stan
generated quantities {
  vector[N] log_lik;
  for (n in 1:N) {
    log_lik[n] = normal_lpdf(y[n] | mu[n], sigma);
  }
}
```

ここでは観測単位を保持するため、意図的にループへ戻しています。ベクトル化するかは、表現したい計算結果の形も含めて決めます。

## 5. 二値応答ではリンク尺度を挟む

正規回帰では、`mu`は応答`y`と同じ尺度でした。二値応答では、確率 \(p_n\) は0から1に収まる必要があります。そこで、制約のない線形予測子 \(\eta_n\) と確率尺度をリンクします。

\[
\eta_n=\alpha+\beta x_n,
\qquad
\operatorname{logit}(p_n)=\eta_n,
\qquad
p_n=\operatorname{logit}^{-1}(\eta_n).
\]

生成過程は次です。

\[
y_n\sim\operatorname{Bernoulli}(p_n).
\]

Stanでは、確率をいったん計算する代わりに、logit尺度を直接受け取る`bernoulli_logit`を使えます。

```stan
data {
  int<lower=1> N;
  vector[N] x;
  array[N] int<lower=0, upper=1> y;
}
parameters {
  real alpha;
  real beta;
}
model {
  alpha ~ normal(0, 2);
  beta ~ normal(0, 1);
  y ~ bernoulli_logit(alpha + beta * x);
}
```

これは概念上、`y ~ bernoulli(inv_logit(alpha + beta * x))`に対応し、直接形はより数値的に安定です。係数`beta`はlog odds尺度上の変化です。確率尺度の変化として説明したいなら、具体的な`x`と係数drawに対して`inv_logit`で戻します。

## 6. 6回の練習で翻訳を身につける

### 1回目: 読む・予測する

完成コードを実行する前に、各行が「データ」「決定論的変換」「事前分布」「尤度」「乱数生成」のどれかを予測します。`~`を見たら、左辺へ何かを代入すると読まず、何が`target`へ加わるかを説明します。

### 2回目: 穴埋めする

次を見本なしで補います。

```stan
model {
  alpha ~ normal(0, 2);
  beta  ~ _____________;
  sigma ~ _____________;
  y     ~ _____________;
}
```

補った後、各分布の左辺、パラメータ、支持範囲、単位を声に出して確認します。

### 3回目: 一部を変える

`x`を10単位ごとの尺度へ変えます。`beta`の解釈と事前分布の尺度をどう見直すかを書き、単にコードの数値だけを置換しないでください。

### 4回目: エラーを直す

`beta`の事前分布が欠けた、コンパイル可能なモデルをレビューします。コンパイル結果、統計的な問題、修正前後、修正根拠を別々に記録します。

### 5回目: 見本なし

白紙から単回帰の`data`、`transformed data`、`parameters`、`transformed parameters`、`model`を書きます。L34のR側データ契約も併記し、構文確認前の初回版を保存します。

### 6回目: 別文脈へ移す

連続応答を0/1応答へ変更し、`array[N] int<lower=0, upper=1> y`と`bernoulli_logit`を使う最小モデルを書きます。維持した仮定、変更した型・分布・尺度を説明します。L37後に、見本を閉じて単回帰をもう一度再現します。

## よくある誤り

1. **`~`を乱数生成または代入と読む**
   `model`内のdistribution statementは対数密度を`target`へ加えます。乱数生成は`*_rng`です。

2. **`~`と`target += ..._lpdf`の値が常に完全一致すると説明する**
   distribution statementは定数項を落とします。通常は同じ事後推論を定義しますが、`target()`の数値は定数だけ違い得ます。

3. **制約を書けば事前分布も決まると思う**
   `real<lower=0> sigma`は支持範囲と変換を定めます。`sigma ~ exponential(1)`などの事前分布は別に書きます。

4. **事前分布がないのに、コンパイル成功だけで完成とする**
   Stanは省略の研究上の意図を判定しません。欠けた事前分布の密度項と事後分布の適切性をレビューします。

5. **ベクトル化を独立性の証明とみなす**
   コード表現と統計的仮定を分けます。条件付き独立はモデルとして置いた仮定です。

6. **logit係数を確率の直接差として読む**
   `beta`はlog odds尺度です。確率へ戻すには`inv_logit`と具体的な予測子値が必要です。

7. **結果を見てから都合のよい事前分布だけを採用する**
   尺度の根拠、事前予測、事前分布を変えた感度分析を計画し、変更履歴を残します。

## 内容理解問題

回答は`foundation-assessments.json`に対応します。選択問題は選択肢をシャッフルして提示し、初回回答をフィードバック前に保存します。

1. `stan-l36-q1-target-semantics`: distribution statementは`target`へ何を加えるか。
2. `stan-l36-q2-vectorized-equivalence`: ベクトル化、ループ、明示的`normal_lpdf`はどこまで同じか。
3. `stan-l36-q3-translate-regression`: 生成過程を事前分布と尤度へ翻訳できるか。
4. `stan-l36-q4-missing-prior`: コンパイル可能だが事前分布が欠けたコードをどうレビューするか。
5. `stan-l36-q5-transfer-logit`: 二値応答へ型、尤度、リンク、解釈を移せるか。

正答の表示は練習支援です。直接評価では、正答を見ずにコードと説明を再構成します。

## 直接評価

### A. 生成過程・数式・コードの対応表

単回帰について、観測済み量、決定論的変換、未知量、事前分布、尤度を分け、各数式とStanの行を1対1に対応付けます。各パラメータの単位と、`alpha`がどの`x`での平均かも記します。

合格の観点:

- 生成過程の向きと条件付けを説明できる。
- `alpha`、`beta`、`sigma`の事前分布と正規尤度がそろっている。
- `~`、`target +=`、`*_rng`の役割を区別できる。
- ベクトル化した式の型と長さが対応している。

### B. コンパイル可能な欠落のレビュー

`beta`の事前分布がない初回コードを保存し、構文確認が検出する範囲、検出しない統計的問題、修正版、採用した尺度の根拠を記録します。

合格の観点:

- 「コンパイルしない」ではなく「コンパイルしても研究上のモデルレビューが残る」と分類する。
- 暗黙の不適切一様事前分布と、事後分布の適切性が別問題だと述べる。
- 修正値を万能値とせず、単位と事前予測へ結び付ける。

### C. 二値応答への転移

連続応答のコードを見ずに、0/1応答の最小Bernoulli-logitモデルを書きます。線形予測子、確率、観測の3段階を式で示し、係数を応答尺度へ戻す方法を説明します。

合格の観点:

- `y`を0/1の整数配列として宣言する。
- `bernoulli_logit`へ線形予測子を渡す。
- `beta`を確率差と誤読せず、`inv_logit`による逆変換を説明する。
- 連続モデルから維持した仮定と変更した仮定を分ける。

## 公式資料

- [Stan Reference Manual: Statements](https://mc-stan.org/docs/reference-manual/statements.html)
- [Stan Reference Manual: Syntax](https://mc-stan.org/docs/reference-manual/syntax.html)
- [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
- [Stan Functions Reference: Binary Distributions](https://mc-stan.org/docs/functions-reference/binary_distributions.html)
- [Stan Functions Reference](https://mc-stan.org/docs/functions-reference/)

L36を終えたら、完成例を閉じて生成過程からモデルを書き直してみてください。その上で、コンパイルでは見つからない統計的な欠落を指摘し、別の応答型へ応用できるか確かめましょう。
