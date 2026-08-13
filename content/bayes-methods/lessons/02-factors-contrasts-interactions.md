# 02 因子・対比・交互作用

## この回のゴール

二つの実験条件を含む表から、参照水準・対比・交互作用が作る予測値を説明し、係数表だけで研究結論を急がない。

## 前提

- 線形回帰の予測値と残差を区別できる。
- データフレームの数値列と文字列・因子列を区別できる。

## 研究場面

参加者は、語と色が一致する課題または一致しない課題を行いました。さらに、課題前の説明を標準説明か、落ち着いて正確さを優先する説明かのどちらかで受けました。各行は参加者ごとの平均反応時間です。

| condition | instruction | mean_rt_ms |
|---|---|---:|
| congruent | standard | 510 |
| congruent | standard | 518 |
| congruent | calm | 505 |
| congruent | calm | 509 |
| incongruent | standard | 590 |
| incongruent | standard | 601 |
| incongruent | calm | 566 |
| incongruent | calm | 571 |

この小さな表は説明用です。実際の反復測定研究では、参加者ID、試行、刺激などの構造を残し、後で階層モデルを使います。ここでは因子と交互作用が予測式へどう入るかだけを学びます。

## 因子を予測列へ変える

Rの因子は、単なる文字列ではありません。水準の順序と対比規則を使って、回帰に必要な列へ展開されます。次では congruent と standard を参照水準に固定します。

~~~r
task <- data.frame(
  condition = factor(
    c("congruent", "congruent", "congruent", "congruent",
      "incongruent", "incongruent", "incongruent", "incongruent"),
    levels = c("congruent", "incongruent")
  ),
  instruction = factor(
    c("standard", "standard", "calm", "calm",
      "standard", "standard", "calm", "calm"),
    levels = c("standard", "calm")
  ),
  mean_rt_ms = c(510, 518, 505, 509, 590, 601, 566, 571)
)

model.matrix(~ condition * instruction, data = task)
~~~

Rの既定のtreatment contrastでは、概念上、次の3列が追加されます。

| 行 | incongruentか | calmか | 両方か |
|---|---:|---:|---:|
| congruent・standard | 0 | 0 | 0 |
| incongruent・standard | 1 | 0 | 0 |
| congruent・calm | 0 | 1 | 0 |
| incongruent・calm | 1 | 1 | 1 |

モデル式

\[
\mu_i=\alpha+\beta_C C_i+\beta_I I_i+\beta_{CI}(C_i I_i)
\]

では、\(\alpha\) は congruent・standard の予測平均、\(\beta_C\) はstandard説明のときのincongruentとの差、\(\beta_I\) はcongruent課題でのcalm説明との差です。交互作用 \(\beta_{CI}\) は「conditionの差が説明条件によってどれだけ変わるか」、すなわち差の差です。

Rの condition * instruction は、主効果二つと交互作用をまとめた短縮記法です。condition + instruction だけなら交互作用は入りません。

## 予測値として読む

~~~r
fit <- lm(mean_rt_ms ~ condition * instruction, data = task)
coef(fit)

new_conditions <- expand.grid(
  condition = levels(task$condition),
  instruction = levels(task$instruction)
)

new_conditions$predicted_rt_ms <- predict(fit, newdata = new_conditions)
new_conditions
~~~

係数を一つずつ暗記するより、四つの条件の予測値へ戻す方が安全です。参照水準を替えると係数の名前と値は変わりますが、同じモデルで同じ四条件を予測するなら、各条件の予測値は変わりません。

対比は研究質問の書き方です。Rの既定だけに任せず、因子の水準を明示し、どの差を係数にしたいかを先に決めます。設定全体は contrasts(task$condition) で確認できます。

## 典型的な誤解

1. **参照水準は「正しい群」または「統制群」だ。**  
   参照水準は係数を表すための座標の原点です。研究上の比較対象と同じとは限りません。

2. **交互作用があるなら主効果は読めない。**  
   主効果は参照水準で条件づいた差として読めます。ただし、全条件に共通する一つの差とは限りません。

3. **因子の水準順を変えると分析結果が変わる。**  
   係数の表現は変わりますが、同じ列空間を表すモデルなら条件別の予測は同じです。

4. **二条件の平均差なら、参加者内対応や割付を考えなくてよい。**  
   同じ参加者が複数条件を行うなら、行の独立性と個人差を後でモデル化する必要があります。

## 理解問題

### 1. 選択：交互作用の意味

conditionの差がstandard説明では80 ms、calm説明では60 msでした。差の差としての交互作用はどれですか。

- A. 140 ms
- B. 20 ms
- C. 60 ms
- D. 80 ms

**解答：B。** 交互作用は \(80-60=20\) msです。符号は、どちらの説明条件を引くかと参照水準の定義で変わり得ます。Aは二つの差を足した誤り、CとDは一方の単純効果です。

### 2. 出力予測：アスタリスク

次の二式のうち、交互作用列を含むのはどちらですか。

~~~r
lm(mean_rt_ms ~ condition + instruction, data = task)
lm(mean_rt_ms ~ condition * instruction, data = task)
~~~

**解答：二つ目。** アスタリスクは、condition + instruction + condition:instruction を表します。一つ目は二つの主効果だけです。

### 3. 記述：切片

上の水準設定で、切片 \(\alpha\) が表す条件を答えてください。

**rubric：** congruentかつstandardという二つの参照水準を特定し、その条件での予測平均反応時間と説明できれば十分です。「全参加者の平均」とだけ書くのは、因子を含む回帰では不十分です。

### 4. レビュー：係数だけの報告

共同研究者が「conditionの係数が80なので、不一致課題は常に80 ms遅い」と書きました。モデルにはconditionとinstructionの交互作用が入っています。どのように修正しますか。

**解答：** 80 msがstandard説明でのcondition差なら、その条件付きの差だと書きます。calm説明での差は交互作用を加えた値なので、四条件の予測値または各説明条件内の差を示します。「常に」と一般化しません。

### 5. 主張境界

二要因回帰の結果から最も適切に書けるのはどれですか。

- A. calm説明は全員の脳内処理を60 ms改善した。
- B. このデータとモデルでは、説明条件によってcondition差が異なる可能性を予測値として要約した。
- C. 交互作用があるので、どの条件の予測も使えない。
- D. 参照水準を替えれば、交互作用の有無が変わる。

**解答：B。** Aは設計と対象範囲を越えた因果・機序の主張です。Cは誤りで、交互作用があるからこそ条件ごとの予測が重要です。Dは係数表現とモデル内容を混同しています。

## 4段階練習

1. **まねる**  
   model.matrix() の四行を見ずに、congruent・calm行の三つの0/1列を予想します。実行して列名と水準順を確認します。

2. **一つ変える**  
   conditionの水準順を incongruent, congruent に反転します。係数表と四条件の予測値のどちらが変わるかを予想し、実行して確かめます。

3. **見ずに作る＋デバッグ**  
   二因子のデータフレーム、levels指定、アスタリスクを含む式、予測用の expand.grid() を白紙から書きます。意図的にnewdataのinstructionを文字列のまま別水準 "quiet" にし、なぜ予測できないかを水準契約として説明して直します。

4. **未見転移**  
   睡眠条件（通常・制限）と課題難易度（低・高）の2×2研究について、応答、因子水準、参照水準、交互作用が答える研究質問を表にします。観察研究なら因果主張に必要な追加根拠も書きます。

## 任意課題

同じ四条件について、treatment contrastとsum contrastでそれぞれ設計行列を作り、係数の解釈の違いを説明してください。最後に、各条件の予測値が同じになることを predict() で確認します。比較前に、どの係数が研究上もっとも読みやすいかを一文で決めてください。

## 一次資料

- [R stats: model.matrix](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/model.matrix.html)
- [R stats: contrasts](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/contrasts.html)
- [R stats: lm](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/lm.html)
- [Stan User’s Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
