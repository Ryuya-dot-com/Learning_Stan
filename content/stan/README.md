# Stan教材パック（非公開ドラフト）

このディレクトリは、STEP 6を公開アプリへ組み込む前の設計・実行・検証単位です。現在の状態は`draft-unpublished`であり、L1–L10のFoundation Gateを迂回して公開するためのものではありません。

## 含まれるもの

- `curriculum.json`: L34–L41の到達目標、依存関係、直接評価証拠
- `lessons/l34-execution-data-contract.md`: R・CmdStanR・stanc3・CmdStanの責務と、名前・型・大きさ・値域を持つデータ契約を扱う受講用原稿
- `lessons/l35-blocks-types-constraints.md`: 7ブロック、スコープ、型・次元、制約、分布関数の接尾辞をエラー修正まで扱う受講用原稿
- `lessons/l36-generative-process-target.md`: 生成過程、事前分布、尤度、`target`、ベクトル化、リンク尺度を数式とStanコードの往復で扱う受講用原稿
- `lessons/l37-reproducible-cmdstanr.md`: 環境・入力・sampling設定・chain ID・出力・診断を追跡可能にしてCmdStanRで再実行する受講用原稿
- `lessons/l38-diagnostics-before-estimates.md`: HMC診断、R-hat、ESS、MCSEを順に確認し、推定値の解釈を続けるか止めるか判断する受講用原稿
- `lessons/l39-generated-quantities-predictive-checks.md`: `y_rep`による事後予測チェックとpointwise `log_lik`によるPSIS-LOOを、予測単位・Pareto k・ELPD差から判断する受講用原稿
- `lessons/l40-reparameterization-geometry.md`: 階層モデルのfunnelをcentered/non-centered、群情報量、診断、標準化、モデル同値性から修正する受講用原稿
- `lessons/l41-capstone-reporting.md`: 研究質問・estimandから診断停止規則、PPC、感度分析、claim–evidence–limit、第三者再実行までを統合する卒業制作原稿
- `foundation-assessments.json`: L34–L41の目標次元、誤答診断、記述rubric、未見転移を持つ各5問・計40問
- `linear-regression.md`: 単回帰モデルをRとの境界から診断・予測まで解説する縦切り原稿
- `distribution-grammar-lab.md`: 分布文法、数式、ハイパーパラメータ感度、切断・打ち切りを結ぶ演習原稿
- `link-functions-model-comparison.md`: inverse link、係数解釈、比較可能性、PSIS-LOO、Pareto k、stackingを結ぶ演習原稿
- `grammar-drills.json`: Syntax Spineの現行コアとなる8単元×4段階（写経・変更・白紙再現・転移）の32課題
- `syntax-error-corpus.json`: 構文・型・形状・添字・スコープ・許可ブロック・関数・分布シグネチャの壊れた例／修正版8組と転移課題
- `errors/`: 1組につき主原因を1つに限定した`.bad.stan`と、同じ到達目標を保った`.fixed.stan`
- `syntax-error-validation.json`: 固定版stanc3による終了コードと16ソースのSHA-256証拠
- `model-review-corpus.json`: 両方ともコンパイルできるcandidate / reference 6組と、密度・尺度・予測単位・幾何に基づくレビュー課題
- `model-review/`: Jacobian、Bernoulli-logit、centered / non-centered、Poisson offset、pointwise `log_lik`の比較ソース10件
- `model-review-validation.json`: 既存切断モデル2件を含む12ソースの構文成功・pedantic警告数・SHA-256証拠
- `syntax-retention-plan.json`: L37後・L40後・L41後の3チェックポイント、暫定間隔、匿名証拠記録、公開要件
- `syntax-retention-assessments.json`: 構文実行・エラー説明・数式往復・モデルレビュー・転移・遅延保持を測る10課題と0〜2の証拠rubric
- `retention/facilitator/positive-duration-reference.stan`: L41後7〜14日の未見lognormal転移課題に対する非配布参照モデル
- `syntax-retention-validation.json`: 保持計画・課題・参照モデルのSHA-256と固定版stanc3構文成功証拠
- `truncation-case-study.md`: 採用範囲のある測定器を題材に、診断が良い誤答と正しい切断モデルを比較するケース
- `examples/linear-regression.stan`: 6ブロックを使う教材用Stanプログラム
- `examples/prior-predictive.stan`: `_rng`とfixed-parameter samplerで使う事前予測プログラム
- `examples/truncated-normal.stan`: 両側切断と正規化項を確認する推定プログラム
- `examples/wrong-naive-bounded-normal.stan`: 入力制約だけで正規化を省いた、比較専用の意図的な誤答
- `examples/binary-logit-linear.stan`: 線形予測子、Bernoulli-logit、観測別`log_lik`、二値`y_rep`の比較モデル
- `examples/binary-logit-quadratic.stan`: 同じデータ契約へ二次項を加えた比較モデル
- `examples/poisson-log-exposure.stan`: logリンクと`log(exposure)` offsetを持つ件数モデル
- `examples/simulate-distributions.R`: 正規・Beta・事前予測・切断をシミュレーションしてPNGとCSVを生成
- `examples/simulate-link-functions.R`: logit・probit・cloglog・Poisson-logを可視化して基準値を保存
- `examples/run-distribution-models.R`: 事前予測3条件と正答・誤答モデルをコンパイル・実行し、8成果物を生成
- `examples/run-link-model-comparison.R`: 線形・二次logitを実行し、PSIS-LOO、Pareto k、stackingを含む13成果物を生成
- `examples/run-reparameterization-comparison.R`: 弱・強情報でcentered / non-centeredを各4 chain・3反復実行し、診断・ESS/sec・事後同値性を含む12成果物を生成
- `examples/run-existing-runtime-revalidation.R`: 単回帰・切断・リンク/LOOをplatform-native CmdStanで一括再実行し、22成果物と機械可読reportを生成
- `examples/run-linear-regression.R`: CmdStanRによる構文確認、コンパイル、サンプリング、診断、予測確認
- `validation.json`: 実行対象のSHA-256、固定版、サンプリング条件、診断結果
- `scenario-validation.json`: 切断ケース3モデルのSHA-256、事前予測、推定比較、両モデルの診断結果
- `link-comparison-validation.json`: 3リンク・Poisson offset・2つのlogitモデル・LOO比較のSHA-256と実測結果
- `reparameterization-validation.json`: L40の固定2条件、2表現、全反復診断、効率、事後同値性、環境、SHA-256の実測結果
- `runtime-revalidation.json`: Darwin arm64で再取得した単回帰・切断・リンク/LOOのcanonical source hash、全chain診断、教材結論、環境の実測結果
- `scripts/stan-content-verifier.mjs`: 原稿・コード・カリキュラムの同期と必須構造を検査する静的検証器
- `scripts/verify-stan-reparameterization-runtime.R`: 空の一時ディレクトリでL40比較の12成果物と固定判断基準を再検証する実行検証器
- `scripts/verify-stan-existing-runtime.R`: 空の一時ディレクトリで既存3ケースを再実行し、保存証拠と22成果物を再検証する実行検証器

## Stan Syntax Spine

Stan構文はL35だけで完結させず、STEP 5でbrms生成コードを読む段階から、L41後に未見の応答型へ転移する段階まで反復する。`curriculum.json`の`syntaxSpine`を正本とし、次の三層を分離して設計する。

| 層 | 主な内容 |
|---|---|
| Stan言語の文法 | ブロック、実行順、スコープ、型、array・vector・row_vector・matrix、次元、添字、制御構文、ユーザー定義関数 |
| 確率モデルの文法 | distribution statement、`target`、分布関数の接尾辞、支持範囲、リンク、制約・切断・打ち切り |
| 計算の文法 | generated quantities、乱数生成、変数変換とJacobian、non-centered parameterization、数値安定性、ベクトル化と計算量 |

現行の32課題はこの系列の実行可能な核である。公開候補へ進める前に、各技能を`読む・予測する → 穴埋めする → 一部を変える → 意図的なエラーを直す → 見本なしで再現する → 時間を置いて別文脈へ移す`の6接触へ拡張する。後半3つは、完成例の記憶だけで通過しないための必須証拠とする。

反復は次のように分散する。

- STEP 5: `stancode()`を式・生成過程と対応付けて読む。白紙実装は要求しない。
- L34–L35: 実行境界、ブロック、型、次元、スコープを読み、最小プログラムを構文確認する。
- L36: 生成過程を事前分布と尤度へ分け、distribution statement、`target`、ベクトル化、リンク尺度を往復する。
- L37: 同じモデルを再現可能に実行し、型・次元・ブロック・分布関数のエラーを修正する。
- L38: HMC診断、R-hat、ESS、MCSEを順に読み、推定値の解釈を続けるか止めるか判断する。
- L40: 計算診断とモデル幾何を結び、変数変換と再パラメータ化を実装する。
- L41と修了後: 見本なしの統合実装、第三者コードのレビュー、1〜2週間後の未見転移を行う。

構文確認・コンパイルの成功だけを合格としない。エラー原因の説明、数式とコードの往復、コンパイルは通る誤モデルの発見、未見応答型への転移、遅延後の再達成を別々に記録する。セルフチェックは形成的記録とし、保存コード、初回エラー、修正理由、転移成果物を実技証拠とする。

### エラーコーパスの使い方

各組は、壊れた例を実行する前に診断分類と停止位置を予測し、実際のstanc3診断から期待型・実際型・利用可能なシグネチャを読み、修正版を作ってから配布修正版と比較する。診断文の丸暗記や、エラー表示行だけの機械的置換を合格にしない。

現行8組は、セミコロン、array / vector、matrix / vector演算、添字型、局所スコープ、`_rng`の許可ブロック、ユーザー定義関数、Bernoulli観測型を扱う。動的な次元不一致はstanc3の型検査を通る場合があるため、R側のデータ契約と実行時検査、STAN-009の「コンパイルは通る誤モデル」へ分離する。

### コンパイル成功後のモデルレビュー

`model-review-corpus.json`では、candidateとreferenceの両方が固定版stanc3を通る。その後に、次の六つをコードの見た目ではなく数式・生成過程・予測課題・計算診断から判断する。

- 変換後の尺度へ密度を置くときのJacobian
- `bernoulli(inv_logit(eta))`と融合された`bernoulli_logit(eta)`の同値性・数値安定性
- centeredとnon-centeredのデータ条件に依存する計算幾何
- Poisson-logモデルで乗法的曝露量を表す`log(exposure)` offset
- PSIS-LOOへ渡す観測別`log_lik`
- 入力制約だけの正規モデルと、正規化項を持つ切断尤度

判断は`candidate-reject`、`prefer-reference`、`context-dependent`に分ける。centered表現を常に誤りと呼ばず、Bernoulliの二表現を別モデルと呼ばない。Jacobian参照版だけがpedanticの「2 priors」警告を出し、Jacobian欠落版は無警告だった実測も保存し、警告の有無を数学的正しさの代用にしない。

複数chainの推定差まで実測済みなのは切断ケース、リンク・LOOケース、centered / non-centeredの弱・強情報比較である。Jacobian、極端な線形予測子、offsetの真値回収と数値極限は、構文成功とソース同期までであり、追加実測と独立レビューを公開前に行う。

### 累積復習・遅延想起・未見転移

構文練習のチェックを入れたことと、時間を置いて自力で再現できることを分ける。`syntax-retention-plan.json`は次の3地点を定義する。

- `sr37`: L37後。g01〜g03について、エラー修正、正規モデルの白紙再現、Bernoulli-logitへの近接転移を行う。
- `sr40`: L40後。g04〜g07について、Jacobian・切断のレビュー、non-centeredへの書換え、Poisson offsetと予測生成を行う。
- `sr41d`: L41後7〜14日。g01〜g08を、未見の「機器負荷と正の完了時間」lognormal回帰へ統合する。

7〜14日はpilot前の暫定窓であり、学習効果を実測した値ではない。最初の適格な初学者3名について保持率、支援量、完遂時間を確認してから再検討する。rubricは0「未証拠」・1「部分証拠」・2「直接証拠」を定義するが、合格点はpilot前に固定しない。

自己チェックは保持の証拠に数えない。コード前計画、初回コード、初回コンパイラ結果、修正版、修正理由、支援水準、成果物hashを別々に保存し、直後・間隔あり・遅延の記録を上書きしない。氏名、メール、所属、研究データは記録対象外とする。

未見lognormal課題のfacilitator参照モデルはstanc3 2.39.0で構文確認済みだが、これは学習者の保持を示す証拠ではない。参照モデルは初回提出前に配布せず、同じ生成過程・pointwise `log_lik`・`y_rep`契約を満たす別実装も許容する。

## 検証レベル

```bash
npm run test:stan-content
npm run test:stan-syntax-errors
npm run test:stan-model-review
npm run test:stan-retention
npm run test:stan-distributions
npm run test:stan-links
npm run run:stan-scenario
npm run test:stan-scenario-runtime
npm run run:stan-link-comparison
npm run test:stan-model-comparison-runtime
npm run run:stan-reparameterization
npm run test:stan-reparameterization-runtime
npm run run:stan-existing-runtime
npm run test:stan-existing-runtime
npm run gate:stan-release:status
npm run gate:stan-release:require-pass
```

静的検証はL34–L41の原稿8本・理解問題40問、8単元32課題、構文エラー8組、コンパイル成功レビュー6組、保持・転移10課題、実行可能なStan例と8つの実行証拠を原稿・コード・canonical SHA-256まで同期します。個別のR検証器は構文エラー、モデルレビュー、保持課題、分布・リンク図、切断8成果物、リンク/LOO 13成果物、L40比較12成果物を検査します。既存runtime一括検証は単回帰、切断、リンク/LOOを空の一時ディレクトリで再実行し、全chain診断、教材上の統計的結論、合計22成果物を保存証拠と照合します。最後の2コマンドは[Stan Release Gate](../../quality/stan-release-gate/README.md)の状態表示と強制判定で、後者は現在の`BLOCKED`に対して意図どおり失敗します。

現行コードは2026-08-01にR 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0で構文確認・コンパイル・4 chainのサンプリングを実行済みです。divergenceと最大treedepth到達は全chainで0、報告R-hat最大1.00、bulk ESS最小1778、tail ESS最小1705でした。詳細と限界は`validation.json`に記録しています。

切断ケースは2026-08-02に同じ固定版で、事前予測3条件を各1,000回、正答・誤答モデルを各4 chain（warmup 1,000 + sampling 1,000）実行済みです。正答モデルは真値`mu=0.15`・`sigma=0.45`に対して事後平均0.150・0.450、正規化なしモデルは0.417・0.294でした。両モデルともdivergenceと最大treedepth到達は0、R-hat最大1.01未満でした。詳細と限界は`scenario-validation.json`に記録しています。

リンク・LOOケースも2026-08-02にR 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0、loo 2.10.1で実行済みです。同じ400観測に対する線形・二次logitのELPDは-231.412・-212.278、線形の`elpd_diff=-19.134`、`se_diff=5.601`でした。Pareto k閾値超過は両モデル0件、divergence・最大treedepth到達も0です。これは固定合成ケースの予測比較であり、stacking weightをモデル真実確率とは解釈しません。

2026-08-10にはDarwin arm64で3ケースを一括再検証しました。単回帰の最大R-hatは1.0011、切断モデルは各chain 2,000 samplingへ増やして最大1.0029で、全chainのdivergence・最大treedepth到達は0でした。リンク/LOOでは線形の`elpd_diff=-19.052`、`se_diff=5.574`、Pareto k閾値超過0、二次モデルのstacking weight 0.999997を再確認しました。OS間のdraw完全一致ではなく、canonical source hash、診断、教材結論、成果物契約を判定します。

L40比較は2026-08-09に同じR・CmdStanR・CmdStan版、Darwin arm64、Apple clang 21.0.0で実行済みです。各表現を4 chain・3反復した結果、弱情報ではcentered / non-centeredのdivergence合計が235 / 0、`tau` bulk ESS/sec中央値が341 / 16,233でした。強情報では0 / 0、ESS/secが27,624 / 3,500で、centeredを選びました。別の高精度runによる`mu`・`tau`・`theta[1:8]`の20比較はすべて4 combined MCSE以内でしたが、弱情報centeredには146 divergenceが残るため、その平均要約だけを探索妥当性の証拠にはしません。

公開候補への昇格条件は`quality/stan-release-gate/status.json`を機械可読な正本とします。Foundation Gate、対象commitの静的検証とクリーンCI、既存runtime証拠の再検証、L40の弱情報・強情報centered / non-centered比較、独立専門レビュー、適格な初学者3名以上の観察、L41後7〜14日の保持3名以上、公開範囲監査、最終判断の10項目です。公開候補`f7276e2`について`SRG02`〜`SRG05`は完了しましたが、現在も他の未完了条件により全体は`BLOCKED`です。

## 執筆原則

- Stanコードだけを見せず、生成過程、データ契約、R側の呼び出しを同時に示す。
- `~`を乱数生成や代入として説明しない。
- 制約と事前分布を別概念として扱う。
- 制約、切断、打ち切り、境界への丸めを別概念として扱う。
- 分布の形状パラメータと、事前分布を規定するハイパーパラメータを文脈なしに同一視しない。
- 数式、Stanの分布関数、Rでの乱数生成、可視化を同じパラメータ設定で往復する。
- 写経のあとに変更・白紙再現・転移を行い、支援を段階的に外す。
- 推定値より先に計算診断を確認する。
- リンク関数、応答分布、parameter制約を同じ概念として扱わない。
- モデル比較は、同じ観測・同じ予測課題・同じpointwise `log_lik`を確認してから行う。
- LOOの順位より先にPareto kと事後予測を読み、stacking weightをモデル確率と呼ばない。
- `adapt_delta`を警告の万能な解決策として教えない。
- Web上の正答と、実際にモデルを実行・診断した証拠を区別する。

## 公式資料

- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
- [Stan Reference Manual: Program Execution](https://mc-stan.org/docs/reference-manual/execution.html)
- [Stan Reference Manual: Language Syntax](https://mc-stan.org/docs/reference-manual/syntax.html)
- [Stan Reference Manual: User-defined Functions](https://mc-stan.org/docs/reference-manual/user-functions.html)
- [Stan Functions Reference: Probability-function Conventions](https://mc-stan.org/docs/2_39/functions-reference/conventions_for_probability_functions.html)
- [Stan Reference Manual: Statements and Truncation](https://mc-stan.org/docs/reference-manual/statements.html)
- [Stan User's Guide: Prior Predictive Checks](https://mc-stan.org/docs/stan-users-guide/posterior-predictive-checks.html#prior-predictive-checks)
- [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
- [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html)
- [CmdStan: diagnose utility](https://mc-stan.org/docs/2_39/cmdstan-guide/diagnose_utility.html)
- [Stan Functions Reference: Link Functions](https://mc-stan.org/docs/functions-reference/link-functions.html)
- [loo: PSIS-LOO](https://mc-stan.org/loo/reference/loo.html)
- [loo: Pareto-k diagnostics](https://mc-stan.org/loo/reference/pareto-k-diagnostic.html)
- [loo: Model comparison](https://mc-stan.org/loo/reference/loo_compare.html)

最終確認日: 2026-08-09。
