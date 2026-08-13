# STEP 2教材パック

STEP 2「統計・可視化編」の原稿、理解問題、合成データ、完成版Rスクリプトをまとめた開発用パックです。L17〜L20は`src/data/lessons/3-stats/`から公開アプリへ組み込まれています。

## 学習内容

- 1つの分析依頼でL17〜L20を接続する
- 試行数と参加者数を区別し、参加者を分析単位とする
- 平均だけでなく中央値・四分位範囲・個人差を見る
- 図の見た目ではなく、変数型と問いから図を選ぶ
- `ggsave()`で寸法を明示した図を再生成する
- p値や母集団一般化へ進む前に、探索結果と限界を分けて報告する

## 含まれるもの

- `curriculum.json`: 永続的な意味ID、表示番号、依存関係、評価証拠
- `scenario.md`: 拡大合成パイロットの依頼、入力、成果物、非主張事項
- `l17-descriptive-statistics.md`〜`l20-report-and-transfer.md`: 公開レッスンの原稿
- `assessments.json`: 20問の基本問題、3問の累積復習、誤答診断、記述rubric、転移課題、修了条件に含めない任意チャレンジ4問
- `assessment-guide.md`: 理解問題と実技証拠を混同しない評価設計
- `data/expanded_pilot_trials.csv`: 固定seedで生成した24名×2条件×20試行
- `examples/`: 3CSV・2図・探索メモを再生成するRスクリプト
- `validation.json`: データfingerprintと期待する記述統計

## 公開と改善の方針

教材は、内容・実行・表示に関する自動検査を通したうえで公開します。初学者の感想や利用観察は公開の前提にせず、公開後に説明量、ファイル配置、練習、アクセシビリティを改善するために使います。少人数の感想を学習効果や母集団の達成率として一般化しません。

各レッスンは、基本確認から説明・未見転移へ進む基本問題5問と、「まねる→変える→見ずに作る→別場面へ移す」の4段階練習を持ちます。V2以降では、前に学んだ技能を現在の技能と結び直す累積復習を1問加えます。さらに欠測、歪んだ分布、対応欠落、古い成果物の混在を扱う任意チャレンジを1問ずつ置きます。任意チャレンジは段階ヒントと自己評価用の観点を持ちますが、学習の修了条件には数えません。

## 検証

```bash
npm run test:step2-samples
npm run test:step2-content
npm run test:step2-assessments
npm run test:step2-descriptive
npm run test:step2-condition-plot
npm run test:step2-participant-differences
npm run test:step2-report-and-transfer
```

自動検査はコードと教材の整合性を確認するもので、学習者が技能を身につけたことを証明するものではありません。公開後のフィードバックは、再現できる問題と具体的な改善案へ分けて記録します。
