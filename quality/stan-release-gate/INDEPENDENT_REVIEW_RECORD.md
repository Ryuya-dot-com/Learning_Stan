# Stan独立レビュー記録票（未実施テンプレート）

このファイルへ結果を直接上書きせず、`reviews/SRG-CURRENT-<reviewer-code>.md`へコピーして使用します。公開記録には直接識別子を書きません。

## 1. 対象と適格性

| 項目 | 記録 |
|---|---|
| Gate ID | `SRG-CURRENT` |
| 対象commit | `f7276e235ed36d39c016982a2b34b5cc87d98af3` |
| 対象URL | https://github.com/Ryuya-dot-com/Learning_Stan/commit/f7276e235ed36d39c016982a2b34b5cc87d98af3 |
| 主実装者コード | `CODEX` |
| レビュー者コード | |
| レビュー日 | |
| 主実装者と異なる | `YES / NO` |
| 担当可能なscope | `stan-language / statistical-model / learner-material / public-scope` |

## 2. 対象SHAと自動証拠

| 確認 | 結果 | artifact・注記 |
|---|---|---|
| `git rev-parse HEAD`が対象commitと一致 | `PASS / FAIL / BLOCKED` | |
| worktreeがクリーン | `PASS / FAIL / BLOCKED` | |
| `npm test` | `PASS / FAIL / BLOCKED` | |
| `npm run test:stan-content` | `PASS / FAIL / BLOCKED` | |
| `npm run build` | `PASS / FAIL / BLOCKED` | |
| `npm run audit:stan-public-scope` | `PASS / FAIL / BLOCKED` | |
| CI run 31325892271の3 job | `PASS / FAIL / BLOCKED` | |

## 3. SRG06 独立専門レビュー

| scope | 確認範囲 | 結果 | 問題ID・artifact・限界 |
|---|---|---|---|
| `stan-language` | 構文エラー8組、モデルレビュー6組、型・次元・scope・関数・密度・生成量 | `PASS / FAIL / BLOCKED` | |
| `statistical-model` | 生成過程、支持範囲、Jacobian、リンク・offset、予測単位、runtime診断と結論 | `PASS / FAIL / BLOCKED` | |
| `learner-material` | L34〜L41、40問、直接評価、練習順、初学者向け説明 | `PASS / FAIL / BLOCKED` | |

- SRG06総合判定: `PASS / FAIL / BLOCKED`
- 判断根拠:
- 確認できなかった範囲:

## 4. SRG09 公開範囲の独立確認

| 確認 | 結果 | 問題ID・artifact・限界 |
|---|---|---|
| secret・credential・秘密鍵が追跡されていない | `PASS / FAIL / BLOCKED` | |
| 直接識別子・入力済み観察記録・生ログが追跡されていない | `PASS / FAIL / BLOCKED` | |
| 未見variant・採点鍵の参加者配布境界が守られる | `PASS / FAIL / BLOCKED` | |
| アプリ導線がL1〜L16を越えていない | `PASS / FAIL / BLOCKED` | |
| GitHubソース公開とアプリ掲載の区別が正しい | `PASS / FAIL / BLOCKED` | |
| 自動監査外の公開権限・匿名性を人が確認した | `PASS / FAIL / BLOCKED` | |

- SRG09総合判定: `PASS / FAIL / BLOCKED`
- 判断根拠:
- 確認できなかった範囲:

## 5. 問題トリアージ

| 問題ID | 重要度 | 状態 | 観察事実 | 所有者 | 期限 | 再検証条件 |
|---|---|---|---|---|---|---|
| | `P0 / P1 / P2 / P3` | `OPEN / CLOSED` | | | | |

未解決P0・P1があれば`FAIL`です。未確認項目があれば`BLOCKED`です。未解決P2には所有者、期限、再検証条件を付けます。

## 6. 独立署名

| 役割 | レビュー者コード | 日付 | 判定 | 確認scope |
|---|---|---|---|---|
| Stan独立レビュー | | | `PASS / FAIL / BLOCKED` | `stan-language / statistical-model / learner-material` |
| 公開範囲確認 | | | `PASS / FAIL / BLOCKED` | `public-scope` |

この署名は対象commitだけに有効です。`SRG06`・`SRG09`以外のGate項目や最終公開判断を代替しません。
