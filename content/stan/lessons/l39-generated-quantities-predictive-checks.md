# L39 generated quantitiesでモデルを検査・比較する

状態: 非公開ドラフト（`draft-unpublished`）

L38では、推定値の前にHMC診断、R-hat、ESS、MCSEを読み、指定した`target`を計算上信頼してよいか判断しました。L39では、その`target`が観測データの重要な特徴を再現できるかを`y_rep`で調べ、比較可能な候補モデルだけを観測別`log_lik`とPSIS-LOOで比べます。

計算診断、事後予測チェック、モデル比較は別の問いです。警告のないrunでもデータ生成過程を外し得ます。事後予測がよく見えても将来予測や因果効果が正しいとは限りません。LOOで1位でも候補集合の外により適切なモデルがあり得ます。この境界を保ったまま、StanとRの成果物を1つの判断へ結びます。

## このレッスンのゴール

終了時には、次のことができるようになります。

1. `generated quantities`が各posterior drawの後に実行され、そこで作る量がsampling済みparameterを変えないことを説明する。
2. `y_rep`、観測済み`y`に対する`log_lik`、未観測データへのpredictionを区別する。
3. 観測値と複製データへ同じ統計量を適用し、全体適合と条件付き適合を分けて事後予測チェックする。
4. PSIS-LOOの列を将来の予測課題に対応する除外単位へそろえる。
5. Pareto kをELPD順位より先に読み、`elpd_diff`と`se_diff`を一緒に解釈する。
6. stacking weightやLOO順位を、posterior model probability、モデルの真実性、因果同定の証拠と呼ばない。

### 作る証拠

- 観測統計量と同じ統計量を各`y_rep`へ適用した事後予測チェック表・図
- 壊れたpointwise `log_lik`を、予測単位を根拠に修正したデバッグ記録
- 未見の反復測定データについて、予測対象、分割単位、PPC、PSIS診断、比較判断を分けたレビュー

自己採点だけで修得とは判定しません。チェック前に選んだ統計量、初回の図、比較対象、除外単位、診断、判断、修正版を上書きせず残します。

## 1. generated quantitiesはposterior drawの後に実行される

`generated quantities`は、各sampleが得られた後に1回実行されます。data、transformed data、parameters、transformed parametersで宣言された非ローカル変数を参照でき、ここで宣言した値はdrawとともに保存されます。

```stan
generated quantities {
  vector[N] log_lik;
  vector[N] y_rep;

  for (n in 1:N) {
    log_lik[n] = normal_lpdf(y[n] | mu[n], sigma);
    y_rep[n] = normal_rng(mu[n], sigma);
  }
}
```

2行は似た引数を使いますが、役割が違います。

| 量 | 入力する応答 | 返すもの | 主な用途 |
|---|---|---|---|
| `log_lik[n]` | 実際に観測した`y[n]` | その観測の対数密度 | LOOなどの予測比較 |
| `y_rep[n]` | 観測値を入れない | fitted modelからの複製観測 | 事後予測チェック |

`generated quantities`内の計算は、すでに得たparameter drawの重みや位置を変更しません。そこで`log_lik`や`y_rep`を作り忘れても、元のposterior drawが別の分布へ変わるわけではありません。ただし、検査・比較に必要な量が保存されていなければ、Stanコードを更新して再実行するか、同じmodel・data・drawにstand-alone generated quantitiesを適用する必要があります。

sampling中の対数密度評価に不要な出力量を`transformed parameters`へ置くと、leapfrog中に繰り返し計算されます。推定へ影響せずdraw後だけ必要な量は、通常`generated quantities`へ置く方が効率的です。

## 2. y_repは観測過程をもう一度実行した複製である

観測データを (y)、parameterを \(\theta\)、同じ観測設計で生成する複製データを \(y^{\mathrm{rep}}\) とします。事後予測分布は次です。

\[
p(y^{\mathrm{rep}}\mid y)
=\int p(y^{\mathrm{rep}}\mid\theta)
       p(\theta\mid y)\,d\theta.
\]

各posterior draw \(\theta^{(s)}\) について、Stanの`_rng`関数で \(y^{\mathrm{rep},(s)}\) を1組生成します。回帰モデルの事後予測チェックでは、原則として観測時と同じ予測子`x`を使います。

```stan
generated quantities {
  vector[N] y_rep;
  for (n in 1:N) {
    y_rep[n] = normal_rng(alpha + beta * x_centered[n], sigma);
  }
}
```

これは「posterior平均のparameterを1組だけ代入した予測」ではありません。parameter不確実性と新しい観測ノイズの両方を含む複製を、drawごとに保存します。

### 事後予測チェックと新規データ予測を分ける

- 事後予測チェック: 観測時と同じ`x`・観測設計で、モデルが`y`の重要な特徴を再現するか調べる。
- 新規データ予測: 新しい`x_new`や新しいgroupについて、まだ見ていない応答を予測する。

どちらもposterior predictive distributionを使えますが、問いとdataブロックが違います。観測済み`x`で作った`y_rep`を、そのまま別の母集団への外挿性能の証拠にはしません。

### prior predictiveとの違い

prior predictive checkは観測`y`で条件付ける前に、事前分布がどのようなデータを生成するか調べます。posterior predictive checkは観測`y`で更新した後です。事後予測だけでは、極端に不自然な事前分布がデータによって上書きされて見えにくくなることがあります。

## 3. 同じ統計量を観測値と複製へ適用する

事後予測チェックは「2本の線が似ている気がする」で終わりません。研究上重要な統計量 \(T(y)\) をチェック前に決め、各複製に同じ関数 \(T(y^{\mathrm{rep},(s)})\) を適用します。

単回帰fitから`y_rep`を取り出す例です。

```r
y_rep <- fit$draws("y_rep", format = "matrix")

observed_stats <- c(
  mean = mean(study$y),
  sd = sd(study$y),
  maximum = max(study$y)
)

replicated_stats <- data.frame(
  mean = rowMeans(y_rep),
  sd = apply(y_rep, 1, sd),
  maximum = apply(y_rep, 1, max)
)

predictive_intervals <- apply(
  replicated_stats,
  2,
  quantile,
  probs = c(0.05, 0.50, 0.95)
)

observed_stats
predictive_intervals
```

たとえば観測SDが複製SDのほぼ全drawより大きいなら、一定の`sigma`、外れ値、非線形性、group差など、過小分散を生む仮定を調べます。ただし、1つの不一致から修正案を自動決定はできません。

### 全体平均だけでは回帰形状を検査できない

二値回帰で観測成功率と複製成功率の全体平均が一致しても、`x`に沿った曲率を外していることがあります。予測子を意味のある区間へ分け、条件付き成功率も確認します。

```r
y_rep <- fit$draws("y_rep", format = "matrix")

x_breaks <- quantile(
  study$x,
  probs = seq(0, 1, length.out = 6),
  names = FALSE
)
x_bin <- cut(study$x, breaks = unique(x_breaks), include.lowest = TRUE)

observed_by_bin <- tapply(study$y, x_bin, mean)

replicated_by_bin <- sapply(
  levels(x_bin),
  function(bin) rowMeans(y_rep[, x_bin == bin, drop = FALSE])
)

observed_by_bin
apply(replicated_by_bin, 2, quantile, probs = c(0.05, 0.50, 0.95))
```

同じデータを見て統計量を選ぶため、posterior predictive checkは機械的な合否検定ではありません。何を再現でき、何を再現できず、どの仮定へ戻るかを明示するモデル批判です。多数の統計量から都合のよいものだけを報告しません。

## 4. log_likは観測済み応答のpointwise対数尤度である

観測 \(i\) とposterior draw \(s\) ごとの対数尤度を次のように保存します。

\[
\ell_i^{(s)}=\log p(y_i\mid\theta^{(s)}).
\]

Bernoulli-logitモデルなら次です。

```stan
generated quantities {
  vector[N] log_lik;
  array[N] int y_rep;

  for (n in 1:N) {
    log_lik[n] = bernoulli_logit_lpmf(y[n] | eta[n]);
    y_rep[n] = bernoulli_logit_rng(eta[n]);
  }
}
```

`log_lik[n]`へ全データの尤度を繰り返し入れる次のコードは、型も長さも正しく、コンパイルできます。しかし観測1件を外すLOOの列を作れていません。

```stan
for (n in 1:N) {
  log_lik[n] = bernoulli_logit_lpmf(y | eta); // 誤り: 全尤度をN回複製
}
```

修正時には、配列長ではなく「列nが何を除外するか」を説明します。pointwise `log_lik`の総和は、正規化された観測尤度の総和になります。priorやJacobianを含むStanの`target`全体、または`~`が省く定数まで含めた数値と同一だとは限りません。

## 5. pointwiseの単位は予測課題から決める

1行が独立な観測で、将来も同じ種類の1行を予測するなら、`log_lik[n]`の1列を1行へ対応させるのが自然です。しかし、データファイルの1行が常に予測単位とは限りません。

| 目的 | 除外単位の候補 | 注意点 |
|---|---|---|
| 同じ母集団の新しい独立観測 | 1観測 | 条件付き独立の仮定を確認する |
| 既存参加者の新しい測定 | 参加者内の測定または時点 | 同じ参加者の情報を学習に残す課題 |
| 新しい参加者 | 参加者group | 参加者全体を学習から外す |
| 時系列の未来 | 時間順のholdout | 通常のランダムな1行LOOで未来情報を漏らさない |

新しい参加者を予測したいのに測定1行だけを外すと、同じ参加者の別測定からrandom effectを学習できます。それは「既存参加者の追加測定」に近い別の課題です。groupごとに対数尤度をまとめるだけでPSIS近似が必ず安定するわけでもないため、group K-foldなどの分割方法も検討します。

モデルAとBで、列数が同じでも観測順や欠測除外行が違えば比較できません。次を記録します。

1. 応答と観測集合が同じか。
2. 列`n`が同じ対象を表すか。
3. 除外単位が予測目的と一致するか。
4. 時系列・空間・group依存を学習側へ漏らしていないか。

## 6. RでPSIS-LOOを計算する

CmdStanRの`draws_array`はiteration × chain × 観測の形を保ちます。`loo()`はこの3次元配列、またはchainをまとめたdraw × 観測の行列を受け取ります。

```r
log_lik <- fit$draws("log_lik", format = "draws_array")

r_eff <- loo::relative_eff(exp(log_lik))

loo_result <- loo::loo(
  log_lik,
  r_eff = r_eff,
  cores = 4
)

print(loo_result)
loo::pareto_k_table(loo_result)
```

`exp(log_lik)`は尤度スケールへ戻した値です。MCMC drawは独立ではないため、`relative_eff()`を渡してMCSE・ESSの推定へchainの自己相関情報を反映します。`r_eff`を省いたこと自体でELPDの期待値が別の量になるわけではありませんが、精度診断を適切に行うために計算します。

## 7. Pareto kをELPDより先に読む

PSIS-LOOは、全データposteriorを提案分布として、各観測を外したposteriorをimportance samplingで近似します。観測を外したときposteriorが大きく変わると、importance weightのtailが重くなり、近似が不安定になります。

現行`loo`の主要な診断線は、posterior sample size \(S\) に依存します。

\[
k_{\mathrm{threshold}}
=\min\left(1-\frac{1}{\log_{10}(S)},\,0.7\right).
\]

教材ケースの \(S=4\times750=3000\) では、sample-size部分が0.7を上回るため確認線は0.7です。これはすべてのrunで固定0.7という意味ではありません。

```r
sample_size <- dim(log_lik)[1] * dim(log_lik)[2]
pareto_threshold <- min(1 - 1 / log10(sample_size), 0.7)

pareto_k <- loo::pareto_k_values(loo_result)
which(pareto_k > pareto_threshold)
```

閾値超過があれば順位の断定を止め、次を調べます。

- 元データの入力ミス、外れた観測、極端な予測誤差。
- 尤度のtail、過分散、混合、非線形性などの誤指定。
- 観測を外すと事前分布の影響が強くなる弱識別。
- moment matching、該当観測の厳密なrefit、またはK-foldの必要性。

高Pareto kは「その観測を削除せよ」という命令ではありません。影響の大きい観測が正当なら、その観測を予測できないモデル側を調べます。

## 8. elpd_diffとse_diffを一緒に読む

同じ観測・同じ列対応・同じ除外単位を持つモデルだけを比較します。

```r
comparison <- loo::loo_compare(
  list(
    linear = loo_linear,
    quadratic = loo_quadratic
  )
)

print(comparison)
```

`loo_compare()`はELPDが最も大きいモデルを先頭に置き、そのモデル自身の`elpd_diff`を0にします。他モデルは通常、最良モデルとの差として負の値になります。

\[
\mathrm{elpd\_diff}_m
=\mathrm{elpd}_m-\max_j\mathrm{elpd}_j.
\]

`se_diff`は、2モデルの点別ELPD差から作るpairedな標準誤差です。各モデルのELPD標準誤差を単純に引いた値ではありません。差が`se_diff`と同程度なら順位は不確かです。何倍なら必ず採用という万能な検定線は置かず、データ数、pointwise差、予測目的、`diag_diff`、PPCも合わせます。

## 9. 実測済み二値回帰ケースを判断する

教材の`link-comparison-validation.json`は、同じ400観測へ線形logitと二次logitを当て、各4 chain、warmup 750、sampling 750で実行した証拠です。

| 項目 | 線形 | 二次 | 判断 |
|---|---:|---:|---|
| `elpd_loo` | -231.412 | -212.278 | 二次の方が大きい |
| `elpd_diff` | -19.134 | 0 | 線形は二次より低い |
| `se_diff` | 5.601 | 0 | 線形との差はこのケースでSEより十分大きい |
| Pareto k最大 | 0.022 | 0.158 | どちらも確認線0.7未満 |
| 閾値超過 | 0 | 0 | 保存runで明らかなPSIS警告なし |
| stacking weight | 0.0000003 | 0.9999997 | 候補予測分布の組合せ重み |

L38の計算診断も両モデルで確認済みです。さらに保存済み予測図では、posterior予測確率を合成時の既知の生成確率へ重ね、二次モデルが曲率を線形モデルよりよく表すことを確認しています。これは真値を知る合成校正であり、`y_rep`統計量によるPPCの保存証拠ではありません。`y_rep` PPCはL39の直接評価Aで別に作ります。したがって、既存証拠からは次のように限定して判断できます。

> この固定合成データ、同じ400観測を1件ずつ外す予測課題、比較した2候補の範囲では、明らかなsampling・PSIS警告なしに二次モデルの予測優位が観察された。

次の主張へは広げません。

- 二次モデルが真である確率は99.99997%である。
- 実データでも必ず二次モデルが優れる。
- 二次項が因果効果である。
- 他のリンク、交互作用、group構造、観測誤差を検討する必要がない。

## 10. stacking weightはモデル確率ではない

stackingは、候補モデルのLOO予測分布を組み合わせたときのlog scoreが高くなるよう、非負で総和1の重みを最適化します。

```r
weights <- loo::loo_model_weights(
  list(
    linear = loo_linear,
    quadratic = loo_quadratic
  ),
  method = "stacking"
)

weights
```

重み0.9は「そのモデルが真であるposterior probability 90%」ではありません。候補集合、観測集合、除外単位、log scoreのもとで予測分布をどう混ぜるかという値です。両候補が同じ欠点を持てば、stackingしてもその欠点が自動的に直るとは限りません。

## 11. 判断順序を固定する

L38からL39への順序は次です。

```text
run・data・source・chain設定を確認
  ↓
sampling diagnosticsを確認
  ↓
観測過程と同じy_repを生成
  ↓
事前に選んだT(y)をT(y_rep)と比較
  ↓
不一致をモデル仮定へ戻す
  ↓
予測対象と除外単位を定義
  ↓
モデル間の観測集合・列対応を確認
  ↓
pointwise log_likとr_effからPSIS-LOOを計算
  ↓
Pareto kを確認
  ↓
elpd_diff・se_diff・pointwise差を解釈
  ↓
候補集合内の限定した判断を書く
```

PPCとLOOは競合する採点法ではありません。PPCは各モデルが重要なデータ特徴を再現できない箇所を探し、LOOは定義した予測課題における候補間の相対予測性能を評価します。

## 12. 6回の接触で検査・比較を結ぶ

### 1回目: 読む・予測する

`generated quantities`の各行について、posteriorへ影響するか、観測値を入力するか、乱数を返すか、何に使うかをコード実行前に予測します。

### 2回目: 穴埋めする

```stan
generated quantities {
  vector[N] log_lik;
  vector[N] y_rep;
  for (n in 1:N) {
    log_lik[n] = normal_____(y[n] | mu[n], sigma);
    y_rep[n] = normal_____(mu[n], sigma);
  }
}
```

### 3回目: 一部を変える

全体平均だけのPPCへ、標準偏差、最大値、予測子区間ごとの条件付き平均を追加します。追加した統計量がどのモデル仮定に敏感か説明します。

### 4回目: エラーを直す

`log_lik[n] = bernoulli_logit_lpmf(y | eta)`を、観測nの除外単位に対応するコードへ直します。コンパイル成功と予測単位の正しさを分けて記録します。

### 5回目: 見本なし

完成例を閉じ、保存fitから`y_rep`と`log_lik`を抽出し、PPC、`relative_eff()`、`loo()`、Pareto k、比較表、限定付き判断を白紙で再現します。

### 6回目: 別文脈へ移す

L41後、参加者内反復測定へ移します。「既存参加者の次の測定」と「新しい参加者」を別の予測課題として、PPC統計量とholdout単位を設計します。単に行数が同じだから1行LOOを使うことはしません。

## よくある誤り

1. **generated quantitiesがposteriorを修正すると考える**
   このブロックは各drawの後に実行され、sampling済みparameterを再重み付けしません。

2. **log_likを乱数だと思う**
   `log_lik`は観測済み`y`の対数密度、`y_rep`は`_rng`で作る複製観測です。

3. **posterior平均parameterから予測を1組だけ作る**
   parameter不確実性を落とさず、各posterior drawから複製を作ります。

4. **全体平均が合えば回帰モデルも合うとする**
   予測子に沿う形、分散、tail、zero、group差など、研究上重要な条件付き特徴も確認します。

5. **PPCをp値1個の合否検定にする**
   どの特徴を再現できないかを探し、モデル仮定へ戻す診断として使います。

6. **全尤度をlog_likの全列へ複製する**
   配列長がNでも、列nが観測nの寄与でなければpointwise LOOではありません。

7. **ファイルの1行を常に除外単位にする**
   新しい参加者、未来時点、空間単位など、予測目的に合わせて分割します。

8. **Pareto kを見ずにELPD順位を読む**
   PSIS近似が不安定なら、精密な順位表示も信頼できません。

9. **elpd_diffだけを読み、se_diffを捨てる**
   点別差の不確実性と診断を一緒に報告します。

10. **LOOで1位ならモデルが真だと結論する**
    LOOは候補集合と予測課題に対する相対評価です。絶対適合や因果同定は別です。

11. **stacking weightをposterior model probabilityと呼ぶ**
    stackingは候補予測分布の組み合わせを最適化する重みです。

## 内容理解問題

回答は`foundation-assessments.json`に対応します。選択問題は選択肢をシャッフルして提示し、初回回答をフィードバック前に保存します。

1. `stan-l39-q1-generated-roles`: `log_lik`と`y_rep`の入力・出力・用途を区別できるか。
2. `stan-l39-q2-case-evidence`: PPC、Pareto k、ELPD差から実測ケースを限定付きで判断できるか。
3. `stan-l39-q3-repair-pointwise`: コンパイル可能だが誤った`log_lik`を予測単位から修正できるか。
4. `stan-l39-q4-pareto-before-rank`: 高Pareto kがある比較で順位の解釈を止められるか。
5. `stan-l39-q5-transfer-grouped`: 反復測定の予測対象へPPC・holdout・stackingの解釈を移せるか。

理解問題の正答は練習支援です。直接評価では、実際の配列形状、初回PPC、観測ID対応、PSIS診断、判断文を証拠にします。

## 直接評価

### A. 単回帰の事後予測チェック

L38で計算診断を確認した単回帰fitから`y_rep`を抽出し、観測値と同じ平均、SD、最大値、予測子区間別平均を計算します。

合格の観点:

- 各drawからの複製を使い、posterior平均parameterだけのplug-in予測にしない。
- 観測値と複製へ同じ統計量を適用する。
- チェック前に統計量と対応するモデル仮定を書く。
- 不一致がなくてもモデルが真だと断定しない。

### B. pointwise log_likのデバッグ記録

コンパイル可能な`mr05-aggregate-log-lik.candidate.stan`を確認し、全尤度をN回複製する問題を修正します。

合格の観点:

- candidateとreferenceがどちらも構文成功することを認める。
- 列nが除外する対象をコード修正前に定義する。
- `y[n]`と`eta[n]`の観測別寄与へ修正する。
- 配列長ではなく、観測ID・順序・総和・予測単位を検査する。

### C. 予測課題を変える転移レビュー

未見の参加者内反復測定について、「既存参加者の次の測定」と「新しい参加者」の2課題を設計します。

合格の観点:

- 2課題で学習側に残してよい情報を分ける。
- 応答分布とgroup構造に敏感なPPC統計量を少なくとも1つずつ示す。
- 新しい参加者ではgroup単位K-foldなど、参加者全体を外す分割を検討する。
- 高Pareto kなら順位を止め、代替計算を提案する。
- stacking weightをモデル確率と呼ばず、全候補がPPCで外す可能性を残す。

## 公式資料

- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
- [Stan User's Guide: Posterior and Prior Predictive Checks](https://mc-stan.org/docs/2_39/stan-users-guide/posterior-predictive-checks.html)
- [loo: Efficient approximate leave-one-out cross-validation](https://mc-stan.org/loo/reference/loo.html)
- [loo: Pareto k diagnostics and glossary](https://mc-stan.org/loo/reference/loo-glossary.html)
- [loo: Model comparison](https://mc-stan.org/loo/reference/loo_compare.html)
- [loo: Stacking and model weights](https://mc-stan.org/loo/reference/loo_model_weights.html)

L39の原稿、理解問題、既存ケースの実行証拠はGitHub上でレビュー可能ですが、学習アプリへはまだ公開しません。実測値は`link-comparison-validation.json`に保存済みのrunだけを使用し、未実行の結果を補いません。
