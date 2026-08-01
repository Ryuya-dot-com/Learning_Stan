# STEP 1 独立転移観察キット

## 目的

L16まで終えたR初学者が、中心課題の列名や完成コードをそのまま再生するのではなく、別の注意切替データへ品質検査・整形・集計・保存・限定付き解釈を移せるかを形成的に観察します。

このキットは、L12直後の品質判断を測る[STEP 1 Data Quality Gate](../step1-data-gate/README.md)とは別です。前者は「読めた」と「分析可能」を区別できるか、こちらはSTEP 1全体を別シナリオで再構成できるかを扱います。自動チェッカーの成功、満足度、少人数の完遂率だけを、学習効果や母集団の達成率として一般化しません。

## 使用する文書

- [参加者へ渡す観察用ZIP](participant-pack.zip)
- [機械判定する現在状態](status.json)
- [参加者用課題票](PARTICIPANT_TASK.md)
- [観察プロトコル](OBSERVATION_PROTOCOL.md)
- [進行役用の準備・採点キー](FACILITATOR_KEY.md)
- [匿名観察記録票](OBSERVATION_RECORD.md)
- [コホート判断記録](DECISION_RECORD.md)

参加者には`PARTICIPANT_TASK.md`だけを渡します。`FACILITATOR_KEY.md`、完成版`step1_analysis.R`、NB1、公開版の転移課題、自己チェッカーは、初回成果物の提出が終わるまで見せません。

観察用ZIPは、参加者用課題票と転移CSV 2件だけを含む固定配布物です。`npm run test:step1-transfer-observation-pack`で、完成版・採点キー・自己チェッカー・期待件数・期待値が入っていないことを確認してから使います。

参加者募集前に`npm run test:step1-transfer-observation-rehearsal`も実行します。このリハーサルはZIPを一時Projectへ展開し、初回提出時点では自己チェッカーが存在しないこと、4成果物を固定した後にだけ進行役がチェッカーを追加して採点できること、rawと元ZIPが変わらないことをRで確認します。これは運用検査であり、学習者観察や`OBSERVED`の証拠には数えません。

## 実施単位

- 最初のコホートは適格なR初学者3〜5名
- L11〜L16を終えてから2〜7日後を推奨
- 1名ずつ、最大75分。休憩と外部要因は時間から分けて記録
- 自発的なRヘルプと公式パッケージ文書の利用は許可し、構文の記憶力だけを測らない
- 中心課題の完成コード、他者の回答、生成AI、自己チェッカーの利用は初回提出まで不可

実施前に`participant-pack.zip`を参加者ごとに新しい場所へ展開し、展開後の単一フォルダをRStudio Projectとして開きます。公開版のSTEP 1スターターZIPは、解答やチェッカーを含むため規定観察には使いません。

## 証拠の置き方

原本へ直接書き込まず、対象commit SHAと実施日を含むコピーを作ります。

```text
quality/step1-transfer-gate/evidence/
└── STR-2026-08-01-<commit>/
    ├── learner-P01.md
    ├── learner-P02.md
    ├── learner-P03.md
    └── decision.md
```

保存するのは匿名の観察要約、成果物の件数・fingerprint、支援水準、判断記録です。氏名、学籍番号、メール、成績、診断情報、録画・録音、生のコンソール履歴、端末の個人パスは保存しません。

## 状態

- `NOT RUN`: 未実施
- `OBSERVED`: 規定手順で初回提出まで観察し、匿名記録が揃った
- `BLOCKED`: 端末、権限、時間などの外部要因で実施不能
- `INVALID`: 解答やチェッカーの事前露出、誘導、主要記録の欠落があった

現時点の状態は`NOT RUN`です。文書やテストが存在するだけで`OBSERVED`にしません。最低3名の規定観察、問題の重要度、修正所有者、反証条件を記録するまで、STEP 1の独立転移を対象者検証済みとは扱いません。

```bash
npm run gate:step1-transfer:status
# STEP 1 Transfer Observation: NOT RUN

npm run gate:step1-transfer:require-observed
# 規定証拠が揃うまでは終了コード1

npm run test:step1-transfer-observation-rehearsal
# STEP 1 transfer observation REHEARSAL PASS
```

`status.json`の`decision`を手で`OBSERVED`へ変えるだけでは通りません。対象commit SHAとURL、TR01〜TR05の匿名証拠、適格な完了記録3件以上、コホート判断票、主実装者と異なる独立レビュー、未解決P0・P1が0件であることを機械判定します。プロトコル汚染は`INVALID`、外部要因や証拠不足は`BLOCKED`として、未実施と区別します。

## 倫理と利用範囲

参加は任意で、中止しても不利益がないことを事前に説明します。これは教材改善のための形成的観察です。正式な研究、論文、学会発表、成績評価へ転用する場合は、所属機関の倫理審査、追加同意、データ管理手順の要否を別途確認します。
