# 参加者用課題票 — 注意切替パイロット

## 依頼

別の研究者から、4名分の合成パイロットデータが届きました。正答試行だけを使い、参加者ごとの切替コストを記述してください。

切替コストは、各参加者について次の向きで定義します。

```text
switch_cost_ms = switch条件の平均response_ms - repeat条件の平均response_ms
```

これは小規模な合成データです。母集団への一般化や、`trained`と`control`の効果差は結論しません。

## 渡されるファイル

- `data/transfer/switch_trials_dirty.csv`
- `data/transfer/switch_participants.csv`

試行表の1行は1試行です。列は`participant_id`、`trial_type`、`response_ms`、`is_correct`、`block`です。`trial_type`の分析対象は`repeat`と`switch`、反応時間の仮の許容範囲は100〜3000msとします。

## 作るもの

`step1_transfer.R`を作り、空のRセッションから上から実行すると次の4ファイルを再生成できるようにしてください。

1. `data/processed/switch_trials_issues.csv`
2. `data/processed/switch_trials_checked.csv`
3. `output/switch_costs.csv`
4. `output/transfer_note.txt`

問題一覧では、次のラベルを使います。

- `duplicate`
- `invalid_trial_type`
- `response_out_of_range`
- `unknown_participant`
- `missing_correct`

結果メモは3行にし、`分析対象:`、`記述結果:`、`解釈の限界:`で始めてください。何を分析し、データ内で何が記述され、何を結論できないかを分けます。

## 守る条件

- raw CSVを編集・上書きしない
- 期待する列名、列型、参加者キーを分析前に確認する
- 5つの品質ルールを別々に検査し、問題行を追跡可能にする
- 問題行を除いた後に、同じルールを再検査する
- 正答試行だけを集計し、参加者×条件の1行の意味を確認する
- 保存したファイルを読み直し、列名・行数・値を確認する
- 最後にrawのfingerprintが作業前と同じか確かめる

## 利用できる支援

自分で選んだRの`?関数名`、RStudio Help、利用パッケージの公式文書は参照できます。参照したものは観察者へ伝えてください。エラーメッセージを読み、途中の表を表示して調べることもできます。

初回提出までは、中心課題の`step1_analysis.R`、NB1、公開版`step1-transfer.qmd`、`step1_transfer_check.R`、他者の回答、生成AIは使いません。構文を思い出せないときは、黙って止まらず公式ヘルプを探してください。

## 完了時

完成したと思った時点で観察者へ伝えてください。観察者が初回成果物と作業前後のraw fingerprintを記録した後に、自己チェッカーを渡します。チェッカーが失敗しても、それだけで観察は終了しません。最初の結果を残したまま、出力を根拠に1回だけ修正できます。

最後に次の3点を説明してください。

1. 中心課題から再利用できた判断は何か。
2. 列名・条件名が変わったため修正した箇所はどこか。
3. この4名の結果から言えることと、言えないことは何か。
