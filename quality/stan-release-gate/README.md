# Stan Release Gate

## 目的

L34〜L41の原稿が揃ったことと、Stan編を学習アプリへ公開できることを分けて判定します。自動テスト、過去のローカル実測、原稿完成のいずれか一つだけでは`PASS`になりません。

このゲートはベータ公開に必要な技術・公開安全の証拠と、公開後も続ける品質改善の証拠を分けます。第三者の感想、初学者観察、遅延保持は有用ですが、未実施だけを理由に公開を止めません。その代わり、実測していない学習効果や第三者検証済みという主張は行いません。

## 判定コマンド

```bash
npm run gate:stan-release:status
npm run gate:stan-release:require-pass
```

`status`は正しい`BLOCKED`も終了コード0で報告します。`require-pass`は全条件が揃うまで終了コード1となり、Stan編を公開するworkflowだけを止めるために使います。不正なschemaや、根拠のない`PASS`宣言はどちらも終了コード2です。

## ベータ公開の必須証拠（6項目）

| ID | 証拠 | `PASS`の最低条件 |
|---|---|---|
| SRG02 | Stan教材の静的整合 | L34〜L41、40問、Stan / R例、検証manifestの全自動検査が対象commitで成功 |
| SRG03 | クリーンCI | 対象commitのNode・R・Stan各jobが成功 |
| SRG04 | 既存runtime証拠 | 単回帰、切断、リンク・LOOを保存可能なクリーン環境で再検証 |
| SRG05 | L40 runtime比較 | 弱い群情報と強い群情報の両方でcentered / non-centeredを4 chain以上実行し、診断、ESS、MCSE、時間、事後同値性を確認 |
| SRG09 | 公開範囲確認 | secret、個人情報、アプリ公開範囲の自動監査を対象commitで成功させ、リポジトリ所有者が結果を確認 |
| SRG10 | 最終判断 | 必須証拠、既知の限界、問題一覧を参照してリポジトリ所有者が公開可否を記録 |

## 公開を止めない改善証拠（4項目）

| ID | 改善証拠 | 記録方法 |
|---|---|---|
| SRG01 | Foundation Gate | 実機アクセシビリティ監査と観察を継続し、完了時に結果を記録 |
| SRG06 | 第三者フィードバック | 口頭・チャット・文書の感想について、日付、相手の属性、範囲、要点と対応を短く記録 |
| SRG07 | 初学者観察 | 実施できた人数と匿名集約を記録し、教材改善に使う |
| SRG08 | 遅延保持 | L41後7〜14日の結果を記録し、保持設計と主張範囲を見直す |

これらが未実施でもベータ公開は可能です。ただし、実施後にP0・P1相当の問題が見つかった場合は、問題一覧を通じて公開を止めます。

`SRG05`では弱情報だけ、強情報だけ、単一chain、構文成功だけを実測比較として扱いません。両StanソースのSHA-256とR・CmdStanR・CmdStan版を固定します。divergence、最大treedepth、E-BFMI、R-hat、bulk / tail ESS、MCSE、時間を確認し、同じモデルを表す条件では事後分布の実質的同値性も確認します。2026-08-09に弱・強情報の両条件を各表現4 chain・3反復で実測し、`content/stan/reparameterization-validation.json`を正本として`SRG05`は`PASS`になりました。

`SRG04`は2026-08-10にDarwin arm64、R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0、loo 2.10.1で再検証しました。単回帰、切断、リンク/LOOのcanonical source hash、全chain診断、教材上の統計的結論、合計22成果物を`content/stan/runtime-revalidation.json`へ保存しています。切断モデルは1,000 samplingで境界的なR-hatが観測されたため、閾値を緩めず各chain 2,000 samplingで再検証しました。

`SRG02`は`staticVerification`に対象commit、`npm test`と`npm run test:stan-content`、証拠リンクを記録し、すべてが`target.commit`と一致する場合だけ`PASS`にできます。`SRG03`は`cleanCi`に対象commit、GitHub Actions run URL、イベント、`build`・`r-verify`・`stan-verify`の状態を記録し、3 jobが同じ対象commitで成功した場合だけ`PASS`にできます。

`SRG09`の自動検査は`npm run build`と`npm run audit:stan-public-scope`です。Git管理対象に非公開観察path、credentialファイル、代表的なsecret、メールアドレス、実ユーザー名を含む絶対pathがないことを検査します。アプリ範囲については、承認済みL34〜L41以外のStanレッスンを拒否し、ビルド成果物に8レッスンとNB6がすべて含まれることを確認します。自動検査が判断できない公開権限や自由記述の匿名性は、リポジトリ所有者が確認日とコードを`publicScopeConfirmation`へ記録します。独立署名は求めません。

CI workflow自体はbase branchを問わずpull requestを検証し、Node・一般R・固定版CmdStanの3 jobを分離します。Node jobはビルド後に公開範囲自動監査も実行します。手動dispatchは検証だけを行い、Pagesへのupload・deployは`main`へのpushに限定します。公開候補を[`cbc6ef2`](https://github.com/Ryuya-dot-com/Learning_Stan/commit/cbc6ef23b4b1c7154e83a54c0bc82a3a2f7edcff)へ固定し、クリーンなworktreeで必須静的検証を再実行しました。さらに、同じSHAへの[pull request run 31349208141](https://github.com/Ryuya-dot-com/Learning_Stan/actions/runs/31349208141)で`build`・`r-verify`・`stan-verify`がすべて成功したため、`SRG02`と`SRG03`は`PASS`です。

同じrunで`npm run build`と`npm run audit:stan-public-scope`も成功し、`SRG09`の自動監査3項目は`PASS`になりました。2026-08-10にリポジトリ所有者が全公開範囲を確認したため、`SRG09`も`PASS`です。[公開判断記録](DECISION_CBC6EF2.md)に対象、限界、公開範囲、最終判断をまとめています。

## 第三者の感想を得たとき

[短いフィードバック・メモ](FEEDBACK_NOTES.md)を使います。正式な審査や署名は不要で、全3 scopeを一人に確認してもらう必要もありません。感想を教材の正しさや学習効果の証明へ格上げせず、改善した点と見送った点を残します。`SRG06`は完了判定の`PASS`ではなく、感想を要約したことを示す`RECORDED`として扱います。「練習問題の反復を増やしてほしい」という[匿名要約](feedback-2026-08-10.md)を記録し、L34〜L41の各レッスンへ4段階練習を追加する形で反映しました。

## 状態

- `PASS`: 必須6項目が揃い、未解決P0・P1がなく、管理情報のないP2もない
- `FAIL`: 必須検査が失敗した、改善活動で重大問題が見つかった、またはP0・P1が未解決
- `BLOCKED`: 必須6項目のうち未実施または証拠不足がある

現在は`PASS`です。対象`cbc6ef2`について必須6項目がすべて`PASS`（6/6）で、未解決P0・P1・P2はありません。Foundation Gate、初学者観察、遅延保持は未実施の改善証拠として継続し、第三者フィードバック`SRG06`は`RECORDED`です。`status.json`の`decision`だけを`PASS`へ書き換えても、判定器は必須証拠不足を拒否します。

## 証拠の保存と公開範囲

GitHubへ置くのは、対象commit、再現コマンド、環境版、source hash、CI URL、匿名化した集約結果、問題一覧、判断票です。入力済み観察記録、録画・録音、生ログ、直接識別子、未見variant、採点鍵はコミットしません。

非公開原本は既存のignore契約に従い、`quality/stan-release-gate/private/`、`raw/`、`recordings/`、`filled-records/`、または`content/stan/private-variants/`へ保存します。`status.json`の`records`には個人名ではなく、公開可能な匿名集約artifactか、管理下にある証拠の不透明な記録IDだけを書きます。

## 更新手順

1. 公開候補commitを確定し、40桁SHAとHTTPS URLを記録する。
2. SRG02〜SRG05の自動・runtime証拠を対象commitへ結び付ける。
3. P0〜P3をトリアージする。未解決P2には所有者、期限、再検証条件を付ける。
4. 所有者が公開範囲を確認し、[最終判断票](DECISION_RECORD.md)へ既知の限界と公開可否を記録する。
5. 第三者の感想や観察を得られた場合は、公開可能な匿名要約を改善証拠として追加する。
6. `npm run gate:stan-release:require-pass`の成功を確認し、別の変更としてアプリ導線を有効化してCI検証する。

`PASS`は教材の効果を一般化する証明ではなく、この公開候補が定義済みの最低証拠契約を満たしたという限定的な判断です。
