# リンク関数と予測モデル比較――尺度をつなぎ、比較できるものだけを比べる

状態: `beta-public`。Foundation Gateと初学者観察は未実施の改善証拠として明記したうえで公開します。

## この回のダウンロード

- [二値・線形logitモデル](examples/binary-logit-linear.stan)
- [二値・二次logitモデル](examples/binary-logit-quadratic.stan)
- [件数・logリンク・曝露量offsetモデル](examples/poisson-log-exposure.stan)
- [リンク関数の可視化コード](examples/simulate-link-functions.R)
- [Stanで推定してPSIS-LOO比較まで行うRコード](examples/run-link-model-comparison.R)
- [実行証拠](link-comparison-validation.json)

## 到達目標

この回を終えたら、次の6点を一続きで説明・実行できることを目指します。

1. 線形予測子、リンク関数、逆リンク、応答平均を区別する。
2. identity・logit・probit・complementary log-log・logリンクを、応答の支持範囲に対応付ける。
3. logit係数を一定の「確率差」と誤読せず、logリンクでは曝露量をoffsetとして扱う。
4. Stanの数値的に安定な分布関数を使い、観測ごとの`log_lik`と`y_rep`を生成する。
5. 比較前提を確認してから、PSIS-LOOのELPD差、不確実性、Pareto \(k\)を読む。
6. 1位のモデルを真実と断定せず、事後予測チェック、感度分析、stackingを目的に応じて使い分ける。

## 1. GLMの3層を分ける

一般化線形モデルでは、予測変数をまず実数直線上の線形予測子へまとめます。

\[
\eta_i = \alpha + \mathbf{x}_i^\mathsf{T}\boldsymbol{\beta}.
\]

次に、応答分布の平均 \(\mu_i=\operatorname{E}(Y_i\mid\mathbf{x}_i)\) と \(\eta_i\) をリンク関数 \(g\) で結びます。

\[
g(\mu_i)=\eta_i,
\qquad
\mu_i=g^{-1}(\eta_i).
\]

最後に、平均だけでなく応答分布を定めます。

\[
Y_i\mid\mu_i,\phi \sim p(y_i\mid\mu_i,\phi).
\]

ここで重要なのは、`リンク関数 = 分布`ではないことです。Bernoulli分布とlogitリンクを組み合わせることは多いですが、分布は観測のばらつきと支持範囲、リンクは平均と線形予測子の対応を担います。

また、Stanコード内でよく計算するのはリンク \(g\) ではなく逆リンク \(g^{-1}\) です。「確率をlogitへ送る」のがlink、「線形予測子を確率へ戻す」のがinverse linkです。

## 2. 代表的なリンク関数を横並びにする

identity linkは変換を行わず、実数上の平均をそのまま線形予測子へ置きます。

\[
g(\mu)=\mu=\eta.
\]

| 応答 | 分布例 | link \(g(\mu)\) | inverse link \(g^{-1}(\eta)\) | Stanでの中心的な書き方 |
|---|---|---|---|---|
| 実数 | Normal | \(\mu\) | \(\eta\) | `normal(eta, sigma)` |
| 0/1 | Bernoulli | \(\log\{p/(1-p)\}\) | \(1/(1+e^{-\eta})\) | `bernoulli_logit(eta)` |
| 0/1 | Bernoulli | \(\Phi^{-1}(p)\) | \(\Phi(\eta)\) | `bernoulli(Phi(eta))` |
| 0/1 | Bernoulli | \(\log[-\log(1-p)]\) | \(1-e^{-e^\eta}\) | `bernoulli(inv_cloglog(eta))` |
| 0以上の件数 | Poisson | \(\log(\lambda)\) | \(e^\eta\) | `poisson_log(eta)` |

### 2.1 logit

\[
\operatorname{logit}(p)=\log\frac{p}{1-p},
\qquad
\operatorname{logit}^{-1}(\eta)=\frac{1}{1+\exp(-\eta)}.
\]

logitは \(\eta=0\) のとき \(p=0.5\) で、0の周りに対称なS字です。Stanでは、次の右辺を手作業で確率へ戻すより、左辺を優先します。

```stan
y ~ bernoulli_logit(eta);             // 推奨: logit尺度のまま渡す
// y ~ bernoulli(inv_logit(eta));      // 意味は同じだが、上より数値的に不利
```

`~`は乱数代入ではなく`target`への対数確率加算です。予測を生成するときだけ`bernoulli_logit_rng(eta)`を`generated quantities`で使います。

### 2.2 probit

probit linkの向きは \(g(p)=\Phi^{-1}(p)\) です。

\[
\Phi^{-1}(p)=\eta,
\qquad p=\Phi(\eta).
\]

\[
p=\Phi(\eta)=\int_{-\infty}^{\eta}
\frac{1}{\sqrt{2\pi}}\exp\left(-\frac{z^2}{2}\right)\,dz.
\]

probitも対称なS字ですが、係数は標準正規の潜在尺度上にあります。logitと係数の数値をそのまま比べて「効果が大きい」とは言えません。

```stan
y[n] ~ bernoulli(Phi(eta[n]));
```

### 2.3 complementary log-log

linkとinverse linkを対にすると次のようになります。

\[
\log\{-\log(1-p)\}=\eta,
\qquad p=1-\exp\{-\exp(\eta)\}.
\]

\[
p=1-\exp\{-\exp(\eta)\}.
\]

cloglogは非対称です。logitと同じ \(\eta=0\) でも \(p=1-e^{-1}\approx0.632\) になります。離散時間ハザードなど非対称な生成過程に自然な場合がありますが、「曲線が違うから」という理由だけで事後的に選ばず、観測過程との対応を説明します。

```stan
y[n] ~ bernoulli(inv_cloglog(eta[n]));
```

### 2.4 Poissonのlogリンクとoffset

\[
Y_i\sim\operatorname{Poisson}(\lambda_i),
\qquad
\log\lambda_i=\log e_i+\alpha+x_i\beta.
\]

\(e_i>0\) は観察時間、人口、面積などの曝露量です。係数を推定しない既知の項 \(\log e_i\) をoffsetとして加えます。

\[
\lambda_i=e_i\exp(\alpha+x_i\beta).
\]

曝露量が2倍なら、他の条件が同じとき期待件数も2倍です。`poisson-log-exposure.stan`では次のように、log-rateを保ったまま渡します。

```stan
vector[N] log_rate = log(exposure) + alpha + beta * x;
y ~ poisson_log(log_rate);
```

件数を曝露量で割った実数をPoisson観測として入れるのとは異なります。Poissonの観測は非負整数の件数で、曝露量は期待件数側へ入ります。

## 3. 係数はどの尺度で一定か

logitモデルでは、\(x\)が1増えたときlog oddsが \(\beta\) 増え、oddsは \(\exp(\beta)\) 倍になります。

\[
\frac{p(x+1)/(1-p(x+1))}{p(x)/(1-p(x))}=\exp(\beta).
\]

しかし確率差は一定ではありません。

\[
\Delta p(x)=
\operatorname{logit}^{-1}(\alpha+\beta(x+1))-
\operatorname{logit}^{-1}(\alpha+\beta x).
\]

同じ \(\beta=1\) でも、基準確率が0.5付近なら確率は大きく動き、0や1に近ければ動きは小さくなります。したがって報告では、係数やodds ratioに加え、意味のある複数の \(x\) で予測確率と区間を示します。

logリンクでは \(x\) が1増えると期待件数率が \(\exp(\beta)\) 倍になります。ここでも「件数が常に \(\beta\) 増える」ではありません。

## 4. リンクの選択順序

初心者向けの安全な順序は次です。

1. 1行の観測単位と応答の支持範囲を決める。
2. 観測過程から応答分布を候補化する。
3. 平均が取り得る範囲へ線形予測子を写すリンクを選ぶ。
4. 係数をどの尺度で説明したいか確認する。
5. 事前予測で極端な確率・件数が出ないか調べる。
6. 観測後は計算診断と事後予測チェックを行う。

`<lower=0>`のようなparameter制約はリンク関数ではありません。制約はパラメータ空間、リンクは応答平均と線形予測子の対応、切断は観測分布の再正規化です。

## 5. モデル比較は「同じ予測課題か」から始める

この教材のケースでは、同じ400件の二値応答へ次の2モデルを当てます。

\[
\begin{aligned}
M_1:&\quad \operatorname{logit}(p_i)=\alpha+\beta x_i,\\
M_2:&\quad \operatorname{logit}(p_i)=\alpha+\beta_1x_i+\beta_2x_i^2.
\end{aligned}
\]

比較前に、最低限次をそろえます。

- 同じ観測対象と同じ応答値を使う。
- 何を1つ除外するかを、将来の予測課題に合わせる。
- 各列が同じ観測を表す、観測ごとの対数尤度を作る。
- 欠測処理や行の除外で、モデル間の行集合が変わっていないか確認する。
- 時系列、空間、反復測定なら、1行LOOで依存構造を漏らさないか確認する。

応答も観測集合も異なる2モデルのELPDを、そのまま優劣表へ並べてはいけません。階層データで新しい参加者への予測が目的なら、1測定を除くのではなく参加者単位のK-foldなどが必要になることがあります。時系列の未来予測にはleave-future-outという別の分割が候補です。

## 6. `log_lik`を観測単位で生成する

PSIS-LOOへ渡すのは、posterior draw \(s\) と観測 \(i\) ごとの対数尤度です。

\[
\ell_i^{(s)}=\log p(y_i\mid\theta^{(s)}).
\]

Stanでは`generated quantities`で次のように作ります。

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

`log_lik`は比較用の観測済み \(y\) の対数確率、`y_rep`はモデル検査用の新しい複製データです。役割を入れ替えません。また、`log_lik`を合計して1個だけ保存すると、観測単位のLOOを計算できません。

## 7. PSIS-LOOの読み方

LOOの目標は、各観測を1つずつ外して予測したときの対数予測密度を足し合わせた期待対数点別予測密度、ELPDです。

\[
\operatorname{elpd}_{\mathrm{loo}}
=\sum_{i=1}^{N}\log p(y_i\mid y_{-i}).
\]

大きい方が、定義した予測課題に対する期待予測性能が高いと読みます。`loo_compare()`の`elpd_diff`は最良行を0とした差なので、それ以外は通常負です。

\[
\operatorname{elpd\_diff}_{m}
=\operatorname{elpd}_{m}-\max_j\operatorname{elpd}_{j}.
\]

点推定だけでなく`se_diff`を並べます。たとえば差が標準誤差と同程度なら、順位を確定事実のように扱いません。`p_loo`は有効な複雑さの診断材料ですが、「パラメータ数そのもの」ではありません。`looic=-2\,\operatorname{elpd}_{\mathrm{loo}}`なので、LOOICは小さい方がよく、ELPDと向きが逆です。

### Pareto \(k\)はスコアの前提診断

PSISは、全データで得たposterior drawsを再利用してLOOを近似します。各観測のimportance weightの裾をPareto形状 \(k\) で診断します。現行`loo`の主な閾値はdraw数 \(S\) に依存し、概ね次です。

\[
k_{\mathrm{threshold}}
=\min\left(1-\frac{1}{\log_{10}S},\,0.7\right).
\]

したがって「常に0.7だけを暗記」せず、`pareto_k_table()`や`pareto_k_ids()`が返す診断を読みます。閾値超過があれば、影響観測を調べ、より頑健な観測モデル、moment matching、該当観測の厳密なrefit、K-foldなどを検討します。高い \(k\) のまま小数点以下のELPD差を比較しても、精密さは増えません。

## 8. 比較はモデル検査の代わりではない

推奨順序は次です。

1. 予測対象と除外単位を言語化する。
2. prior predictive checkを行う。
3. sampling diagnosticsを通す。
4. posterior predictive checkで、両モデルが同じように外している特徴を探す。
5. 比較可能性と`log_lik`の列対応を確認する。
6. PSIS-LOOとPareto \(k\)を計算する。
7. `elpd_diff`と`se_diff`、pointwise差を読む。
8. 目的に応じて単一モデル、追加モデル、K-fold、または予測分布の組み合わせを選ぶ。

LOOで1位でも、観測過程を誤っていたり、全候補が同じ特徴を再現できなかったりします。LOOは候補集合内の相対的な予測比較であり、因果効果、科学的真実、実装の正しさを自動証明しません。

## 9. stacking weightの意味

複数モデルの予測分布を混ぜるなら、stackingはLOO予測密度が高くなるよう非負で総和1の重みを求めます。

\[
\mathbf{w}^{*}
=\arg\max_{w_k\ge0,\,\sum_k w_k=1}
\sum_{i=1}^{N}\log\left(\sum_{k=1}^{K}w_k p_k(y_i\mid y_{-i})\right).
\]

これは「モデル \(k\) が真であるposterior probability」ではありません。候補予測分布を、定義した予測課題でどう混ぜるかという最適化結果です。明確な科学的解釈が必要なときは、重みだけを結論にせず各モデルの仮定を併記します。

## 10. 実行シナリオ

`run-link-model-comparison.R`は固定seedで、真のlogitに二次項を含む二値データを生成します。線形モデルと二次モデルをそれぞれ4 chainで推定し、次を保存します。

- 3種類の二値inverse link、logit係数の基準値依存、Poisson offsetの図
- 合成データと、2モデルのposterior予測図
- モデル別ELPD、`p_loo`、LOOIC、`elpd_diff`、`se_diff`
- 全観測のPareto \(k\) とpointwise ELPD差
- stacking weightとsampling diagnostics

結果の読み方は、まず全chainの計算診断、次にPareto \(k\)、次に予測図、最後にELPD差です。実測値は実行証拠`link-comparison-validation.json`と同期し、コード変更後に古い数値だけが残らないよう検査します。

固定実行では、線形モデルのELPDは-231.412、二次モデルは-212.278でした。最良の二次モデルを0とした線形モデルの`elpd_diff`は-19.134、`se_diff`は5.601です。両モデルともPareto \(k\)の現行閾値0.7を超えた観測は0件で、最大値は線形0.022、二次0.158でした。したがってこの合成ケースでは、PSIS近似が明確に壊れた徴候なしに二次モデルの予測優位を観察できました。

ただし、stacking weightが線形0.0000003、二次0.9999997になったことを「二次モデルが真である確率」とは読みません。sampling diagnosticsは両モデルともdivergence・最大treedepth到達0、対象係数のR-hat最大1.004未満、bulk ESS最小1,423超でした。これは計算とPSIS近似を読む準備ができたことを示すだけで、合成データ外の妥当性を保証しません。

## 11. 4段階反復

### g07: リンク関数

1. 写経: \(\eta\)からlogit・probit・cloglogを計算し、同じ軸へ描く。
2. 変更: interceptと係数を変え、確率差が基準値に依存することを数値で説明する。
3. 白紙再現: Bernoulli-logitとPoisson-log-offsetのStanコードを、型を含めて書く。
4. 転移: 0以上の待ち時間、割合、順序カテゴリの候補分布とリンクを、支持範囲から検討する。

### g08: 予測モデル比較

1. 写経: 2モデルで同じ観測順の`log_lik[N]`を生成し、`loo()`へ渡す。
2. 変更: 線形項へ二次項を加え、posterior predictiveとpointwise ELPD差を比較する。
3. 白紙再現: 比較前提→診断→ELPD差→判断の順を、関数名を含めて再現する。
4. 転移: 参加者内反復測定で「新しい測定」と「新しい参加者」の2予測課題に別の分割を設計する。

## 12. 内容理解問題

### 問1

`inv_logit(eta)`はlinkとinverse linkのどちらですか。入力と出力の範囲も答えてください。

### 問2

`y ~ bernoulli_logit(eta)`と`y ~ bernoulli(inv_logit(eta))`は何が同じで、なぜ前者を優先しますか。

### 問3

logitモデルで \(\beta=1\) なら、\(x\)が1増えたとき成功確率は常に同じ量だけ増えますか。数式で説明してください。

### 問4

logit・probit・cloglogのうち、\(\eta=0\) で成功確率が0.5にならないものはどれですか。

### 問5

観察時間が人によって違う事故件数データで、`log(exposure)`をoffsetへ入れる理由を説明してください。

### 問6

parameterの`<lower=0>`制約とlogリンクは同じですか。何を制御するか分けてください。

### 問7

LOO比較する2モデルで、片方だけ欠測行を除外していました。そのまま`loo_compare()`してよいですか。

### 問8

なぜ`generated quantities`の`log_lik`は観測数 \(N\) 個必要ですか。合計1個では何が失われますか。

### 問9

`elpd_diff=-3.0`、`se_diff=4.5`のモデルを、最良モデルより確実に劣ると断定できますか。

### 問10

複数のPareto \(k\) が現行閾値を超えました。ELPDの順位を報告する前に何をしますか。

### 問11

LOOで1位になったモデルは、生成過程として正しく因果効果も妥当だと言えますか。

### 問12

stacking weightが0.8なら「そのモデルが真である確率80%」ですか。正しい意味を説明してください。

## 解答と誤答診断

1. inverse link。実数全体の \(\eta\) を0と1の間の確率へ写す。
2. 同じBernoulli確率を表す。`bernoulli_logit`はlogit尺度を直接受け、より効率的で数値的に安定である。`~`を乱数生成と説明したらg02へ戻る。
3. 一定なのはlog odds差1、odds ratio \(e^1\)。確率差は \(\operatorname{logit}^{-1}(\eta+1)-\operatorname{logit}^{-1}(\eta)\) で基準 \(\eta\) に依存する。
4. cloglog。\(1-e^{-1}\approx0.632\)。
5. 期待件数を曝露量へ比例させ、条件効果を件数率の比として比較するため。件数を割って連続値に変えることとは違う。
6. 同じではない。制約はparameterの許容領域、logリンクは線形予測子と正の応答平均の対応を定める。
7. 原則そのまま比較しない。共通の観測集合と列対応へそろえるか、予測課題を再定義する。
8. 各観測を外した予測密度を近似するため。合計すると観測別のimportance weight、影響度、pointwise差が失われる。
9. 断定しない。差が不確実性に比べて小さく、予測性能を区別する証拠は弱い。
10. 影響観測とモデルを調べ、頑健化、moment matching、厳密なrefit、K-foldなどで近似を安定化してから比較する。
11. 言えない。候補集合と予測課題に対する相対予測性能であり、絶対適合、因果同定、実装正当性は別に検査する。
12. 違う。候補のLOO予測分布を混ぜたときの予測性能を最適化する重みで、posterior model probabilityではない。

## 公式資料

- [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
- [Stan Functions Reference: Binary Distributions](https://mc-stan.org/docs/functions-reference/binary_distributions.html)
- [Stan Functions Reference: Link Functions](https://mc-stan.org/docs/functions-reference/link-functions.html)
- [loo: Writing Stan programs for use with loo](https://mc-stan.org/loo/articles/loo2-with-rstan.html)
- [loo: Efficient approximate leave-one-out cross-validation](https://mc-stan.org/loo/reference/loo.html)
- [loo: Pareto-k diagnostics](https://mc-stan.org/loo/reference/pareto-k-diagnostic.html)
- [loo: Model comparison](https://mc-stan.org/loo/reference/loo_compare.html)
- [loo: Stacking and model weights](https://mc-stan.org/loo/reference/loo_model_weights.html)
