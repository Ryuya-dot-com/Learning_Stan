# Stan教材パック（非公開ドラフト）

このディレクトリは、STEP 6を公開アプリへ組み込む前の設計・実行・検証単位です。現在の状態は`draft-unpublished`であり、L1–L10のFoundation Gateを迂回して公開するためのものではありません。

## 含まれるもの

- `curriculum.json`: L34–L41の到達目標、依存関係、直接評価証拠
- `linear-regression.md`: 単回帰モデルをRとの境界から診断・予測まで解説する縦切り原稿
- `distribution-grammar-lab.md`: 分布文法、数式、ハイパーパラメータ感度、切断・打ち切りを結ぶ演習原稿
- `link-functions-model-comparison.md`: inverse link、係数解釈、比較可能性、PSIS-LOO、Pareto k、stackingを結ぶ演習原稿
- `grammar-drills.json`: 8単元×4段階（写経・変更・白紙再現・転移）の32課題
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
- `examples/run-linear-regression.R`: CmdStanRによる構文確認、コンパイル、サンプリング、診断、予測確認
- `validation.json`: 実行対象のSHA-256、固定版、サンプリング条件、診断結果
- `scenario-validation.json`: 切断ケース3モデルのSHA-256、事前予測、推定比較、両モデルの診断結果
- `link-comparison-validation.json`: 3リンク・Poisson offset・2つのlogitモデル・LOO比較のSHA-256と実測結果
- `scripts/stan-content-verifier.mjs`: 原稿・コード・カリキュラムの同期と必須構造を検査する静的検証器

## 検証レベル

```bash
npm run test:stan-content
npm run test:stan-distributions
npm run test:stan-links
npm run run:stan-scenario
npm run test:stan-scenario-runtime
npm run run:stan-link-comparison
npm run test:stan-model-comparison-runtime
```

1つ目は8単元32課題、7つのStan例、2ケース、3つの実行証拠を原稿・コード・SHA-256まで同期検査します。2つ目と3つ目は、分布文法およびリンク関数の可視化をStanコンパイルなしで検査します。4つ目と5つ目は切断ケースの通常実行と空の一時ディレクトリでの再実行です。6つ目と7つ目はリンク・LOOケースの通常実行と、2モデルの再コンパイル、4 chain、13成果物、ELPD差、Pareto k、stacking、入力不変の検査です。

現行コードは2026-08-01にR 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0で構文確認・コンパイル・4 chainのサンプリングを実行済みです。divergenceと最大treedepth到達は全chainで0、報告R-hat最大1.00、bulk ESS最小1778、tail ESS最小1705でした。詳細と限界は`validation.json`に記録しています。

切断ケースは2026-08-02に同じ固定版で、事前予測3条件を各1,000回、正答・誤答モデルを各4 chain（warmup 1,000 + sampling 1,000）実行済みです。正答モデルは真値`mu=0.15`・`sigma=0.45`に対して事後平均0.150・0.450、正規化なしモデルは0.417・0.294でした。両モデルともdivergenceと最大treedepth到達は0、R-hat最大1.01未満でした。詳細と限界は`scenario-validation.json`に記録しています。

リンク・LOOケースも2026-08-02にR 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0、loo 2.10.1で実行済みです。同じ400観測に対する線形・二次logitのELPDは-231.412・-212.278、線形の`elpd_diff=-19.134`、`se_diff=5.601`でした。Pareto k閾値超過は両モデル0件、divergence・最大treedepth到達も0です。これは固定合成ケースの予測比較であり、stacking weightをモデル真実確率とは解釈しません。

公開候補へ昇格するには、ローカル実測だけで完了とせず、次を満たす必要があります。

1. クリーンなCI環境でも`model$check_syntax()`と`model$compile()`が成功する。
2. CIまたは保存可能な検証環境で4 chainのサンプリングが完了する。
3. divergence、最大treedepth、E-BFMI、R-hat、ESS、MCSEを確認する。
4. `y_rep`による事後予測チェックを人が解釈する。
5. Stan経験者が、数学・コード・説明・演習の対応を独立レビューする。

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

最終確認日: 2026-08-02。
