# Foundation Gate 実施キット

このディレクトリは、L1–L10を将来の教材の模範実装として採用できるかを、再現可能な証拠で判定するための正本です。

自動テストの成功は実装の整合性を示しますが、初学者が実際に学べることや、支援技術で操作できることまでは証明しません。Gateは、次の4種類の証拠が揃うまで通過扱いにしません。

1. 固定版Node・R・CIによる自動検証
2. 実機アクセシビリティ監査
3. 対象学習者によるL1–L10完走観察
4. 未解決問題と意思決定を含むGate判定記録

## 使用する文書

- [実機アクセシビリティ監査票](ACCESSIBILITY_AUDIT.md)
- [初学者観察プロトコル](LEARNER_OBSERVATION_PROTOCOL.md)
- [匿名観察記録票](LEARNER_OBSERVATION_RECORD.md)
- [Foundation Gate判定票](GATE_DECISION.md)
- [現在の機械可読状態](status.json)

現在状態は次のコマンドで確認します。

```bash
npm run gate:status        # BLOCKEDでも、形式が正しければ状態を表示して正常終了
npm run gate:require-pass  # 全条件がPASSでなければ失敗終了
```

`status.json`の`decision`は検証器が証拠から導く結論と一致しなければなりません。手作業で`PASS`へ書き換えても受理されません。

原本を直接上書きせず、実施時は日付と監査IDを付けたコピーを作ります。例:

```text
quality/foundation-gate/evidence/
└── FG-2026-08-01/
    ├── accessibility-windows-nvda.md
    ├── accessibility-macos-voiceover.md
    ├── accessibility-mobile.md
    ├── learner-P01.md
    ├── learner-P02.md
    ├── learner-P03.md
    └── decision.md
```

## 証拠の状態

各記録は次のいずれかを明示します。空欄やファイルの存在を合格として扱いません。

- `NOT RUN`: 未実施
- `PASS`: 規定した手順を完了し、Gateを止める問題がない
- `FAIL`: 手順を実施し、Gateを止める問題が見つかった
- `BLOCKED`: 必要な端末、支援技術、対象者または権限がなく実施できない

## 記録してよいもの

- 無作為な参加者コード
- OS・ブラウザ・支援技術のバージョン
- タスク結果、支援レベル、所要時間
- 個人を特定できない観察事実と要約
- 再現手順を持つ問題票へのリンク

氏名、学籍番号、メールアドレス、成績、障害・診断情報、画面録画、音声、生のアクセスログはこのリポジトリへ保存しません。正式な研究・発表へ転用する場合は、所属機関の倫理審査と同意要件を別途確認します。

## 役割と判定の独立性

- 進行役は参加者を誘導せず、支援を段階別に記録します。
- 観察者は見聞きした事実と推測を別欄に書きます。
- Gate判定者は未解決問題を確認し、証拠へのリンクを残します。
- 進行役と観察者は兼任できますが、最終Gateは主実装者とは別のレビュー者が確認します。独立レビュー者を確保できない場合は`BLOCKED`です。

## 完了の定義

実施キットの作成完了とFoundation Gate通過は別です。Gateの合否は、[判定票](GATE_DECISION.md)の条件に従い、実施済み証拠を確認して初めて決定します。

## STEP 1との境界

このGateはL1–L10の基礎と環境構築を判定します。L12→L13の読込成功・品質検査・raw保全・未見表への転移は[STEP 1 Data Quality Gate](../step1-data-gate/README.md)、L16修了後の分析一周の独立転移は[STEP 1独立転移観察キット](../step1-transfer-gate/README.md)で別に観察します。後続課題の失敗をFoundation Gateの成功へ丸めず、どの前提または教材接続が不足したかを各記録から追跡します。
