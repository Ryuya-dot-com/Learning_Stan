# L40 悪い幾何をモデル側から直す

> このレッスンはStanベータ編の一部です。L38・L39で見つけた計算上の問題を、モデルの表現から改善します。

L38では、推定値より先にdivergence、E-BFMI、R-hat、ESS、MCSEを読みました。L39では、計算できたposteriorが観測データの重要な特徴を再現するかを検査しました。L40では、警告の原因が階層モデルの座標と尺度にあるとき、生成モデルを保ったまま探索しやすい表現へ書き換えます。

中心化表現と非中心化表現のどちらかを正解として暗記しません。弱い群情報ではnon-centeredが有利になりやすい一方、強い群情報ではcenteredが有利なこともあります。データ情報量、posteriorの幾何、診断、Monte Carlo精度、計算時間を同じ比較へ結びます。

## このレッスンのゴール

終了時には、次のことができるようになります。

1. 階層標準偏差`tau`が0へ近づくときに生じるfunnelと、HMCのdivergence・小さいstep size・長いtrajectoryの関係を説明する。
2. centered表現を`z ~ std_normal()`と`theta = mu + tau * z`を使うnon-centered表現へ書き換える。
3. 2つの表現が同じ階層分布を表すことを、条件付き分布とStanコードから確認する。
4. 弱い群情報と強い群情報の両条件で、divergence、E-BFMI、treedepth、R-hat、ESS、MCSE、ESS/secを比較する。
5. 再パラメータ化、尺度の標準化、priorの変更、制約・切断・打ち切りを区別する。
6. `adapt_delta`だけで警告を消すのではなく、原因仮説、変更、同値性、診断、予測を追跡可能な記録として残す。

### このレッスンで作るもの

- funnelとcentered/non-centeredの同値性を数式・コードで説明したレビュー
- centered表現をnon-centeredへ直し、弱い群情報と強い群情報で診断を比較するデバッグ記録
- 未見のvarying-slopeモデルについて、尺度、parameterization、prior、予測を分離した転移レビュー

比較前の原因予測、初回コード、初回診断、修正版、再診断、実行時間、判断を上書きせず保存します。どの変更が診断の改善につながったかを後から説明できる形にしましょう。

## 1. 階層モデルは群を部分的にまとめる

群 \(j=1,\ldots,J\) の平均を \(\theta_j\)、全体平均を \(\mu\)、群間標準偏差を \(\tau\) とする階層正規モデルを考えます。

\[
y_n \sim \operatorname{Normal}(\theta_{g[n]},\sigma_y),
\qquad
\theta_j \sim \operatorname{Normal}(\mu,\tau).
\]

`theta[j]`を各群で完全に別々に推定するのではなく、`mu`と`tau`を通じて情報を共有します。データが少ない群は全体平均へ強く縮約され、情報が多い群はその群のデータを強く反映します。

centered表現では、数式をほぼそのままStanへ書きます。

```stan
data {
  int<lower=1> N;
  int<lower=1> J;
  array[N] int<lower=1, upper=J> group;
  vector[N] y;
}
parameters {
  real mu;
  real<lower=0> tau;
  vector[J] theta;
}
model {
  mu ~ normal(0, 2);
  tau ~ normal(0, 1);
  theta ~ normal(mu, tau);
  y ~ normal(theta[group], 1);
}
```

このコードは正しいStan構文であり、centeredを常に誤りとは呼びません。問題は、特定のデータ条件でこの座標がHMCにとって探索しにくくなることです。

## 2. funnelは尺度によって曲率が大きく変わる

`tau`が大きいと、`theta`は`mu`から広い範囲へ動けます。`tau`が0へ近づくと、すべての`theta[j]`は`mu`のすぐ近くへ押し込まれます。joint posteriorは、広い部分と非常に細い首を持つfunnel状になり得ます。

```text
tauが大きい領域: thetaの許される幅が広い
             \\       /
              \\     /
               \\   /
tauが小さい領域: \\_/  thetaがmu付近へ集中
```

HMCは1本のtrajectoryで同じmass matrixとstep sizeを使います。広い領域に合う大きなstep sizeでは細い首を正確に積分しにくく、数値積分誤差が大きくなるとdivergenceが起こり得ます。首に合う小さなstep sizeでは、広い領域を進むために多くのleapfrog stepが必要になり、最大treedepth到達や低いESS/secにつながることがあります。

divergenceは「値が大きすぎるparameterを制約すればよい」という単純な範囲問題ではありません。posteriorの場所ごとに曲率と尺度が大きく違うという幾何の問題です。散布図では、divergent transitionを`tau`と`theta[j] - mu`、または`tau`と標準化した群効果へ重ね、細い領域へ集中していないか確認します。

## 3. non-centered表現は標準正規の座標を探索する

標準正規変数 \(z_j\) を導入します。

\[
z_j\sim\operatorname{Normal}(0,1),
\qquad
\theta_j=\mu+\tau z_j.
\]

すると、\(\mu,\tau\)を固定した条件付き分布は

\[
\theta_j\mid\mu,\tau
\sim\operatorname{Normal}(\mu,\tau)
\]

となり、元の階層分布を保ちます。Stanでは次のように書けます。

```stan
data {
  int<lower=1> N;
  int<lower=1> J;
  array[N] int<lower=1, upper=J> group;
  vector[N] y;
}
parameters {
  real mu;
  real<lower=0> tau;
  vector[J] z;
}
transformed parameters {
  vector[J] theta = mu + tau * z;
}
model {
  mu ~ normal(0, 2);
  tau ~ normal(0, 1);
  z ~ std_normal();
  y ~ normal(theta[group], 1);
}
```

samplerが直接探索する群効果は`theta`ではなく、尺度をそろえた`z`です。`tau`が小さいときも`z`自体は標準正規の尺度に留まるため、弱い群情報でfunnelの強い依存を和らげられることがあります。

### この書換えではmanual Jacobianを足さない

上のコードは、`z`をprimitive parameterとして`z ~ std_normal()`を定義し、`theta`を決定的に導出する生成的な書換えです。`z`上の標準正規分布を`theta = mu + tau * z`で押し出すと、意図した`theta | mu, tau`の正規分布になります。この構成へさらにmanual Jacobianを足すと、同じ分布を二重に調整して別のtargetにしてしまいます。

これは「変数変換ならJacobianは常に不要」という意味ではありません。探索変数`log_sigma`から`sigma = exp(log_sigma)`を作り、`sigma`尺度の密度を`target`へ直接加えるような一般の変数変換では、密度を置く尺度と変換を追い、必要なJacobian調整を入れます。Stanがparameter制約のために自動適用する変換、生成的non-centering、手動で書く密度変換を分けます。

## 4. 同じモデルを保てているかを照合する

再パラメータ化の比較では、「警告が減った」より前に、比較対象が同じモデルか確認します。

| 照合項目 | centered | non-centered | 保つもの |
|---|---|---|---|
| 全体平均 | `mu ~ normal(0, 2)` | 同じ | `mu`のprior |
| 群間尺度 | `tau ~ normal(0, 1)` | 同じ | `tau`のpriorと支持範囲 |
| 群効果 | `theta ~ normal(mu, tau)` | `z ~ std_normal()`、`theta = mu + tau * z` | impliedな`theta | mu, tau` |
| 観測モデル | `y ~ normal(theta[group], 1)` | 同じ | likelihood |
| 保存量 | `mu, tau, theta` | `mu, tau, theta`を保存 | model-scaleの比較対象 |

posterior drawが有限なので、同じモデルでも表現間の要約は完全一致しません。`mu`、`tau`、`theta`、関心のある予測量について、平均や分位点の差を対応するMCSEと比べます。事後予測チェックも同じ観測統計量で行います。

次を変えたなら、純粋な再パラメータ化ではありません。

- `tau ~ normal(0, 1)`を`tau ~ exponential(2)`へ変える。
- 観測標準偏差を1に固定していたモデルから未知parameterへ変える。
- 群効果分布を正規からStudent-tへ変える。
- ある群や観測を削除する。
- 尤度の切断・打ち切りを追加または削除する。

これらが必要な修正である可能性はありますが、「座標だけを変えた比較」とは別に評価します。

## 5. centeredとnon-centeredの選択はデータ条件に依存する

non-centeredは常に速いわけではありません。

### 弱い群情報

群当たり観測数が少ない、観測ノイズが大きい、または`tau`が0付近も十分あり得るとき、各`theta[j]`はデータより階層priorの影響を強く受けます。この条件ではcentered座標の`theta`と`tau`が強く結び付きやすく、non-centeredが有利になりやすいです。

### 強い群情報

群当たり観測数が多く、観測ノイズが小さく、各`theta[j]`をデータがよく識別するとき、`theta`を直接探索するcentered表現が効率的なことがあります。non-centeredでは、よく識別された`theta`を作るために`mu`、`tau`、`z`が相関し、かえって探索しにくくなることがあります。

| データ条件 | 最初に試す候補 | 断定せず確認するもの |
|---|---|---|
| 群当たり観測が少ない・ノイズが大きい | non-centered | funnel位置のdivergence、E-BFMI、ESS/sec |
| 群当たり観測が多い・ノイズが小さい | centeredも有力 | parameter別bulk/tail ESS、MCSE、時間 |
| 群ごとの情報量が大きく異なる | 部分的・混合parameterizationも検討 | どの群が依存と警告を作るか |

「階層モデルだからnon-centered」「divergenceが0だからcentered」という一行規則にはしません。実際のposteriorと計算予算に対して比較します。

## 6. adapt_deltaは診断への応答であって原因説明ではない

`adapt_delta`を高くすると、samplerはより小さいstep sizeを選びやすくなります。その結果、divergenceが減る場合があります。しかし、次の理由から最初の唯一の修正にはしません。

1. funnelの存在や尺度不一致を説明しない。
2. 1 transitionあたりの計算量が増え、ESS/secが悪化し得る。
3. 極端な曲率では、設定変更だけで十分に探索できないことがある。
4. 警告0件でも、重要なtailのESSやMCSEが不十分なことがある。

実務では、既定設定の診断から原因仮説を立て、再パラメータ化や標準化を比較し、それでも少数のdivergenceが残る場合に`adapt_delta`変更を根拠付きで試します。設定を変えたら、divergence件数だけでなくstep size、treedepth、leapfrog数、実行時間、ESS/secも再確認します。

## 7. 比較プロトコルを先に固定する

centered/non-centeredを比べるときは、少なくとも次をそろえます。

1. 同じ合成データまたは同じ固定入力を使う。
2. `mu`、`tau`、impliedな`theta`、尤度、保存する予測量を同じにする。
3. chain数、warmup、sampling、seed方針、初期値方針を記録する。
4. CSVと成果物を表現別の出力先へ保存する。
5. 弱い群情報と強い群情報の2条件を用意する。
6. 同じparameterと予測量のposterior要約をMCSE込みで比べる。
7. divergence、最大treedepth、E-BFMI、R-hat、bulk/tail ESS、MCSE、実行時間、ESS/secを比べる。

ESS/secは単なるESSの大きさと違い、計算時間を含む効率指標です。ただし、短い試行runの偶然やマシン負荷に左右されます。複数回の時間計測、同じ環境、同じ並列条件を使い、わずかな差を一般則にしません。

```r
model_parameters <- c("mu", "tau", "theta[1]")

centered_summary <- centered_fit$summary(model_parameters)
noncentered_summary <- noncentered_fit$summary(model_parameters)

centered_diagnostics <- centered_fit$diagnostic_summary()
noncentered_diagnostics <- noncentered_fit$diagnostic_summary()

# 実測時はelapsed timeを同じ方法で保存する。
# posterior::ess_bulk(draws) / elapsed_seconds など、定義も記録する。
```

この断片は比較項目の設計例であり、下の仮想診断の数値を生成した実行コードではありません。
続く実測では、固定入力、全chainのCSV、3回の時間計測、モデル尺度の同値性表、2図を一つの出力先へ保存する完全な実行スクリプトを使います。

## 8. 仮想診断を正しく読む

次は判断練習用の仮想診断です。リポジトリに保存された実測値ではありません。

### 仮想ケースA: 弱い群情報

| 表現 | divergence | 最大treedepth到達 | E-BFMI最小 | `tau` bulk ESS | ESS/sec |
|---|---:|---:|---:|---:|---:|
| centered | 37 | 8 | 0.18 | 92 | 3.1 |
| non-centered | 0 | 0 | 0.74 | 1,480 | 41.2 |

この仮想ケースでは、同じmodel-scale要約とPPCがMCSE内で整合することを確認したうえで、弱い群情報に対してnon-centeredを選ぶ根拠があります。centeredの37 divergenceを「全drawの0.5%未満だから無視」とはしません。

### 仮想ケースB: 強い群情報

| 表現 | divergence | 最大treedepth到達 | E-BFMI最小 | `tau` bulk ESS | ESS/sec |
|---|---:|---:|---:|---:|---:|
| centered | 0 | 0 | 0.83 | 2,120 | 63.5 |
| non-centered | 0 | 0 | 0.79 | 1,060 | 28.4 |

両表現に明らかな警告がなく、model-scaleのposteriorもMCSE内で整合するなら、この仮想ケースではcenteredを選ぶことが合理的です。「L40でnon-centeredを学んだから」という理由で遅い方を選ぶ必要はありません。

## 9. 教材で実測した範囲

比較に使ったcentered表現とnon-centered表現は、stanc3 2.39.0の`--warn-pedantic`で構文成功・警告0件を確認しています。実行時には、使用したソースと入力が途中で変わっていないことも内容指紋で照合しました。

2026-08-09には、R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0、Darwin arm64、Apple clang 21.0.0で両表現を実測しました。弱情報は8群・各1観測・真の`tau=0.1`、強情報は8群・各30観測・真の`tau=1`です。両条件・両表現へ同じ`adapt_delta=0.9`、warmup 1,000、sampling 1,000、4 chainを適用し、実行順を交互にした3反復を行いました。

| 条件 | 表現 | divergence合計 | 最大treedepth合計 | E-BFMI最小 | R-hat最大 | bulk ESS最小 | `tau` bulk ESS/sec中央値 |
|---|---|---:|---:|---:|---:|---:|---:|
| 弱情報 | centered | 235 | 0 | 0.173 | 1.088 | 41 | 341 |
| 弱情報 | non-centered | 0 | 0 | 0.823 | 1.003 | 2,288 | 16,233 |
| 強情報 | centered | 0 | 0 | 0.941 | 1.003 | 3,699 | 27,624 |
| 強情報 | non-centered | 0 | 0 | 0.625 | 1.014 | 604 | 3,500 |

診断値は性能runの3反復・計48 chain行をすべて集約し、E-BFMI・ESSには最小、R-hatには最大を使っています。弱情報ではnon-centeredがdivergenceを235から0へ減らし、`tau`のESS/sec中央値は約48倍でした。強情報ではcenteredが全反復で主要診断を通り、`tau`のESS/sec中央値は約8倍でした。強情報non-centeredのR-hat最大1.014も、表現をデータ条件から選ぶ理由の一部です。短い小規模モデルの時間はマシン負荷に依存するため、倍率を一般的な定数とはみなしません。

さらに、同じ固定データで`adapt_delta=0.99`、4 chain、sampling 2,000の同値性runを別に実行しました。`mu`、`tau`、`theta[1:8]`の20比較はすべて平均差が4 combined MCSE以内で、最大は0.886 MCSEでした。ただし弱情報centeredにはなお146 divergenceが残りました。したがって、平均の近さだけでcenteredの探索を正当化せず、数式上の同値性と診断良好なnon-centered runを合わせて判断します。

実測では、数値結果だけでなく、使用したソースと入力の内容指紋、環境、12個の成果物、解釈上の限界も一緒に記録しました。前節のケースA・Bは判断練習用の仮想診断であり、この実測表とは混ぜません。実測は固定した小規模正規random-interceptモデル1種での確認なので、varying slope、相関構造、未知の観測誤差や別環境へそのまま一般化はできません。

## 10. 標準化はpriorと報告尺度まで含めて設計する

予測子の桁が大きく異なると、係数やinterceptのposterior尺度も大きく異なり、探索効率が悪くなることがあります。連続予測子を

\[
x_{n,\mathrm{std}}=\frac{x_n-\bar{x}}{s_x}
\]

へ標準化すれば、典型的な変化が1程度の尺度になります。Stanの`transformed data`で平均・標準偏差を計算することも、R側で固定してdataとして渡すこともできます。どちらの場合も、ゼロ分散と欠測を事前に検査し、使った中心・尺度を保存します。

ただし、`x`尺度での傾き`beta_raw`と標準化尺度での傾き`beta_std`は数値が違います。

\[
\beta_{\mathrm{raw}}=\frac{\beta_{\mathrm{std}}}{s_x}.
\]

標準化後も同じ数値のpriorを機械的に置けば、元尺度上では別の事前分布になることがあります。prior predictive checkをやり直し、`generated quantities`などで研究者が解釈する元尺度へ戻して報告します。標準化は計算改善になり得ますが、prior尺度と解釈を含めて初めてモデルを保てます。

## 11. 制約・切断・打ち切りを再パラメータ化と混ぜない

| 操作 | 何を表すか | 通常、同じモデルか |
|---|---|---|
| parameter制約 | parameterの支持範囲と内部座標変換 | 宣言どおりのモデルを実装する仕組み |
| non-centering | 同じ階層分布を別の探索座標で表す | prior・尤度を保てば同じ |
| 標準化 | 変数の単位を変えて表す | priorと逆変換を整合させれば同じ意味を保てる |
| 切断 | 範囲外の値が標本に現れない条件付き分布 | 通常尤度とは異なる |
| 打ち切り | 範囲外だった事実は分かるが値自体は境界として記録される観測過程 | 通常・切断尤度とは異なる |

観測値に`<lower=0>`を付けても、範囲外の観測が捨てられた切断過程の正規化項は自動では入りません。上限で記録された値を普通の連続値として扱えば、打ち切り過程も表せません。警告を減らす目的で支持範囲、尤度、採用規則を変更するなら、それは別モデルとして事前予測・事後予測・感度分析を行います。

## 12. 修正の判断順序を固定する

```text
run・data・source・chain設定を確認
  ↓
divergence、E-BFMI、treedepth、R-hat、ESS、MCSEを確認
  ↓
問題parameterとdivergent transitionの位置を可視化
  ↓
funnel、尺度差、識別不足という原因仮説を立てる
  ↓
同じ生成モデルを保つparameterizationまたは尺度変換を設計
  ↓
prior・likelihood・implied parameter分布を数式で照合
  ↓
同じデータ条件で複数chainを再実行
  ↓
診断、MCSE、ESS/sec、posterior、PPCを比較
  ↓
採用理由と証拠限界を記録
```

良好な計算診断は、指定したtargetを探索できたという証拠です。観測分布、prior、切断・打ち切り、予測妥当性の正しさは、L36とL39の検査へ戻って別に確認します。

## 13. 6回の練習で再パラメータ化を身につける

### 1回目: 読む・予測する

centeredコードを読み、`tau`が0へ近づくと`theta`の許される幅がどう変わるか、どのparameter間に依存が生じるかを実行前に予測します。

### 2回目: 穴埋めする

```stan
parameters {
  real mu;
  real<lower=0> tau;
  vector[J] _____;
}
transformed parameters {
  vector[J] theta = _____ + _____ * z;
}
model {
  z ~ _____();
}
```

### 3回目: 一部を変える

群当たり観測数または観測ノイズを一つだけ変え、どちらのparameterizationが有利になると予測するかを理由付きで記録します。

### 4回目: エラーを直す

non-centeredコードへ`theta ~ normal(mu, tau)`も残して二重にpriorを加えた例、または`theta = mu + z`として`tau`を落とした例を修正します。構文エラーではなく、implied分布が変わる意味上のエラーとして説明します。

### 5回目: 見本なし

完成例を閉じ、centeredモデルをnon-centeredへ白紙で書き換えます。`z`のprior、`theta`の変換、元のlikelihood、model-scaleの保存量まで再現します。

### 6回目: 別文脈へ移す

L41後、random interceptとvarying slopeを持つ未見モデルへ移します。interceptとslopeの相関構造を保ったnon-centered化、予測子の標準化、元尺度への戻し方、弱い群情報と強い群情報の比較を設計します。

## よくある誤り

1. **centeredを常に誤りとする**
   データが群効果を強く識別する条件では、centeredの方が効率的なことがあります。

2. **non-centeredなら同じモデルだと自動的に考える**
   `z`の分布、`theta`の変換、`mu`・`tau`のprior、likelihoodをすべて照合します。

3. **生成的non-centeringへmanual Jacobianを加える**
   `z ~ std_normal()`から`theta`を導出する構成では追加しません。一般の密度変換とは分けます。

4. **divergence件数だけを比較する**
   E-BFMI、treedepth、R-hat、bulk/tail ESS、MCSE、時間、ESS/sec、divergent位置を合わせて読みます。

5. **adapt_deltaを上げて警告が消えれば原因解決とする**
   step sizeと計算量も確認し、funnelや尺度差という原因仮説を残します。

6. **posterior要約の差をすべてモデル変更と考える**
   有限drawのMonte Carlo差をMCSEと比べ、同じmodel-scale量と予測量で照合します。

7. **標準化後もpriorの数値をそのまま使う**
   priorの意味が元尺度で変わっていないか確認し、prior predictive checkをやり直します。

8. **parameter制約で切断・打ち切りを表したことにする**
   parameterの内部変換と観測過程の尤度は別です。

9. **構文成功を推定性能の証拠とする**
   構文確認はコードの文法と型を、複数chainの実測は指定条件での探索結果を確かめます。それぞれが答える問いを分けます。

10. **仮想診断を実測値として引用する**
    教材内のケースA・Bは判断練習用です。第9節の保存runと明示的に分けます。

## 内容理解問題

回答は`foundation-assessments.json`に対応します。選択問題は選択肢をシャッフルし、初回回答をフィードバック前に保存します。

1. `stan-l40-q1-weak-groups`: 弱い群情報のfunnelへ、適切な最初の修正と比較を選べるか。
2. `stan-l40-q2-implied-distribution`: `z`から作る`theta`の条件付き分布と同値性を予測できるか。
3. `stan-l40-q3-rewrite-noncentered`: centeredコードをnon-centeredへ直し、Jacobian境界を説明できるか。
4. `stan-l40-q4-strong-groups`: 強い群情報でcenteredが効率的な仮想診断を限定付きで判断できるか。
5. `stan-l40-q5-transfer-varying-slope`: varying-slopeモデルへ尺度・幾何・同値性・診断比較を移せるか。

理解問題は形成的支援です。修得の直接証拠には、初回コード、実際の複数chain出力、比較表、model-scaleの同値性確認、修正理由が必要です。

## 直接評価

### A. funnelと同値性の説明

centeredとnon-centeredのコードを並べ、`tau`が小さいときの`theta`の幅、標準正規`z`への移動、impliedな`theta | mu, tau`を数式で説明します。

合格の観点:

- funnelを単なるparameter範囲ではなく、場所により曲率と尺度が変わるjoint geometryとして説明する。
- `z ~ std_normal()`と`theta = mu + tau * z`から元の条件付き分布を導く。
- 生成的non-centeringと一般のJacobian調整を区別する。
- centeredを常に誤りと呼ばない。

### B. centered/non-centeredのデバッグ比較

`mr03-centered.candidate.stan`をnon-centeredへ書き換え、弱い群情報と強い群情報の固定データを各表現で複数chain実行します。

合格の観点:

- `mu`・`tau`のprior、impliedな`theta`分布、likelihoodを保つ。
- 表現と条件ごとに出力先を分け、source、data、seed、chain、iteration、時間を保存する。
- divergence、E-BFMI、treedepth、R-hat、bulk/tail ESS、MCSE、ESS/secを比較する。
- `mu`、`tau`、`theta`、予測量がMCSE内で整合するか確認する。
- 仮想診断と新たな実測結果を混ぜず、採用判断をデータ条件へ限定する。

### C. varying-slopeへの転移レビュー

未見の参加者内データについて、相関したrandom intercept・varying slopeを持つモデルのparameterizationを設計します。

合格の観点:

- 相関行列と群間尺度を保った標準正規ベクトルから群効果を構成する。
- 予測子の標準化に使う中心・尺度を保存し、priorと係数を元尺度へ対応させる。
- 群情報の弱い条件と強い条件を作り、事前に有利な表現を予測する。
- 計算診断だけでなく、model-scaleのposteriorと事後予測の同値性を確認する。
- 観測過程やpriorを変える提案は、純粋な再パラメータ化と別のモデル比較として扱う。

## 公式資料

- [Stan User's Guide: Reparameterization and Change of Variables](https://mc-stan.org/docs/stan-users-guide/reparameterization.html)
- [Stan User's Guide: Standardizing Predictors and Outputs](https://mc-stan.org/docs/stan-users-guide/efficiency-tuning.html#standardizing-predictors-and-outputs)
- [Stan Reference Manual: Hamiltonian Monte Carlo](https://mc-stan.org/docs/reference-manual/mcmc.html)
- [CmdStan Guide: Diagnose utility](https://mc-stan.org/docs/cmdstan-guide/diagnose_utility.html)
- [Stan Reference Manual: Posterior Analysis](https://mc-stan.org/docs/reference-manual/analysis.html)

L40を終えたら、centeredとnon-centeredのどちらかを無条件に選ぶのではなく、群ごとの情報量を変えて診断、MCSE、ESS/secを比べてみてください。表現を変えても同じ生成モデルを保てているか、数式と事後予測の両方から説明しましょう。
