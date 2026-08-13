# L17 分析単位を決めて分布を要約する

## このレッスンのゴール

試行数と参加者数を区別し、参加者×条件の要約表から中央値・四分位範囲・個人差を説明できるようになります。

完成条件は、関数名を覚えることではありません。空のEnvironmentから次の4成果物を再生成し、なぜ960試行を960人分の証拠として扱わないか説明できることです。

- `output/participant_condition_summary.csv`
- `output/descriptive_statistics.csv`
- `output/participant_differences.csv`
- `output/exploratory_note.txt`

## 1. 最初に「何が1つの観測か」を決める

入力には24名×2条件×20試行、合計960行があります。正答試行だけに絞ると884行です。しかし、同じ参加者の反応は繰り返し測定なので、884行を884人として扱えません。

このレッスンでは次の2段階で要約します。

1. 試行を参加者×条件へまとめ、48行の分析単位を作る。
2. 48行の参加者平均を条件別にまとめ、参加者間の分布を記述する。

```r
trials <- readr::read_csv(
  "data/expanded_pilot_trials.csv",
  show_col_types = FALSE
)

correct_trials <- trials |>
  dplyr::filter(correct)

c(nrow(trials), nrow(correct_trials), dplyr::n_distinct(trials$id))
```

```text
[1] 960 884  24
```

行数、正答行数、参加者数は別の数量です。レポートでは単に`n = 884`と書かず、「24名から得た884正答試行」と単位を付けます。

## 2. 参加者×条件の48行を作る

```r
participant_condition <- correct_trials |>
  dplyr::group_by(id, condition) |>
  dplyr::summarise(
    n_correct = dplyr::n(),
    mean_rt = mean(rt_ms),
    median_rt = median(rt_ms),
    .groups = "drop"
  )

c(nrow(participant_condition), dplyr::n_distinct(participant_condition$id))
```

```text
[1] 48 24
```

`n_correct`を残すのは、参加者・条件ごとに平均へ使われた試行数が違うためです。平均値だけを保存すると、どの程度の観測から作られた値か追跡できません。

## 3. 中央値と四分位範囲で分布を要約する

```r
descriptive_statistics <- participant_condition |>
  dplyr::group_by(condition) |>
  dplyr::summarise(
    n_participants = dplyr::n(),
    n_correct_trials = sum(n_correct),
    mean_of_participant_means = mean(mean_rt),
    median_of_participant_means = median(mean_rt),
    q1 = quantile(mean_rt, 0.25, names = FALSE),
    q3 = quantile(mean_rt, 0.75, names = FALSE),
    iqr = IQR(mean_rt),
    .groups = "drop"
  )
```

| condition | participants | correct trials | mean | median | Q1 | Q3 | IQR |
|---|---:|---:|---:|---:|---:|---:|---:|
| cong | 24 | 453 | 499.09 | 510.73 | 487.42 | 536.22 | 48.80 |
| incong | 24 | 431 | 568.71 | 580.42 | 552.00 | 595.77 | 43.77 |

中央値は、参加者平均を小さい順に並べた中央付近です。Q1とQ3は中央50%の範囲の両端、IQRは`Q3 - Q1`です。Rの`quantile()`には複数の計算法があり、ここでは既定の`type = 7`を使います。別ソフトと値を照合するときは計算法も記録します。

平均と中央値のどちらか一方を「常に正しい代表値」とは扱いません。両方と個々の点を見て、長い裾や極端な参加者が結果へ与える影響を次の作図で確かめます。

## 4. 参加者内差を別表にする

```r
participant_differences <- participant_condition |>
  dplyr::select(id, condition, mean_rt) |>
  dplyr::filter(condition == "incong") |>
  dplyr::rename(incong_mean_rt = mean_rt) |>
  dplyr::inner_join(
    participant_condition |>
      dplyr::filter(condition == "cong") |>
      dplyr::select(id, cong_mean_rt = mean_rt),
    by = "id"
  ) |>
  dplyr::mutate(incong_minus_cong = incong_mean_rt - cong_mean_rt)
```

この合成データでは24名全員の差が正で、範囲は33.79〜108.78ms、中央値は64.71msです。これは24名の合成パイロット内の記述であり、母集団でも必ず正になることや、条件が反応時間を因果的に変えたことを証明しません。

## 5. 成果物を保存して読み直す

```r
dir.create("output", showWarnings = FALSE)
readr::write_csv(
  participant_condition,
  "output/participant_condition_summary.csv"
)
readr::write_csv(
  descriptive_statistics,
  "output/descriptive_statistics.csv"
)
readr::write_csv(
  participant_differences,
  "output/participant_differences.csv"
)
```

保存したCSVは再読込し、48行・2条件・24名になっていることを確認します。出力をExcelで手修正せず、変更が必要ならRスクリプトを直して再生成します。

## よくある誤り

- `nrow(correct_trials)`を参加者数として報告する。
- 全試行を直接平均し、正答数の多い参加者へ暗黙に大きな重みを与える。
- 平均だけを示し、中央値・四分位・全参加者の点を確認しない。
- 合成データであることを書かない。
- 探索的要約から「有意差がある」「母集団でも同じ」と飛躍する。

## 内容理解問題

問題の正本は`assessments.json`です。正答だけでなく、誤答がどの区別へ戻る必要を示すか、記述回答を何で判定するかも保持しています。

1. `step2-l17-q1-row-count`: 参加者×条件へ要約した後の行数を実行前に予測する。
2. `step2-l17-q2-row-meaning`: 要約表の1行の意味を、試行・参加者・母集団と区別する。
3. `step2-l17-q3-iqr`: IQRを人数・条件差・母集団確率と混同せず説明する。
4. `step2-l17-q4-independence-explanation`: 884正答試行を884人として扱えない理由を説明する。
5. `step2-l17-q5-transfer-diary`: 30名×7日の日誌データで分析単位を作り直す。

選択問題は形成的な理解確認です。L17の実践完了には、空のEnvironmentから3CSVと探索メモを再生成し、未見文脈でも1行の意味を説明できることが必要です。

## 直接評価

1. 48行の参加者×条件CSV、2行の条件別記述統計CSV、24行の参加者内差CSV、限界付き探索メモを再生成する。
2. 「884正答試行を884人として扱えない理由」を3文以内で説明する。
3. 平均と中央値が異なるとき、元の参加者点を次に確認すると説明する。
4. 列名を変えた未見データで、参加者×条件の分析単位を作り直す。

## 公式資料

- R `quantile()`: https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html
- R `IQR()`: https://stat.ethz.ch/R-manual/R-devel/library/stats/html/IQR.html
