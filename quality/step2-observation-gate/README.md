# STEP 2初心者観察ゲート

## 目的

L17〜L20を終えたR初学者が、認知課題の完成コードを再生するのではなく、デバイス負荷データへ分析単位、記述統計、条件別分布図、単位内対応図、保存契約、限定付き報告を移せるか観察します。

自動テストは配布物と採点動線の安全性を検査しますが、初心者の理解や転移の証拠ではありません。`status.json`は実観察が行われるまで`NOT RUN`のままです。

## 構成

- [参加者用ZIP](participant-pack.zip): 課題票と合成CSVだけ
- [参加者用課題票](PARTICIPANT_TASK.md)
- [観察プロトコル](OBSERVATION_PROTOCOL.md)
- [匿名記録票](OBSERVATION_RECORD.md)
- [進行役用採点キー](FACILITATOR_KEY.md)
- [コホート判断票](DECISION_RECORD.md)
- [機械判定状態](status.json)
- `step2_transfer_check.R`: 初回提出後だけ渡す自己チェッカー

## 実施前検証

```bash
npm run test:step2-observation-pack
npm run test:step2-observation-rehearsal
npm run gate:step2-observation:status
```

観察用ZIPは2ファイル限定、固定日時・固定圧縮、384行CSV、元ファイル一致、隠し期待値・採点キー・完成コードの非露出を検査します。RリハーサルはZIPを一時Projectへ展開し、6成果物を用意した後だけチェッカーを追加して採点できること、rawとZIPが変わらないことを確認します。

リハーサルfixtureやチェッカーPASSは参加者証拠へ数えません。

## 実施単位

- 適格なR初学者3〜5名
- L20修了から2〜7日後を推奨
- 1名ずつ最大90分
- 初回提出まで完成コード、採点キー、自己チェッカー、他者回答、生成AIを非公開
- 自発的な公式文書利用は許可し、構文暗記だけを測らない

## 証拠

原本を直接編集せず、対象commitを含むコピーへ匿名記録を置きます。

```text
quality/step2-observation-gate/evidence/
└── S2O-2026-08-01-<commit>/
    ├── learner-P01.md
    ├── learner-P02.md
    ├── learner-P03.md
    └── decision.md
```

保存するのは匿名要約、成果物の構造・fingerprint、支援水準、判断記録です。氏名、学籍番号、メール、成績、診断情報、録画・録音、生ログ、個人パスは保存しません。

## 状態

- `NOT RUN`: 未実施
- `OBSERVED`: 規定観察と匿名証拠が揃った
- `BLOCKED`: 外部要因または証拠不足で完了不能
- `INVALID`: 解答露出、誘導、主要記録欠落で初回条件が崩れた

現在は`NOT RUN`です。`OBSERVED`には、40桁の対象commit、HTTPS URL、S201〜S205の匿名証拠、適格記録3件以上、コホート判断票、主実装者と異なる独立レビュー、未解決P0・P1ゼロが必要です。未解決P2は所有者・期限・再検証条件を要求します。

`decision`を手で書き換えるだけでは機械判定を通りません。

## 倫理

参加は任意で、中止しても不利益がないことを説明します。これは教材改善の形成的観察です。研究発表、論文、成績評価へ転用する場合は、所属機関の倫理審査、追加同意、データ管理手順の要否を別途確認します。
