# Stan Release Gate

## 目的

L34〜L41の原稿が揃ったことと、Stan編を学習アプリへ公開できることを分けて判定します。自動テスト、過去のローカル実測、原稿完成のいずれか一つだけでは`PASS`になりません。

このゲートは証拠を作るものではありません。対象commitに結び付いた自動検証、人によるレビュー、初学者観察、遅延保持、公開範囲監査の証拠が揃っているかを検査します。

## 判定コマンド

```bash
npm run gate:stan-release:status
npm run gate:stan-release:require-pass
```

`status`は正しい`BLOCKED`も終了コード0で報告します。`require-pass`は全条件が揃うまで終了コード1となり、Stan編を公開するworkflowだけを止めるために使います。不正なschemaや、根拠のない`PASS`宣言はどちらも終了コード2です。

## 必須証拠

| ID | 証拠 | `PASS`の最低条件 |
|---|---|---|
| SRG01 | Foundation Gate | `quality/foundation-gate/status.json`が`PASS`で、対象状態へのリンクがある |
| SRG02 | Stan教材の静的整合 | L34〜L41、40問、Stan / R例、検証manifestの全自動検査が対象commitで成功 |
| SRG03 | クリーンCI | 対象commitのNode・R・Stan各jobが成功 |
| SRG04 | 既存runtime証拠 | 単回帰、切断、リンク・LOOを保存可能なクリーン環境で再検証 |
| SRG05 | L40 runtime比較 | 弱い群情報と強い群情報の両方でcentered / non-centeredを4 chain以上実行し、診断、ESS、MCSE、時間、事後同値性を確認 |
| SRG06 | 独立専門レビュー | 主実装者以外がStan言語・統計モデル・学習原稿の3 scopeを確認して署名 |
| SRG07 | 初学者観察 | 適格な初学者3名以上について、構文修正・モデルレビュー・未見転移の匿名集約記録がある |
| SRG08 | 遅延保持 | 同じ公開候補に対する`sr41d`をL41後7〜14日に3名以上で実施 |
| SRG09 | 公開範囲監査 | secret、個人情報、アプリ公開範囲を対象commitで確認 |
| SRG10 | 最終判断 | 全証拠、問題、限界を参照する判断票に署名 |

`SRG05`では弱情報だけ、強情報だけ、単一chain、構文成功だけを実測比較として扱いません。両StanソースのSHA-256とR・CmdStanR・CmdStan版を固定します。divergence、最大treedepth、E-BFMI、R-hat、bulk / tail ESS、MCSE、時間を確認し、同じモデルを表す条件では事後分布の実質的同値性も確認します。2026-08-09に弱・強情報の両条件を各表現4 chain・3反復で実測し、`content/stan/reparameterization-validation.json`を正本として`SRG05`は`PASS`になりました。

`SRG04`は2026-08-10にDarwin arm64、R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0、loo 2.10.1で再検証しました。単回帰、切断、リンク/LOOのcanonical source hash、全chain診断、教材上の統計的結論、合計22成果物を`content/stan/runtime-revalidation.json`へ保存しています。切断モデルは1,000 samplingで境界的なR-hatが観測されたため、閾値を緩めず各chain 2,000 samplingで再検証しました。

`SRG03`用のworkflowはbase branchを問わずpull requestを検証し、Node・一般R・固定版CmdStanの3 jobを分離します。手動dispatchは検証だけを行い、Pagesへのupload・deployは`main`へのpushに限定します。jobを実装しただけでは`PASS`にせず、対象commitに結び付くGitHub上の成功run URLを待ちます。

## 状態

- `PASS`: 10証拠と構造化された付帯条件がすべて揃った
- `FAIL`: 証拠または監査が失敗した、Foundation Gateが失敗した、またはP0・P1が未解決
- `BLOCKED`: 未実施、外部の実行環境・レビュー・参加者待ち、または証拠不足

現在は`BLOCKED`です。`SRG04`と`SRG05`は`PASS`（2/10）ですが、Foundation Gate、対象commitのクリーンCI、独立専門レビュー、初学者3名以上の観察、7〜14日後の遅延保持などが未完了です。`status.json`の`decision`だけを`PASS`へ書き換えても、判定器は構造化された証拠不足を拒否します。

## 証拠の保存と公開範囲

GitHubへ置くのは、対象commit、再現コマンド、環境版、source hash、CI URL、匿名化した集約結果、問題一覧、判断票です。入力済み観察記録、録画・録音、生ログ、直接識別子、未見variant、採点鍵はコミットしません。

非公開原本は既存のignore契約に従い、`quality/stan-release-gate/private/`、`raw/`、`recordings/`、`filled-records/`、または`content/stan/private-variants/`へ保存します。`status.json`の`records`には個人名ではなく、公開可能な匿名集約artifactか、管理下にある証拠の不透明な記録IDだけを書きます。

## 更新手順

1. 公開候補commitを確定し、40桁SHAとHTTPS URLを記録する。
2. SRG01〜SRG05の自動・runtime証拠を対象commitへ結び付ける。
3. 独立レビューと規定観察を行い、公開可能な匿名集約だけを記録する。
4. P0〜P3をトリアージする。未解決P2には所有者、期限、再検証条件を付ける。
5. 公開範囲監査と[最終判断票](DECISION_RECORD.md)を完了する。
6. `npm run gate:stan-release:require-pass`が成功してから、別の変更としてアプリ導線を有効化する。

`PASS`は教材の効果を一般化する証明ではなく、この公開候補が定義済みの最低証拠契約を満たしたという限定的な判断です。
