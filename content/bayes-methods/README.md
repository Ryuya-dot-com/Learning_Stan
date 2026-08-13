# ベイズ・Stan前提教材パック

このディレクトリは、STEP 2とStan編の間を埋める教材の執筆正本です。内容はL21〜L33（STEP 3〜5）として学習アプリへ接続済みです。現行Stan編の強みを薄めず、回帰、確率、ベイズ更新、brms、階層モデル、代表的な応答型を順に学べるようにします。

## このパックで解決すること

監査着手時のStan編は、データ契約、Stan構文、MCMC診断、事後予測チェック、PSIS-LOO、再パラメータ化、限定付き報告を詳しく扱う一方、その前提となる回帰、確率、事後分布の読み方、brms、反復測定モデルは別途学習済みであることを前提にしていました。

このパックは、次の順序でその前提を教材化します。

1. 記述統計から回帰へ進む
2. 確率的な生成過程と尤度を理解する
3. 事前分布から事後分布への更新を読む
4. brmsで分析・診断・予測を一周する
5. 反復測定と応答型に合うモデルを選ぶ
6. brmsが生成したStanコードを読み、生Stan編へ進む
7. 欠測・測定誤差・検証方法を発展課題として扱う

## レッスン一覧

1. [回帰：係数・予測・残差](lessons/01-regression-prediction-residuals.md)
2. [因子・対比・交互作用](lessons/02-factors-contrasts-interactions.md)
3. [確率とシミュレーション](lessons/03-probability-and-simulation.md)
4. [尤度と応答分布](lessons/04-likelihood-and-response-distributions.md)
5. [ベイズ更新と事後分布](lessons/05-bayesian-updating-posterior.md)
6. [事前予測チェックと感度分析](lessons/06-prior-predictive-sensitivity.md)
7. [brmsで連続応答を一周する](lessons/07-brms-continuous-workflow.md)
8. [brmsで診断・PPC・予測比較](lessons/08-brms-diagnostics-prediction.md)
9. [反復測定と部分プーリング](lessons/09-repeated-measures-partial-pooling.md)
10. [二値・順序応答](lessons/10-binary-ordinal-outcomes.md)
11. [件数・offset・過分散](lessons/11-counts-offset-overdispersion.md)
12. [反応時間モデル](lessons/12-reaction-time-models.md)
13. [brmsが生成したStanコードを読む](lessons/13-read-generated-stan-code.md)
14. [欠測・測定誤差](lessons/14-missing-data-measurement-error.md)
15. [予測単位・parameter recovery・SBC](lessons/15-prediction-units-recovery-sbc.md)

## レッスンの共通構造

各レッスンは研究場面から始まり、必要なときは小さなデータ表を置いて、言葉による生成過程、数式または図、R・brms・Stanコードを往復します。理解問題5問、4段階練習、任意の発展問題を備えます。

4段階練習は次の順です。

1. まねる前に結果を予想する
2. 一つの仮定だけを変える
3. 見本を閉じて作り、エラーを分類して直す
4. 異なるデータ・応答型・研究質問へ移す

## 反復の設計

同じ説明を繰り返すのではなく、前に学んだ判断を別の場面で使い直します。

| 判断すること | 最初に学ぶ | 使い直す | 未見場面へ移す |
|---|---|---|---|
| 観測単位を決める | 03・04 | 09の反復測定 | 15のholdout単位 |
| 観測値と予測を分ける | 01・03 | 07・08の事後予測 | 12のRT分布 |
| 応答に合う分布を選ぶ | 04 | 10〜12 | 14の観測過程 |
| priorからposteriorを読む | 05・06 | 07・13 | 15のSBC |
| 計算・適合・主張を分ける | 07・08 | 09〜12 | 14・15 |

## 内容監査

現行教材の充実領域、不足領域、追加順序は[カバレッジ監査](coverage-audit.md)にまとめています。

## 説明と練習の原則

- 係数、区間、診断値だけを単独で読ませず、研究質問と予測量へ戻す。
- コンパイル成功、計算診断、モデル妥当性、予測性能、因果主張を分ける。
- 応答分布は名前から選ばず、観測単位、支持範囲、記録過程から選ぶ。
- 事前分布は「広ければ中立」と説明せず、事前予測で観測可能な値へ戻す。
- コードは短く保ち、同じ意味を不必要に複数の抽象化へ分けない。
- 基本問題だけでなく、デバッグ、主張の境界、未見場面への転移を扱う。
