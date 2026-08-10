# Stan Release Gate — 公開判断 `cbc6ef2`

## 対象

| 項目 | 記録 |
|---|---|
| Gate ID | `SRG-CURRENT` |
| 対象commit | [`cbc6ef23b4b1c7154e83a54c0bc82a3a2f7edcff`](https://github.com/Ryuya-dot-com/Learning_Stan/commit/cbc6ef23b4b1c7154e83a54c0bc82a3a2f7edcff) |
| 公開候補 | Stan L34〜L41、理解問題40問、関連するStan / R例と検証証拠 |
| 検証期間 | 2026-08-09〜2026-08-10 |
| 主実装者コード | `CODEX` |
| 公開判断者コード | `OWNER-01`（リポジトリ所有者） |

## 必須証拠

| ID | 状態 | 主なartifact・判断 |
|---|---|---|
| SRG02 | `PASS` | `static-verification-cbc6ef2.json`: 24 test files・397 testsとStan教材検証が成功 |
| SRG03 | `PASS` | [GitHub Actions run 31349208141](https://github.com/Ryuya-dot-com/Learning_Stan/actions/runs/31349208141): `build`・`r-verify`・`stan-verify`成功 |
| SRG04 | `PASS` | `content/stan/runtime-revalidation.json`: 単回帰・切断・リンク/LOOを再検証 |
| SRG05 | `PASS` | `content/stan/reparameterization-validation.json`: 弱・強情報のcentered / non-centered比較を各4 chainで検証 |
| SRG09 | `PASS` | 同runでsecret・個人情報・アプリ範囲の自動監査が成功し、2026-08-10に所有者が全公開範囲を確認 |
| SRG10 | `PASS` | 本記録で必須証拠、既知の限界、問題一覧を確認し、ベータ公開可と判断 |

## 改善証拠

| ID | 状態 | 記録 |
|---|---|---|
| SRG01 Foundation Gate | `NOT RUN` | ベータ公開後も改善証拠として継続 |
| SRG06 第三者フィードバック | `RECORDED` | [`feedback-2026-08-10.md`](feedback-2026-08-10.md) |
| SRG07 初学者観察 | `NOT RUN` | 学習効果を確認済みとは主張しない |
| SRG08 遅延保持 | `NOT RUN` | 保持効果を確認済みとは主張しない |

## 公開範囲

- GitHubソース: Stan原稿、理解問題、合成データ、実行・検証証拠を公開してよい。
- 学習アプリ: L34〜L41をベータ公開してよい。実際の導線有効化は別commitで行い、そのcommitを改めてCI検証する。
- 非公開を維持するもの: 入力済み観察記録、録画・録音、生ログ、直接識別子、参加者向け未見variant。
- 自動監査: secret、個人情報、現在のアプリ範囲はいずれも`PASS`。

## 既知の限界と改善項目

- runtime証拠は固定した合成教材ケースであり、実データや任意のモデルへ一般化しない。
- Foundation Gate、初学者観察、7〜14日後の遅延保持は未実施であり、学習効果や保持効果を確認済みとは表示しない。
- 「練習問題の反復を増やしてほしい」という感想を`SRG-IMPROVEMENT-001`（P3）として次の教材候補で扱う。
- 未解決P0・P1は0件、未解決P2は0件である。

## 結論

- 判定: `PASS`
- GitHubソース: 公開可
- Stan学習アプリ: ベータ公開可
- 次の行動: 導線有効化を別commitで実装・検証し、その後に反復練習を増やす改善を行う

この判断は対象commit `cbc6ef2`に限定します。正式な第三者署名は要求せず、リポジトリ所有者の公開判断をコードと日付で記録します。
