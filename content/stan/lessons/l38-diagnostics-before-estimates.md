# L38 推定値より先に診断を読む

> このレッスンはStanベータ編の一部です。L37で保存した実行結果を使い、推定値を読む前の診断を練習します。

L37では、環境・入力・sampling設定・出力を1つのrunへ結び付けました。L38では、そのrunから得たdrawを使って推定値を解釈してよいか判断します。係数の符号やcredible intervalを見る前に、HMCが指定した`target`を探索できたか、複数chainが整合したか、研究上必要な精度があるかを順番に確認します。

診断値は合否スタンプではありません。各指標が検出する問題、検出しない問題、次に調べる場所を対応付けます。すべて良好でも、尤度や観測過程が正しいとは限りません。

## このレッスンのゴール

終了時には、次のことができるようになります。

1. `$diagnostic_summary()`と`$summary()`が返す診断の範囲を区別する。
2. divergence、最大treedepth到達、E-BFMIをHMCの妥当性・効率・探索の問題として分類する。
3. R-hat、bulk ESS、tail ESS、MCSEからchain間整合性とMonte Carlo精度を判断する。
4. 一般的な推奨線と、研究目的に依存する精度基準を区別する。
5. 診断に問題があるとき、推定値の解釈を止め、設定・モデル・尺度のどこを次に調べるか説明する。
6. 計算診断が良い誤答モデルを、モデル妥当性の証拠として採用しない。

### このレッスンで作るもの

- HMC診断、chain診断、Monte Carlo精度を分けた診断判定表
- 問題のある仮想runについて、解釈停止条件と次の調査を示すデバッグメモ
- 別モデルへ同じ判断順序を移し、計算と統計モデルの妥当性を分離したレビュー

初回の診断出力、そこでの判断と根拠、変更内容、再実行結果を上書きせず残します。最終結果だけでなく、どの警告で立ち止まり、何を調べたかも振り返れるようにしましょう。

## 1. 診断は推定値を読む前の入口である

まず、L37で保存したfitから計算診断を取り出します。

```r
sampler_check <- fit$diagnostic_summary(quiet = TRUE)
print(sampler_check)
```

`$diagnostic_summary()`は、次をchainごとに返します。

- `num_divergent`: warmup後のdivergent transition数
- `num_max_treedepth`: 最大treedepthへ到達した回数
- `ebfmi`: chainごとのE-BFMI

parameterごとのR-hat、ESS、MCSEは別に取り出します。

```r
parameter_check <- fit$summary(
  c("alpha", "beta", "sigma"),
  "mean",
  "sd",
  "rhat",
  "ess_bulk",
  "ess_tail",
  "mcse_mean",
  "mcse_sd"
)

print(parameter_check)
```

CmdStanRの`$summary()`は、`posterior::summarise_draws()`へ追加の要約関数を渡せます。既定の表示にはR-hat、bulk ESS、tail ESSがありますが、MCSEは明示的に追加します。

5%、50%、95%点など、研究上報告する分位点のMCSEも確認できます。

```r
beta_matrix <- posterior::extract_variable_matrix(
  fit$draws(),
  variable = "beta"
)

beta_mcse_quantile <- posterior::mcse_quantile(
  beta_matrix,
  probs = c(0.05, 0.50, 0.95)
)

print(beta_mcse_quantile)
```

平均のMCSEが小さくても、tailの分位点推定が十分とは限りません。実際に報告する量に対応するESSとMCSEを選びます。

## 2. 判断順序を固定する

L38では、次の順序で診断します。

```text
対象runと設定を確認
  ↓
divergence・E-BFMIを確認
  ↓
最大treedepth到達を確認
  ↓
全parameter・主要生成量のR-hatを確認
  ↓
bulk ESS・tail ESSを確認
  ↓
報告量のMCSEを必要精度と比較
  ↓
必要ならtrace・rank plotとparameter組合せを調べる
  ↓
すべて説明できた後にだけ推定値を解釈
```

最初にL37のrun ID、Stanソース・入力JSONの指紋、seed、chain ID、iterationを確認します。別runのCSVを混ぜた診断値では、正しい判断ができません。

各指標は代替関係ではありません。R-hatが良好でもdivergenceを打ち消せず、ESSが大きくても誤った尤度を正しくできません。

## 3. divergenceは妥当性の警告として扱う

HMCは連続的なHamiltonian dynamicsを数値積分で近似します。事後分布に急な曲率や大きく異なる尺度があると、選ばれたstep sizeでは十分に追跡できない領域が生じます。その兆候がdivergent transitionです。

公式CmdStanガイドは、warmup後にdivergenceが1件でもあれば、sampleに基づく推定が偏る可能性があると説明しています。L38では推定値の実質的解釈を止め、原因調査へ移ります。

```r
divergence_total <- sum(sampler_check$num_divergent)
divergence_total
```

### 次に調べること

1. どのchainに、何件のdivergenceがあるか。
2. divergent drawがどのparameter領域へ集中しているか。
3. parameterの尺度、強い相関、制約境界、弱い識別、階層構造があるか。
4. 事前分布とparameterizationが生成過程を保ったまま改善できるか。

`adapt_delta`を1に近づけるとstep sizeが小さくなり、divergenceが消える場合があります。しかし、値だけを上げて警告が消えたことを最終説明にしません。計算時間、treedepth、ESS、残る幾何、推定結果を変更前後で比較します。divergenceが残る場合は、L40で扱う再パラメータ化などモデル側の修正が必要です。

## 4. 最大treedepth到達は主に効率の問題である

NUTSは各iterationでtrajectoryを構築します。tree depthが1増えると、探索可能なleapfrog step数の上限は指数的に増えます。最大treedepthへの到達は、実行時間の暴走を避けるためtrajectoryが上限で打ち切られたことを示します。

```r
treedepth_total <- sum(sampler_check$num_max_treedepth)
treedepth_total
```

CmdStanガイドは、最大treedepth警告をdivergenceほど深刻な妥当性問題ではなく、主に効率問題として区別しています。少数の到達なら`max_treedepth`を上げて改善する場合がありますが、次も確認します。

- parameter尺度が極端に違わないか。
- 強い相関や細長い事後分布がないか。
- ESSが計算時間に対して極端に小さくないか。
- `max_treedepth`を上げた結果、実行時間だけが増えていないか。

「divergence 0、最大treedepth 7件」を「診断7件だから無効」と一括分類しません。妥当性への警告と効率への警告を分けて、次の行動を決めます。

## 5. E-BFMIはエネルギー探索を見る

E-BFMIは、HMCがtargetのエネルギー分布をどの程度移動できたかを見る診断です。低い値は、heavy tailや不適切なparameterizationなどにより、chainが事後分布のエネルギー領域を十分に探索できていない可能性を示します。

```r
sampler_check$ebfmi
```

公式CmdStanガイドでは、E-BFMI 0.30未満を名目的な警告線としています。これは自然法則の境界ではなく、問題を調べ始める実務上の目安です。

E-BFMIが低い場合は、次を検討します。

- chainごとの差と、同じchainのR-hat・ESS・trace。
- heavy tailを生む事前分布や尤度。
- parameterの尺度と相関。
- より長い実行でMonte Carlo精度だけが改善する問題か、再パラメータ化が必要な幾何か。

iterationを増やせば必ず直るとは限りません。低E-BFMIが探索不足の構造から生じている場合、同じ困難な探索を長く繰り返すだけになることがあります。

## 6. R-hatはchain間整合性を見る

R-hatは、chain内とchain間のばらつきを比較し、複数chainが同じ分布へ整合しているかを調べます。現在のStan系ツールはrank-normalized split R-hatとfolded-split R-hatを組み合わせ、位置だけでなくscaleやtailの不一致にも感度を持たせています。

一般的な推奨線は`R-hat < 1.01`です。1.00と表示されても、丸め前の値、他のparameter、生成量、HMC診断を確認します。

```r
bad_rhat <- subset(
  parameter_check,
  !is.na(rhat) & rhat >= 1.01
)

bad_rhat
```

R-hatが高い場合は、drawを機械的に追加する前に次を調べます。

- chainごとの位置・scale・tailが違うか。
- multimodality、非識別、強い相関、境界がないか。
- warmupと初期値がモデルに対して十分か。
- 同じ問題が`lp__`や関連parameterにも現れるか。

R-hatは有限drawでの診断であり、「1.01未満なら数学的に収束が証明された」という意味ではありません。主要parameterだけを選んで都合よく判定せず、全parameterと重要な生成量を確認します。

## 7. ESSは量ではなく有効な情報量である

MCMC drawには自己相関があります。ESSは、依存したdrawが独立draw何個分の情報に相当するかを推定します。

- bulk ESS: 分布の中心、平均・中央値などの位置推定に関係する。
- tail ESS: 5%・95%分位点などtail推定の安定性に関係する。

Stan系の一般的な推奨は、bulk ESSとtail ESSを概ね`100 × chain数`以上確保することです。4 chainなら400が確認線です。

```r
chain_count <- length(fit$metadata()$id)
ess_floor <- 100 * chain_count

low_ess <- subset(
  parameter_check,
  ess_bulk < ess_floor | ess_tail < ess_floor
)

low_ess
```

この400は、すべての研究目的で十分な精度を保証する万能値ではありません。ESS推定と基本的な診断を信頼する最低限の目安です。非常に小さな差やtail確率を報告するなら、さらに大きなESSが必要な場合があります。

## 8. MCSEは研究上必要な精度と比較する

MCSEは、有限の相関したMCMC drawを使うことで生じるMonte Carlo近似誤差です。posteriorの不確実性そのものではありません。

例として、係数のposterior SDが0.50、平均のMCSEが0.01なら、次を区別します。

- posterior SD 0.50: parameterについてデータとモデルが残す不確実性。
- MCSE 0.01: posterior平均を有限drawから計算した数値近似の不確実性。

MCSEには、全課題に共通する単一の合格値はありません。研究上0.05の差を区別したいのに平均のMCSEが0.08なら、R-hatやdivergenceが良好でも、その報告精度には不足しています。

次の順で判断します。

1. 何を報告するか。平均、SD、中央値、5%点、95%点など。
2. 結論を変え得る最小差はどれくらいか。
3. 対応するMCSEが、その差より十分に小さいか。
4. HMC妥当性とmixingが良好なら、draw追加でMCSEを下げられるか。

divergenceや高R-hatが残る状態でdrawだけ増やしても、偏りや未混合を精密にすることはできません。

## 9. 実測済み単回帰を判定する

ここで扱う単回帰例は、R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0で、4 chain、warmup 1000、sampling 1000として実行しています。

記録された診断は次です。

| 診断 | 実測値 | L38での判断 |
|---|---:|---|
| divergence | 全chain 0 | 保存drawにdivergenceなし |
| 最大treedepth到達 | 全chain 0 | 上限到達なし |
| E-BFMI | 0.6999〜0.9115 | 全chainで0.30以上 |
| R-hat最大 | 1.00 | 一般的推奨線1.01未満 |
| bulk ESS最小 | 1778 | 4 chainの確認線400以上 |
| tail ESS最小 | 1705 | 4 chainの確認線400以上 |

この記録から、「保存されたrunでは、記録済みの計算診断に明らかな問題はない」と判断できます。ただし、次はまだ言えません。

- 単回帰の線形性・正規性・一定分散が研究対象に合う。
- 事前分布が実質的知識に合う。
- 外挿先でも予測が妥当である。
- 初学者の別OSでも同じ結果になる。

また、既存記録は平均や分位点のMCSEを保存していません。L38の新しい学習者runではMCSEを追加しますが、過去の実測証拠へ後から数値を推測して書き足しません。

## 10. 計算診断が良くてもモデルは間違い得る

教材の切断ケースには、同じ採用範囲のあるデータへ次の2モデルを当てた実測があります。

1. 観測過程に切断の正規化項を含めたモデル。
2. 入力制約だけを置き、正規化項を落としたモデル。

両方ともdivergenceと最大treedepth到達は0、E-BFMI・R-hat・ESSも教材の確認線を満たしました。しかし、正規化項がないモデルは異なる観測過程を定義し、推定値も真値から大きくずれました。

これは「計算診断が良い誤答モデル」の実例です。診断が確認する主な問いは、指定された`target`をサンプラーが探索できたかです。正しい`target`を指定したかは、生成過程、事前予測、事後予測、感度分析、モデル比較と合わせて調べます。

## 11. 診断判定メモを書く

診断値を貼るだけでなく、次の列を持つ表を作ります。

| 項目 | 記録内容 |
|---|---|
| run | run ID、ソース・データ指紋、chain設定 |
| observed | 実測した診断値と対象parameter |
| threshold | 一般推奨線または研究上必要な精度 |
| judgement | 続行、精度不足、効率問題、妥当性問題 |
| interpretation | 推定値の解釈を続けるか止めるか |
| next check | 次に調べるparameter・尺度・モデル箇所・可視化 |
| change | 実際に行った単一変更と根拠 |
| rerun | 同じ入力で再実行した結果と新run ID |

例:

```text
observed: beta R-hat = 1.04
judgement: chain間整合性に問題
interpretation: betaの符号・区間の解釈を停止
next check: chain別trace、lp__、alpha-beta相関、初期値
change: 原因確認前にiterationやadapt_deltaを一括変更しない
```

## 12. 6回の練習で判断順序を身につける

### 1回目: 読む・予測する

診断表を見る前に、各列がHMC妥当性、効率、chain間整合性、中心・tailの情報量、Monte Carlo精度のどれを測るか予測します。

### 2回目: 穴埋めする

次の抽出コードを補います。

```r
sampler_check <- fit$__________________(quiet = TRUE)

parameter_check <- fit$summary(
  c("alpha", "beta", "sigma"),
  "rhat",
  "ess_bulk",
  "ess_tail",
  "mcse_mean"
)
```

### 3回目: 一部を変える

平均のMCSEだけを確認するコードへ、5%・50%・95%点の`mcse_quantile`を追加します。報告する量が変わると必要な診断も変わることを説明します。

### 4回目: エラーを直す

「R-hat 1.00、ESS 2000だから、divergence 3件は無視してよい」という判定を修正します。どの推定値の解釈を止め、何を次に調べるかを書きます。

### 5回目: 見本なし

完成表を閉じ、保存fitからHMC診断、R-hat、ESS、MCSEを抽出し、診断判定メモを白紙で作ります。初回判断を保存してから公式資料と照合します。

### 6回目: 別文脈へ移す

Bernoulli-logitモデルの仮想診断表へ同じ判断順序を移します。さらにL40後、階層モデルのcentered / non-centered表現を同じ項目で比較し、警告0件だけで選ばないようにします。

## よくある誤り

1. **R-hatだけを見る**
   R-hatはdivergence、E-BFMI、最大treedepth、モデル誤指定を代替しません。

2. **R-hat 1.00を収束の証明と呼ぶ**
   表示丸め、未確認parameter、有限drawでの診断限界があります。

3. **ESSを生のdraw数と同じだと思う**
   ESSは自己相関とchain間情報を考慮した有効情報量です。

4. **bulk ESSだけでtailを報告する**
   tail quantileにはtail ESSと対応するMCSEを確認します。

5. **posterior SDとMCSEを混同する**
   前者はposterior不確実性、後者は有限MCMC計算による近似誤差です。

6. **divergenceと最大treedepth到達を同じ重大度で数える**
   divergenceは推定の偏りにつながる妥当性問題、treedepthは主に効率問題です。

7. **iterationを増やせば全診断が直ると考える**
   未混合や悪い幾何には、尺度・識別・parameterizationの見直しが必要です。

8. **`adapt_delta`を最大にして警告を隠す**
   変更前後のstep size、treedepth、ESS、実行時間、残るdivergenceを比較します。

9. **全診断が良いのでモデルが真だと結論する**
   計算診断と生成過程・観測過程の妥当性は別です。

## 内容理解問題

回答は`foundation-assessments.json`に対応します。選択問題は選択肢をシャッフルして提示し、初回回答をフィードバック前に保存します。

1. `stan-l38-q1-divergence-priority`: 良好なR-hat・ESSでdivergenceを相殺しないか。
2. `stan-l38-q2-diagnostic-scope`: HMC診断、R-hat、ESS、MCSEの出力範囲を区別できるか。
3. `stan-l38-q3-mcse-decision`: MCSEを研究上必要な精度と比較できるか。
4. `stan-l38-q4-treedepth-severity`: 最大treedepth到達を妥当性と効率に分けられるか。
5. `stan-l38-q5-transfer-valid-wrong`: 計算診断が良い誤答モデルを見抜けるか。

理解問題の正答は練習支援です。直接評価では、診断値だけでなく、解釈停止、次の調査、変更前後のrunを証拠にします。

## 直接評価

### A. 単回帰の診断判定表

L37で保存した単回帰fitから、divergence、最大treedepth到達、E-BFMI、R-hat、bulk ESS、tail ESS、平均・SD・報告分位点のMCSEを抽出します。

合格の観点:

- `$diagnostic_summary()`と`$summary()`の対象を区別する。
- 一般推奨線と研究上必要なMCSEを分ける。
- 最小値・最大値だけでなく、該当parameterとchainを特定する。
- 問題がなければ「記録した診断上は解釈へ進める」と限定して書く。

### B. 問題runのデバッグメモ

R-hat 1.00、bulk ESS 1800、tail ESS 1600だが、warmup後divergenceが3件ある仮想runをレビューします。

合格の観点:

- divergenceを他の良好値で相殺せず、推定値の解釈を止める。
- 該当draw、parameter相関、尺度、制約境界、事前分布を次の調査へ挙げる。
- `adapt_delta`変更を試す場合も、根拠と変更前後の全診断を残す。
- 仮想runをリポジトリの実測証拠と混同しない。

### C. 計算とモデル妥当性の転移レビュー

計算診断が良い切断正規化なしモデル、または同等の別文脈の誤指定モデルをレビューします。

合格の観点:

- HMCが指定targetを探索できたことと、targetが観測過程を正しく表すことを分ける。
- 診断が検出しない正規化項、リンク、offset、予測単位などをコードと数式から確認する。
- L39の事後予測とモデル比較へ送る問いを少なくとも1つ示す。
- 良好な診断値だけで採用・棄却を決めない。

## 公式資料

- [Stan Reference Manual: Posterior Analysis](https://mc-stan.org/docs/reference-manual/analysis.html)
- [CmdStan Guide: Diagnosing Biased HMC Inferences](https://mc-stan.org/docs/cmdstan-guide/diagnose_utility.html)
- [CmdStanR: Sampler diagnostic summaries](https://mc-stan.org/cmdstanr/reference/fit-method-diagnostic_summary.html)
- [CmdStanR: Compute summary estimates and diagnostics](https://mc-stan.org/cmdstanr/reference/fit-method-summary.html)
- [posterior: Summaries of draws objects](https://mc-stan.org/posterior/reference/draws_summary.html)
- [posterior: Available convergence diagnostics](https://mc-stan.org/posterior/reference/diagnostics.html)
- [posterior: Monte Carlo standard error for quantiles](https://mc-stan.org/posterior/reference/mcse_quantile.html)

L38を終えたら、閾値の暗記だけでなく、各診断が何を確認し、何を保証しないのかを説明してみてください。問題がある場合は推定値の解釈をいったん止め、次に調べることと再実行の結果を一緒に記録しましょう。
