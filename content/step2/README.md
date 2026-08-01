# STEP 2教材パック（非公開ドラフト）

このディレクトリは、STEP 2「統計・可視化編」を公開アプリへ組み込む前の設計・実行・検証単位です。現在の状態は`draft-unpublished`です。`src/data/lessons/3-stats/`には配置せず、Foundation Gate、STEP 1観察、STEP 2初心者観察を迂回して公開しません。

## この段階で固定するもの

- 1つの分析依頼でL17–L20を接続する
- 試行数と参加者数を区別し、参加者を分析単位とする
- 平均だけでなく中央値・四分位範囲・個人差を見る
- 図の見た目ではなく、変数型と問いから図を選ぶ
- `ggsave()`で寸法を明示した図を再生成する
- p値や母集団一般化へ進む前に、探索結果と限界を分けて報告する

## 含まれるもの

- `curriculum.json`: 永続的な意味ID、暫定表示番号、依存関係、直接評価証拠
- `scenario.md`: 拡大合成パイロットの依頼、入力、成果物、非主張事項
- `l17-descriptive-statistics.md`: L17の縦切り原稿
- `l18-grammar-of-graphics.md`: L18の作図文法と条件別分布図の縦切り原稿
- `l19-individual-differences.md`: L19の参加者内対応図と個人差の縦切り原稿
- `l20-report-and-transfer.md`: L20の一括再生成、図の選択理由、限界、未見転移の縦切り原稿
- `assessments.json`: L17–L20の理解問題、誤答診断、記述rubric、転移課題
- `assessment-guide.md`: 理解問題と実技証拠を混同しない評価設計
- `data/expanded_pilot_trials.csv`: 固定seedで生成した24名×2条件×20試行
- `examples/step2_descriptive.R`: L17成果物を再生成する完成版Rスクリプト
- `examples/step2_condition_plot.R`: L17の48行CSVからL18のPNGを再生成する完成版Rスクリプト
- `examples/step2_participant_differences_plot.R`: 同じIDの2条件を結ぶL19 PNGの完成版Rスクリプト
- `examples/step2_report_and_transfer.R`: 2図・3CSV・探索メモを一括再生成して監査するL20入口スクリプト
- `validation.json`: データfingerprintと期待する記述統計

## IDと順序の方針

`displayNumber`は公開時の表示候補、`id`は意味に基づく永続キーです。未公開範囲の番号変更で、依存関係や将来の進捗データを壊さないように分離します。

回帰ブリッジはSTEP 2の後、STEP 3の前に置きます。階層モデル・二値GLMM・反応時間モデルは1レッスンへ詰め込まず、Stan編の公開番号を確定する前に分割します。

## 検証

```bash
npm run test:step2-samples
npm run test:step2-content
npm run test:step2-assessments
npm run test:step2-descriptive
npm run test:step2-condition-plot
npm run test:step2-participant-differences
npm run test:step2-report-and-transfer
npm run test:step2-observation-pack
npm run test:step2-observation-rehearsal
npm run gate:step2-observation:status
```

自動検証は、教材の実行可能性と内部整合を確認します。初心者が図を選べることや、試行数と参加者数を区別できることの証明にはなりません。

## 公開候補への昇格条件

1. Foundation Gateの必須項目が満たされる。
2. STEP 1データ品質観察と独立転移観察の結果が記録される。
3. その観察結果をSTEP 2の説明量・ファイル配置・支援水準へ反映する。
4. L17–L20の掲載コード、成果物、転移課題がクリーン環境で再生成できる。
5. 初学者が未見データに対して図を選び、選択理由と限界を説明できる。
6. STEP 2初心者観察ゲートが、適格な匿名記録3件以上と独立レビューを伴って`OBSERVED`になる。
