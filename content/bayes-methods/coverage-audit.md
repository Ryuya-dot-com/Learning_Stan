# ベイズ・Stan関連手法のカバレッジ監査

> 2026-08-13更新: この監査で特定した必修の不足は、L21〜L33（STEP 3〜5）として学習アプリへ接続しました。以下の「補う必要がある領域」は、追加内容を決めた監査時点の根拠として残しています。15の論点は、重複を避けてアプリの13レッスンへ統合しています。

## 結論

現行のStan編は、モデルをStanで実装した後の工程が充実しています。特に、実行境界、構文と型、MCMC診断、事後予測チェック、PSIS-LOO、再パラメータ化、再現可能な報告は、入門教材として手厚く設計されています。

監査時点の最大の不足は、公開中の記述統計・可視化からStan編へ進む橋でした。回帰、確率、尤度、ベイズ更新、事後draw、brms、反復測定を学ぶ教材がなく、Stan編はこれらを別に学んだ人を対象にしていました。

そこで、Stan編へ新しい高度な手法を詰め込む前に、前提を独立した教材として追加しました。

## 充実している領域

| 領域 | 現在の扱い | 判断 |
|---|---|---|
| 分析単位、分布、参加者内差 | STEP 2で試行・参加者・条件を分け、分布図と対応図を作る | 充実 |
| R・CmdStanR・Stanの責務 | データ契約、構文確認、コンパイル、samplingを分ける | 充実 |
| Stanのブロック・型・制約 | スコープ、次元、添字、分布関数、意図的エラーを扱う | 充実 |
| 生成過程から対数密度への翻訳 | 事前分布と尤度、`target`、リンク尺度を扱う | Stan実装として充実 |
| 再現可能な実行 | 版、seed、chain、入力、出力、成果物を追跡する | 充実 |
| MCMC・HMC診断 | R-hat、ESS、MCSE、divergence、treedepth、E-BFMIを順に読む | 充実 |
| 事前・事後予測チェック | 事前予測、`y_rep`、観測統計量との比較を扱う | 充実 |
| 予測モデル比較 | pointwise `log_lik`、PSIS-LOO、Pareto k、ELPD差、stackingを扱う | 充実 |
| 階層モデルの計算幾何 | centeredとnon-centeredを情報量と効率から比較する | 充実 |
| 支持範囲、切断、打ち切り | 制約との違いと、診断が良い誤モデルを扱う | 充実だが高度 |
| 分析の統合と報告 | estimand、停止規則、感度分析、主張・証拠・限界を結ぶ | 充実 |

## 監査時点で補う必要があった領域

| 領域 | 現在の状態 | 追加する理由 |
|---|---|---|
| 回帰の基礎 | Stan単回帰には触れるが、`lm()`、予測、残差、因子、対比、交互作用の橋がない | 記述統計から生成モデルへ進むために必須 |
| 確率とシミュレーション | 計画のみ | 分布と標本変動を、式の暗記ではなく生成で理解するため |
| 尤度と応答分布の選択 | Normal、Bernoulli、Poissonの例が分散している | 観測単位と支持範囲から候補を選ぶ技能にまとめるため |
| ベイズ更新と事後分布 | Stanの`target`から説明が始まる | 実装記法より前に、更新と不確実性の意味を理解するため |
| 事後drawの要約 | 診断と予測は厚いが、初学者向けのcontrast・区間・確率的主張がない | 係数表だけに依存しない報告へつなぐため |
| MCMCから得るdraw | HMC診断は充実しているが、格子近似からchain・warmup・drawへ進む短い橋がない | `brm()`の出力を点推定ではなく事後分布の近似として読むため |
| brmsの一連の分析 | 計画のみ | family、prior、fit、診断、PPC、予測を高水準で一周するため |
| `stancode()`による橋渡し | Syntax Spineでは前提だが教材がない | brmsと生Stanを同じモデルの別表現として結ぶため |
| 反復測定と部分プーリング | Stan編ではfunnelが中心 | 参加者・刺激・試行を研究上どうモデル化するかを先に学ぶため |
| 二値・順序応答 | 二値リンクの例はあるが、分析全体と順序モデルがない | 成否とLikert評定を応答尺度上で解釈するため |
| 件数と過分散 | Poisson offsetの例はある | exposure、negative binomial、zero率、裾をPPCで判断するため |
| 反応時間 | 記述統計だけ | 正の支持、右裾、参加者差、タイムアウトを観測過程として扱うため |
| 欠測・測定誤差 | 安易な補完を禁じる注意だけ | 欠測値や真値を未知量として扱う選択肢と仮定を学ぶため |
| 検証単位・parameter recovery・SBC | PPCとPSIS-LOOまで | 予測対象とholdout単位を合わせ、自作実装の校正を点検するため |

## 推奨する教材順序

| 順序 | 教材 | 到達点 |
|---:|---|---|
| 1 | 回帰：係数・予測・残差 | 各行の予測と残差を計算し、係数を単位つきで説明する |
| 2 | 因子・対比・交互作用 | 基準水準を変えても予測が変わらないことと、差の差を説明する |
| 3 | 確率とシミュレーション | 生成規則を一つ変え、分布と要約の変化を予想して確かめる |
| 4 | 尤度と応答分布 | 観測単位と支持範囲から尤度候補を選ぶ |
| 5 | ベイズ更新と事後分布 | prior、likelihood、posteriorを図とコードで対応付ける |
| 6 | 事前予測と感度分析 | 観測可能な値から事前分布を批判し、一仮定ずつ感度を調べる |
| 7 | brmsで連続応答を分析する | 格子近似からMCMCへ進み、formula、family、prior、fit、draw、予測を一周する |
| 8 | brmsで診断・PPC・比較を行う | 診断後にモデルを批判し、予測課題に合う比較を行う |
| 9 | 反復測定と部分プーリング | varying intercept・slopeと予測対象を対応付ける |
| 10 | 二値・順序応答 | link尺度と応答尺度を分け、確率やカテゴリ確率を報告する |
| 11 | 件数・offset・過分散 | Poissonとnegative binomialを観測過程とPPCから比較する |
| 12 | 反応時間 | 歪み、正の支持、群構造、除外・打ち切りをモデルへ書く |
| 13 | brms生成Stanコードを読む | formulaとStanのdata、parameters、model、生成量を対応付ける |
| 14 | 欠測・測定誤差 | 完全ケース、補完、モデル化が置く仮定を比較する |
| 15 | 予測単位・parameter recovery・SBC | 予測評価、モデル検査、実装校正の目的を分けて設計する |

この15本を終えた後に、公開中のStan編へ進みます。brmsで薄く触れた診断・PPC・LOOをStan編で再度扱うのは重複ではありません。前段では「何を確認するか」を学び、後段では「なぜ確認できるか、自分でどう実装するか」へ深化します。

## 発展選択科目

次の手法は有用ですが、全員の入門必修にはしません。研究質問が必要とするときに選択します。

- ロバスト回帰、分散不均一、非線形効果、スプライン
- zero-inflated・hurdleモデル
- 生存時間モデルと時間依存モデル
- 交差分類、項目反応理論、潜在変数モデル
- 混合モデル、隠れマルコフモデル、Gaussian process
- 因果推論の本格的な識別戦略と意思決定理論

これらは複雑だから後に回すのではなく、必要な研究設計、識別仮定、データ量、検証方法が入門コアより増えるため分離します。

## 一次資料

- [Stan User's Guide](https://mc-stan.org/docs/stan-users-guide/)
- [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
- [Stan User's Guide: Missing Data](https://mc-stan.org/docs/stan-users-guide/missing-data.html)
- [Stan User's Guide: Measurement Error](https://mc-stan.org/docs/stan-users-guide/measurement-error.html)
- [Stan User's Guide: Truncation and Censoring](https://mc-stan.org/docs/stan-users-guide/truncation-censoring.html)
- [Stan User's Guide: Held-Out Evaluation and Cross-Validation](https://mc-stan.org/docs/stan-users-guide/cross-validation.html)
- [Stan User's Guide: Simulation-Based Calibration](https://mc-stan.org/docs/stan-users-guide/simulation-based-calibration.html)
- [brms: Supported Response Families](https://paulbuerkner.com/brms/reference/brmsfamily.html)
- [brms: Model Formula](https://paulbuerkner.com/brms/reference/brmsformula.html)
- [brms: Prior Definitions](https://paulbuerkner.com/brms/reference/set_prior.html)
