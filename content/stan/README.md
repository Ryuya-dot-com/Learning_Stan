# Stan教材パック（非公開ドラフト）

このディレクトリは、STEP 6を公開アプリへ組み込む前の設計・実行・検証単位です。現在の状態は`draft-unpublished`であり、L1–L10のFoundation Gateを迂回して公開するためのものではありません。

## 含まれるもの

- `curriculum.json`: L34–L41の到達目標、依存関係、直接評価証拠
- `linear-regression.md`: 単回帰モデルをRとの境界から診断・予測まで解説する縦切り原稿
- `examples/linear-regression.stan`: 6ブロックを使う教材用Stanプログラム
- `examples/run-linear-regression.R`: CmdStanRによる構文確認、コンパイル、サンプリング、診断、予測確認
- `validation.json`: 実行対象のSHA-256、固定版、サンプリング条件、診断結果
- `scripts/stan-content-verifier.mjs`: 原稿・コード・カリキュラムの同期と必須構造を検査する静的検証器

## 検証レベル

```bash
npm run test:stan-content
```

このコマンドは、ブロック構造、全パラメータの事前分布、尤度、生成量、CmdStanR実行経路、原稿中コードとの一致に加え、実行証拠のSHA-256が現在のコードと一致することを保証します。

現行コードは2026-08-01にR 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0で構文確認・コンパイル・4 chainのサンプリングを実行済みです。divergenceと最大treedepth到達は全chainで0、報告R-hat最大1.00、bulk ESS最小1778、tail ESS最小1705でした。詳細と限界は`validation.json`に記録しています。

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
- 推定値より先に計算診断を確認する。
- `adapt_delta`を警告の万能な解決策として教えない。
- Web上の正答と、実際にモデルを実行・診断した証拠を区別する。

## 公式資料

- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
- [Stan Reference Manual: Program Execution](https://mc-stan.org/docs/reference-manual/execution.html)
- [Stan User's Guide: Regression Models](https://mc-stan.org/docs/stan-users-guide/regression.html)
- [CmdStanR: Getting started](https://mc-stan.org/cmdstanr/articles/cmdstanr.html)
- [CmdStan: diagnose utility](https://mc-stan.org/docs/2_39/cmdstan-guide/diagnose_utility.html)

最終確認日: 2026-08-01。
