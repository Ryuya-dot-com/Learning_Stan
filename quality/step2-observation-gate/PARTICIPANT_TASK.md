# 参加者用課題票 — デバイス負荷テストの探索報告

## 依頼

16台の同じデバイスを`baseline`と`high_load`の2条件で測定した、教材用の合成データがあります。推測モデルへ進む前に、有効な測定だけをデバイス単位で要約し、条件内の分布と同じデバイスの変化が分かる探索報告を作ってください。

これは無作為化された実験の結果ではありません。統計的有意差、製品全体の母集団差、負荷条件の因果効果は結論しません。

## 入力

- `data/device_load_trials.csv`
- 列: `device_id`, `load_condition`, `reading`, `latency_ms`, `valid`
- 1行は1回の測定です
- `device_id`が同じ行は同じデバイスです
- `valid == TRUE`の測定だけを要約します

## 最初のコードを書く前に

観察者へ次を説明してください。

1. 入力の1行と、最終分析表の1行はそれぞれ何を表すか
2. 条件内分布を見る図と、同じデバイスの変化を見る図をどう分けるか
3. 線が結ぶ単位を何で指定するか
4. 保存する成果物と再生成順序
5. このデータから結論しないこと

## 作るもの

`step2_transfer.R`を作り、空のRセッションから上から実行すると次の6ファイルを再生成できるようにしてください。

1. `output/device_condition_summary.csv`
2. `output/descriptive_statistics.csv`
3. `output/device_differences.csv`
4. `output/condition_distributions.png`
5. `output/device_differences.png`
6. `output/exploratory_note.txt`

### CSV

- `device_condition_summary.csv`: `device_id`, `load_condition`, `n_valid`, `mean_latency`, `median_latency`
- `descriptive_statistics.csv`: `load_condition`, `n_devices`, `median_of_device_means`, `q1`, `q3`, `iqr`
- `device_differences.csv`: `device_id`, `baseline_mean_latency`, `high_load_mean_latency`, `high_load_minus_baseline`

列順もこの順にし、保存後に読み直して1行の意味を説明してください。

### 図

- 1枚は、条件ごとの分布を全デバイスの点を残して示す
- 1枚は、同じデバイスの2条件を対応付けて示す
- 各図は別のplotオブジェクトとして保存する
- 7×5 inch、300 dpi、白背景のPNGにする
- title、軸名、latencyの単位、各点・線の意味、合成データであることを図中へ残す

### 探索メモ

7行とし、各行を次の接頭辞で始めてください。

1. `データの由来:`
2. `分析対象:`
3. `図の選択理由（条件別分布）:`
4. `図の選択理由（デバイス内対応）:`
5. `観察結果:`
6. `解釈の限界:`
7. `再生成手順:`

完全な言い回しの暗記ではなく、成果物から追跡できる内容を自分の言葉で書きます。
`観察結果:`には、全デバイスの差の方向と`high_load - baseline`差の中央値を小数第2位まで含めてください。

## 守る条件

- 入力CSVを編集・上書きしない
- 集計前に列名、行数、条件、デバイス数、各デバイス・条件の測定数を確認する
- `valid == TRUE`だけを使う位置を説明する
- 条件別の全点と、同じデバイスだけを結ぶ線を混同しない
- `ggsave()`で`filename`, `plot`, `width`, `height`, `units`, `dpi`, `bg`を明示する
- 保存後に6成果物を読み直し、行数・列・画像寸法・メモ構造を確認する
- 最後に入力fingerprintが作業前と同じか確認する

## 利用できる支援

自分で選んだR Help、RStudio Help、R・利用パッケージの公式文書は参照できます。参照した資料は観察者へ伝えてください。途中の表やエラーを表示して調べることもできます。

初回提出までは、L17〜L20の完成版Rコード、`step2_transfer_check.R`、進行役用採点キー、他者の回答、生成AIを使いません。教材の概念説明を読み返す場合は、どの節を見たか記録します。

## 完了時

完成したと思った時点で観察者へ伝えてください。観察者が初回成果物、入力fingerprint、支援水準、完了時刻を固定した後に自己チェッカーを渡します。初回結果は修正後で上書きしません。

最後に次を説明してください。

1. 認知課題の参加者を、デバイスへ置き換えても維持した判断
2. 列名・分析単位・対応キーが変わったため変更した箇所
3. 2種類の図がそれぞれ答える問い
4. この合成データ内で言えることと、言えないこと
