# L34 RからStanへ――実行経路とデータ契約

> 状態: ベータ公開中。L33までに相当するベイズモデリングを別途学習済みの方を、StanプログラムとCmdStanRの実行経路へ接続するレッスンです。

## このレッスンのゴール

R、CmdStanR、Stanコンパイラ、CmdStanが担当する処理を区別し、Rの名前付き`list`とStanの`data`ブロックを、名前・型・大きさ・許容範囲で対応付けられるようになります。

完成条件は、サンプリング結果が1回表示されることではありません。次の3点を、コードと自分の説明で残します。

1. Rからdrawまでの実行経路図
2. `N`・`x`・`y`のデータ契約表
3. 契約違反を1件診断し、修正前後を示した記録

## 1. StanはRの変数を直接読まない

次のRオブジェクトがあるとします。

```r
study <- data.frame(
  x = 1:8,
  y = c(-0.7, 0.1, 0.4, 1.4, 2.1, 2.5, 3.4, 3.7)
)
```

`.stan`ファイルの中から`study$x`を参照することはできません。Stanへ渡る境界は、Rで作る名前付き`list`とStanの`data`ブロックです。

```r
stan_data <- list(
  N = nrow(study),
  x = study$x,
  y = study$y
)
```

```stan
data {
  int<lower=1> N;
  vector[N] x;
  vector[N] y;
}
```

この2つは、次の契約でつながります。

| 名前 | Stan側の宣言 | R側の値 | 検査すること |
|---|---|---|---|
| `N` | `int<lower=1>` | `nrow(study)` | 長さ1の整数で、1以上 |
| `x` | `vector[N]` | `study$x` | 数値で、長さが`N` |
| `y` | `vector[N]` | `study$y` | 数値で、長さが`N` |

「列が存在する」だけでは不十分です。名前、Stanの型、次元、長さ、制約、欠損の扱いまでがデータ契約です。

## 2. Rからdrawまでの責務を分ける

実行経路は次の順です。

```text
Rのdata.frame
  → Rで検査して名前付きlistを作る
  → CmdStanRがStanプログラムとデータをCmdStanへ渡す
  → stanc3がStanコードを検査してC++へ変換する
  → C++ツールチェーンがモデル実行ファイルを作る
  → CmdStanが各chainを実行してCSVへdrawと診断情報を書く
  → CmdStanRがCSVを読み、要約・診断・予測確認へ渡す
```

| 担当 | このレッスンでの役割 | 担当しないこと |
|---|---|---|
| R | データ読込、前処理、契約検査、list作成、結果整理 | Stanの対数密度を自動的に正しく設計すること |
| CmdStanR | `.stan`とCmdStanを接続し、構文確認・コンパイル・実行・読込を呼び出す | モデルの統計的妥当性を保証すること |
| stanc3 | Stanの構文・型・利用可能な関数を検査し、C++へ変換する | 観測過程や事前分布が研究目的に適切か判断すること |
| C++ツールチェーン | 変換済みコードから実行ファイルを作る | Rのデータ内容を修正すること |
| CmdStan | 指定されたアルゴリズムで推定し、drawと診断情報を保存する | 計算診断が良いモデルを「真」と判定すること |

エラーの発生地点を区別すると、修正対象を絞れます。たとえば`vector[N] x`へ長さ7の値を渡した問題は、尤度やMCMC設定ではなくデータ契約を直します。

## 3. 実行前にR側で契約を検査する

Stanへ渡す前に、Rで説明可能な不一致を止めます。

```r
stopifnot(
  nrow(study) >= 1L,
  is.numeric(study$x),
  is.numeric(study$y),
  length(study$x) == nrow(study),
  length(study$y) == nrow(study),
  !anyNA(study$x),
  !anyNA(study$y),
  all(is.finite(study$x)),
  all(is.finite(study$y))
)

stan_data <- list(
  N = nrow(study),
  x = study$x,
  y = study$y
)
```

この検査はStan側の宣言を置き換えません。R側では分析ファイルに近い言葉で早く停止し、Stan側では実際に受け取ったデータが宣言へ適合するかを再度検査します。境界の両側で契約を明示することが、再現とデバッグに役立ちます。

## 4. 構文確認、コンパイル、サンプリングを分ける

```r
library(cmdstanr)

stan_file <- file.path(
  "content", "stan", "examples", "linear-regression.stan"
)

model <- cmdstan_model(stan_file, compile = FALSE)
model$check_syntax()
model$compile()

fit <- model$sample(
  data = stan_data,
  seed = 20260801,
  chains = 4,
  parallel_chains = 4,
  iter_warmup = 1000,
  iter_sampling = 1000
)
```

3工程は証拠が異なります。

| 工程 | 成功から分かること | まだ分からないこと |
|---|---|---|
| `$check_syntax()` | stanc3の構文・型検査を通る | C++コンパイル、データ適合、MCMC、モデル妥当性 |
| `$compile()` | 現在のOSとツールチェーンで実行ファイルを作れる | 与えるデータが契約を満たすか、推定が安定するか |
| `$sample()` | 指定データと設定で推定処理が完了した | 診断が良いか、予測が妥当か、研究上の問いへ答えるか |

構文確認の成功を「正しいモデル」の証拠にしてはいけません。`y`に正規分布を選ぶべきか、欠測や選択過程を表しているかは、コンパイラだけでは判断できません。

## 5. 契約違反を発生地点から診断する

### 例A――長さが一致しない

```r
bad_data <- list(
  N = 8L,
  x = 1:7,
  y = study$y
)
```

`x`は`vector[N]`なので8要素が必要です。`N`だけを7へ変えると今度は`y`と不一致になります。正本となる1つの表から、`N`・`x`・`y`を同時に作り直します。

### 例B――名前が一致しない

```r
bad_data <- list(
  n = nrow(study),
  predictor = study$x,
  outcome = study$y
)
```

R側の説明的な列名を、そのままStan側が推測することはありません。Stanが要求する`N`・`x`・`y`というキーへ明示的に対応付けます。

### 例C――欠損を平均で埋めて隠す

欠損値をStanへ渡せないからといって、根拠なく平均で置換してはいけません。欠測が生じた過程を確認し、除外・補完・欠測モデルのどれを採用したかを分析判断として記録します。これはファイル形式だけの問題ではありません。

## 6. 6回の接触で実行境界を身につける

1. **読む・予測する**: `stan_data`の各要素が、`data`ブロックのどの宣言へ渡るか線で結ぶ。
2. **穴埋めする**: `N`・`x`・`y`のうち空欄になった名前、型、長さを補う。
3. **一部を変える**: `x`列を`dose`へ変更し、R側だけでなく契約表とlistの対応を更新する。
4. **エラーを直す**: `N = 8`、長さ7の`x`、長さ8の`y`を受け取り、正本を確認して修正する。
5. **見本なしで再現する**: 小さなdata.frameから、検査付き`stan_data`を白紙で作る。
6. **別文脈へ移す**: 成功回数と試行回数を持つ二項データについて、整数型・長さ・値域を含む契約表を設計する。

6番目はこの場で行う最初の転移です。同じ技能をL37後に見本なしで再試行し、初回の正答と時間を置いた保持を別々に記録します。

## よくある誤り

- CmdStanRをStan本体、StanをRパッケージだと説明する。
- `check_syntax()`の成功を、コンパイル・推定・モデル妥当性の成功と同一視する。
- `N`を手入力し、データ行数が変わっても更新しない。
- Rの列名とStanのデータ名が自動で対応すると考える。
- 欠損値や無限大を、原因を記録せず機械的に置換する。
- 実行ファイルやdrawだけを残し、データ・コード・版・seedを記録しない。

## 内容理解問題

問題の正本は`foundation-assessments.json`です。

1. `stan-l34-q1-responsibility`: 実行経路の処理をR・CmdStanR・stanc3・CmdStanへ分類する。
2. `stan-l34-q2-contract`: `N`とベクトル長の不一致を実行前に予測する。
3. `stan-l34-q3-repair-list`: 壊れた名前付きlistを契約表から修正する。
4. `stan-l34-q4-syntax-meaning`: 構文確認の成功が保証する範囲を区別する。
5. `stan-l34-q5-transfer-binomial`: 二項データへ名前・型・大きさ・値域の契約を移す。

選択問題への正答だけではL34を実践済みにしません。実行経路図、データ契約表、契約違反の修正記録を直接証拠として残します。

## 直接評価

1. R、CmdStanR、stanc3、C++ツールチェーン、CmdStan、出力CSVの関係を矢印付きで説明する。
2. Rの値とStanの`data`宣言を、名前・型・大きさ・制約で対応付ける。
3. 意図的な長さ不一致を実行前に予測し、エラー発生地点と修正対象を説明する。
4. 未見の二項データで、整数型と`0 <= successes <= trials`を含む契約を作る。

## 公式資料

- [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html)
- [CmdStanR: `cmdstan_model()`](https://mc-stan.org/cmdstanr/reference/cmdstan_model.html)
- [CmdStanR: `$check_syntax()`](https://mc-stan.org/cmdstanr/reference/model-method-check_syntax.html)
- [CmdStanR: `$compile()`](https://mc-stan.org/cmdstanr/reference/model-method-compile.html)
- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)

最終確認日: 2026-08-09。
