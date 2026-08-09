# L35 ブロック、型、制約を読む

> 状態: 非公開ドラフト。L34の実行境界を前提に、Stanプログラムの配置規則と型を、エラー修正まで含めて扱います。

## このレッスンのゴール

Stanのブロック順、変数のスコープ、`int`・`real`・`vector`・`row_vector`・`matrix`・`array`の違い、制約の役割をコードから説明し、型・配置・スコープのエラーを修正できるようになります。

完成条件は、用語を選択問題で当てることではありません。次の3成果物を残します。

1. ブロックごとの実行時期・利用可能な変数・出力有無をまとめた表
2. `array`と`vector`を混同したコード、およびスコープ違反コードの修正版
3. 見本なしで書いた最小Stanプログラムと、構文確認結果

## 1. Stanのブロックには順序がある

Stanは次の7ブロックをこの順で記述します。すべて必須ではありませんが、使うブロックの順序は入れ替えられません。

```stan
functions {
  // ユーザー定義関数
}
data {
  // 外から受け取る既知の値
}
transformed data {
  // データだけから一度計算する値
}
parameters {
  // 推定する未知量
}
transformed parameters {
  // データとパラメータから各対数密度評価で計算する値
}
model {
  // targetへ対数密度を加える
}
generated quantities {
  // 各drawの後で計算・乱数生成する保存値
}
```

この教材の単回帰例はユーザー定義関数を使わないため、`functions`を除く6ブロックを使います。「Stanには6ブロックしかない」のではなく、「この例で使う主要6ブロック」です。

| ブロック | 主な実行時期 | 使える値 | 出力 |
|---|---|---|---|
| `functions` | コンパイルされ、呼び出し時に実行 | 関数の引数と関数内ローカル値 | 関数定義自体はdrawに保存されない |
| `data` | chain開始時に読み込む | その場より前に宣言済みのdata | 入力として記録可能 |
| `transformed data` | データ読込後、chainごとに一度 | data | drawには保存せず、宣言値は後続ブロックで利用可能 |
| `parameters` | サンプラーが内部の無制約表現を探索 | dataを使った制約・大きさを宣言可能 | drawとして保存 |
| `transformed parameters` | 対数密度を評価するたび | data、transformed data、parameters | drawごとに保存 |
| `model` | 対数密度を評価するたび | 前のブロックの値とmodel内ローカル値 | model内ローカル値は保存されない |
| `generated quantities` | 各drawが得られた後 | dataからparametersまでの値 | 宣言値をdrawごとに保存 |

`generated quantities`は推定後に実行されるので、そこで作った`y_rep`を`model`の尤度へ使えません。未来のブロックで宣言される値を、前のブロックから参照できないためです。

## 2. スコープは「どこから見えるか」の規則

```stan
transformed data {
  real x_mean = mean(x);
}
model {
  real centered_first = x[1] - x_mean;
  target += normal_lpdf(centered_first | 0, 1);
}
```

`x_mean`は`transformed data`で宣言されたため、後続の`model`から参照できます。一方、`centered_first`は`model`内のローカル変数なので、`generated quantities`から参照できません。

波括弧で作った局所スコープにも同じ考え方があります。

```stan
model {
  {
    real local_scale = 1;
    y ~ normal(mu, local_scale);
  }
  // local_scaleはここでは見えない
}
```

エラー表示行だけを修正するのではなく、変数の宣言地点と利用地点をたどります。後続でも必要なら適切な外側のスコープへ移し、単に名前を再宣言して別の値を作らないようにします。

## 3. 型と大きさを分けて読む

Stanではすべての変数に明示的な型があります。

```stan
int N;
real sigma;
vector[N] x;
row_vector[N] x_row;
matrix[N, 2] design;
array[N] real measurement;
array[N] int<lower=0, upper=1> response;
```

- `int`: 整数。二値・件数・添字などに使う。
- `real`: 実数のスカラー。
- `vector[N]`: 長さ`N`の列ベクトル。線形代数とベクトル化された分布関数に使える。
- `row_vector[N]`: 長さ`N`の行ベクトル。`vector[N]`とは向きが異なる。
- `matrix[N, 2]`: `N`行2列の行列。
- `array[N] real`: `real`をN個並べた配列。
- `array[N] int`: 整数列を保持できる配列。

同じ要素数でも、配列・vector・row_vector・matrixは交換可能ではありません。

```stan
array[N] real observations;
vector[N] copied;

// copied = observations;  // 型が違うので代入できない
copied = to_vector(observations);
```

変換関数を使うときも、「コンパイラを黙らせるため」ではなく、後続の演算がどの型を要求し、変換後の要素順が何を意味するか説明します。

## 4. 次元と添字は実行時の契約も持つ

`vector[N] x`の`N`は、パラメータではなくデータなど実行前に分かる整数式でなければなりません。Stanの添字は1から始まります。

```stan
for (n in 1:N) {
  target += normal_lpdf(y[n] | alpha + beta * x[n], sigma);
}
```

`n`は整数なので添字として使えます。`real`を添字にすることはできません。一方、行列積の内側次元のように、型検査だけでは実データに対する全ての大きさ不一致を検出できない場合があります。R側のデータ契約と小さな実行テストも必要です。

次の2つは別の問題です。

- `matrix[K, N] X`へ`vector[N] beta`を掛ける: 内側次元は`N`で一致し、結果は`vector[K]`。
- `matrix[N, K] X`へ`vector[N] beta`を掛ける: 型はmatrix×vectorでも、内側次元`K`と`N`が一般には一致しない。

式を見たら、型だけでなく各次元へ意味のラベルを付けます。たとえば`N = 観測数`、`K = 予測変数数`です。

## 5. 制約は事前分布ではない

```stan
data {
  int<lower=1> N;
}
parameters {
  real<lower=0> sigma;
}
model {
  sigma ~ exponential(1);
}
```

同じ`<lower=...>`でも、dataとparametersでは役割が異なります。

- dataの制約: 読み込んだ値を検査し、違反なら停止する。
- parameterの制約: サンプラーが使う無制約な内部表現と、宣言した尺度の間を変換する。
- 事前分布: `model`で対数密度へ加える。制約だけでは、研究上必要な事前分布を指定したことにならない。

`real<lower=0> sigma;`を書いても、`sigma ~ exponential(1);`が自動で追加されるわけではありません。また、観測値に`<lower=0>`を付けることと、0で切断された尤度を正規化することも別です。制約、事前分布、切断、打ち切りはそれぞれ観測過程と密度への異なる主張です。

## 6. 分布関数の接尾辞を型と目的から選ぶ

| 接尾辞 | 返すもの | 例 |
|---|---|---|
| `_lpdf` | 連続分布の対数密度 | `normal_lpdf(y | mu, sigma)` |
| `_lpmf` | 離散分布の対数確率質量 | `bernoulli_lpmf(y | p)` |
| `_lcdf` | 累積確率の対数 | `normal_lcdf(upper | mu, sigma)` |
| `_lccdf` | 上側確率の対数 | `normal_lccdf(lower | mu, sigma)` |
| `_rng` | 乱数 | `normal_rng(mu, sigma)` |

`normal_lpdf(y | mu, sigma)`の縦線は、変量`y`と分布パラメータを分けます。`_rng`は対数密度を返さず、乱数を生成します。原則として`generated quantities`など許可された場所で使います。

```stan
y ~ normal(mu, sigma);
target += normal_lpdf(y | mu, sigma);
```

この例では両方が同じ対数密度への寄与を表します。`~`は`y`への乱数代入ではありません。正規化定数の扱いが必要な切断分布などでは、どの密度を`target`へ加えているかを別途確認します。

## 7. エラーを分類してから直す

### 型エラー

`array[N] real`を`vector[N]`へ直接代入しているなら、宣言を目的に合わせるか、意味を保つ明示的変換を行います。

### スコープエラー

局所ブロック内の変数を外で使っているなら、必要な存続範囲を決めて宣言位置を変えます。

### 許可ブロックのエラー

`normal_rng()`を`model`へ置いているなら、密度定義と乱数生成を混同しています。予測量なら`generated quantities`へ移します。

### コンパイルは通る誤モデル

型・スコープ・関数シグネチャが正しくても、尤度、offset、Jacobian、予測単位が誤っていることがあります。コンパイラエラーが0件という結果を、統計的レビューの代わりにしません。

## 8. 6回の接触で文法を身につける

1. **読む・予測する**: 宣言ごとに型・大きさ・スコープ・実行時期を記入する。
2. **穴埋めする**: 6ブロックの単回帰例で、欠けた宣言とセミコロンを補う。
3. **一部を変える**: `vector[N] y`を二値の`array[N] int<lower=0, upper=1> y`へ変更する。
4. **エラーを直す**: `errors/se02`・`se05`・`se06`の壊れた例を、診断予測後に修正する。
5. **見本なしで再現する**: `data`・`parameters`・`model`を持つ最小正規モデルを白紙で書く。
6. **別文脈へ移す**: 二値応答モデルへ型・支持範囲・分布関数を移し、変更点を説明する。

6番目は直後の転移です。L37後に同じ文法をエラー修正と白紙実装で再訪し、直後にできたことと遅延後にも保持できたことを分けて評価します。

## よくある誤り

- `functions`を含めたStanのブロック全体と、教材例で使う6ブロックを混同する。
- 後続ブロックで宣言する値を、前のブロックから参照できると思う。
- `array[N] real`、`vector[N]`、`row_vector[N]`を要素数が同じだから同じ型だと考える。
- `real<lower=0>`を正の事前分布そのものだと説明する。
- data制約、parameter変換、切断尤度を同じ仕組みだと扱う。
- コンパイル成功を、統計モデルの正しさと同一視する。

## 内容理解問題

問題の正本は`foundation-assessments.json`です。

1. `stan-l35-q1-block-order`: ブロック順と任意性を区別する。
2. `stan-l35-q2-scope`: 変数が参照可能な範囲を予測する。
3. `stan-l35-q3-array-vector`: 配列とvectorの型エラーを診断する。
4. `stan-l35-q4-constraint-prior`: 制約と事前分布を説明し分ける。
5. `stan-l35-q5-transfer-binary`: 正規モデルから二値モデルへ型と分布関数を移す。

選択問題は形成的な理解確認です。L35の直接証拠には、初回エラー、修正版、修正理由、見本なしの最小モデルを残します。

## 直接評価

1. 単回帰例の各宣言について、ブロック、型、次元、利用可能範囲、保存有無を説明する。
2. `array`・`vector`不一致と局所スコープ違反を、エラー表示行の置換だけに頼らず修正する。
3. data制約、parameter制約、事前分布、切断尤度の違いを説明する。
4. 未見の二値応答モデルを、適切な整数型とBernoulli分布で最小実装する。

## 公式資料

- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
- [Stan Reference Manual: Data Types and Declarations](https://mc-stan.org/docs/reference-manual/types.html)
- [CmdStanR: `$check_syntax()`](https://mc-stan.org/cmdstanr/reference/model-method-check_syntax.html)
- [CmdStanR: Model variables](https://mc-stan.org/cmdstanr/reference/model-method-variables.html)

最終確認日: 2026-08-09。
