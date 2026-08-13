# L20 図を保存し、選択理由と限界を報告する

## このレッスンのゴール

これまでの3レッスンで作った2図・3CSV・探索メモを、空のRセッションから1本の入口スクリプトで再生成します。そのうえで、第三者が次の4点を追跡できる最終分析パックにします。

1. どの入力を使ったか
2. なぜ2種類の図を選んだか
3. この合成データで何を観察したか
4. まだ何を主張できないか

完成条件は「画面に図が出た」ではありません。次の6ファイルがコードから再生成され、内容と役割を説明できることです。

- `output/participant_condition_summary.csv`
- `output/descriptive_statistics.csv`
- `output/participant_differences.csv`
- `output/condition_distributions.png`
- `output/participant_differences.png`
- `output/exploratory_note.txt`

学習ホームから4本のRスクリプトをダウンロードし、Project直下の同じフォルダへ置きます。空のRセッションで`step2_report_and_transfer.R`を実行すると、これまでに作った処理が順番に動きます。

## 1. 「保存」と「再生成可能」は違う

RStudioのExportボタンから手作業で保存した図は、見た目が同じでも、幅・高さ・解像度・背景色・元コードを第三者が追跡できません。`ggsave()`では、保存対象まで明示します。

```r
ggplot2::ggsave(
  filename = "output/condition_distributions.png",
  plot = condition_plot,
  width = 7,
  height = 5,
  units = "in",
  dpi = 300,
  bg = "white"
)
```

この指定では横が`7 × 300 = 2100 px`、縦が`5 × 300 = 1500 px`です。`plot = condition_plot`を省略すると「最後に表示した図」へ依存するため、別の図を保存しても気づきにくくなります。ファイル名、plot、寸法、単位、dpi、背景を1組の**保存条件**としてコードへ残します。

## 2. 入口を1本にする

4本のスクリプトを手で順番に選ぶと、条件分布図だけを先に実行したり、古いCSVを読み込んだりできます。このレッスンでは実行順をコードにします。

```r
analysis_scripts <- c(
  "step2_descriptive.R",
  "step2_condition_plot.R",
  "step2_participant_differences_plot.R"
)

analysis_environment <- new.env(parent = asNamespace("stats"))
for (script in analysis_scripts) {
  source(
    script,
    local = analysis_environment,
    encoding = "UTF-8"
  )
}
```

`source()`は指定したファイルを読み、式を順番に評価します。`local = analysis_environment`により、途中で作るオブジェクトを普段のGlobal Environmentへ散らしません。親には`median()`や`IQR()`を提供する`stats`名前空間だけを指定します。ただし、専用environmentへ入れただけで再現性が証明されるわけではありません。入力ファイル、パッケージ、実行順、出力検査も必要です。

## 3. 入力を壊していないか確認する

```r
input_path <- "data/expanded_pilot_trials.csv"
input_md5_before <- unname(tools::md5sum(input_path))

# これまでの3つの処理を順に実行

stopifnot(
  identical(unname(tools::md5sum(input_path)), input_md5_before)
)
```

チェックサムはファイル内容の指紋として使えます。ここで確認しているのは「実行前後で入力が変わっていないこと」です。チェックサムが一致しても、分析方法が妥当、データが本物、結論が正しい、という証明にはなりません。

## 4. 6つの成果物を役割ごとに確認する

```r
expected_outputs <- c(
  "output/participant_condition_summary.csv",
  "output/descriptive_statistics.csv",
  "output/participant_differences.csv",
  "output/condition_distributions.png",
  "output/participant_differences.png",
  "output/exploratory_note.txt"
)

stopifnot(all(file.exists(expected_outputs)))

output_check <- data.frame(
  path = expected_outputs,
  bytes = unname(file.info(expected_outputs)$size),
  md5 = unname(tools::md5sum(expected_outputs))
)
```

`file.exists()`だけでは、空ファイルや古い成果物も通ります。完成版では行数、参加者数、差の方向、画像寸法、メモの節、ファイルサイズ、チェックサムも確認します。`output_check`はConsoleへ表示し、成果物を1つ増やすためのファイルにはしません。最終成果物はあくまで2図・3CSV・探索メモです。

## 5. 図は「優劣」ではなく「問い」で選ぶ

| 知りたいこと | 主に使う成果物 | その成果物だけでは分からないこと |
|---|---|---|
| 条件ごとの中央値・中央50%・参加者間のばらつき | `condition_distributions.png` | 同じ人の2点の対応 |
| 各参加者の変化方向・差の大きさ | `participant_differences.png` | 母集団での効果や因果効果 |
| 正確な要約値・参加者内差 | 3つのCSV | 図としての分布形状 |
| 分析対象・選択理由・限界 | `exploratory_note.txt` | データや図そのもの |

条件分布図と対応図は、同じ主張を重複させる図ではありません。条件内分布と参加者内対応という別の問いに答え、互いの死角を補います。p値、信頼区間、比較対照、標本抽出設計などがない段階で、どちらかを「効果の証明」に使ってはいけません。

## 6. 観察と主張を分けて書く

この合成データで直接確認できたことは、次の範囲です。

- 24名、884正答試行を参加者×条件の48行へ要約した
- 参加者平均RTの中央値はcong 510.73 ms、incong 580.42 msだった
- 24名全員で`incong - cong`が正だった
- 差の中央値は64.71 ms、範囲は33.79〜108.77 msだった

一方、この教材では次を結論しません。

- 「統計的に有意である」
- 「母集団でも必ず同じ差になる」
- 「条件操作が反応時間差を引き起こした」
- 「実在の参加者や研究で得られた結果である」

最終メモは、`データの由来`、`分析対象`、2つの`図の選択理由`、`観察結果`、`解釈の限界`、`再生成手順`を別々の行にします。強い言葉を避けるだけでは不十分です。主張の根拠となる成果物と、根拠が届かない境界を明記します。

## 7. 未見データへ移す5つの質問

列名や題材が変わったときは、覚えたgeomを先に選びません。次の順番で問い直します。

1. 1行は何を表すか
2. 分析単位は誰・何か
3. 同じ単位を結ぶ対応キーがあるか
4. 条件内分布と単位内変化のどちらを見たいか
5. データ由来と設計から、何を主張できないか

例えば、同じ20名の通常睡眠日と睡眠制限日の覚醒度得点なら、`participant_id`で対応付けた点と線は単位内変化を示します。条件別の全点と箱ひげは得点分布を示します。しかし観察データなら、図だけから睡眠制限の因果効果を結論しません。縦軸には得点尺度、captionにはデータ由来、保存コードには寸法を残します。

## よくある誤り

- Exportボタンで保存し、再現可能だと思う
- `ggsave()`の`plot`を省略し、最後に表示した別の図を保存する
- widthとheightを書いても`units`や`dpi`を書かない
- ファイルが存在するだけで、中身・行数・寸法を検査しない
- 箱ひげ図と対応図を、どちらも「差がある証拠」とだけ説明する
- チェックサム一致を、分析の妥当性やデータの真正性の証明とみなす
- 合成標本の全員が同方向だったことを、母集団差や因果効果へ拡張する
- 未見課題で列名だけを置換し、分析単位と対応キーを考え直さない

## 内容理解問題

問題の正本は`assessments.json`です。

1. `step2-l20-q1-pixel-contract`: 7×5 inch・300 dpiのPNG寸法を予測する。
2. `step2-l20-q2-supported-claim`: 最終成果物が直接支える記述を選ぶ。
3. `step2-l20-q3-audit-gap`: 手作業保存された図の再現性欠落を診断する。
4. `step2-l20-q4-final-report`: 2図の選択理由、観察、限界、再生成手順を報告する。
5. `step2-l20-q5-transfer-sleep`: 未見の睡眠・覚醒度データで図と出力契約を選び直す。

選択問題に正解しただけでは、L20を実践済みとはしません。空のRセッションから6成果物を再生成し、未見データでも分析単位・対応キー・図の役割・非主張事項を説明できることを別に確認します。

## 直接評価

1. 空のRセッションから`step2_report_and_transfer.R`だけを実行する。
2. 2図・3CSV・探索メモの6成果物を再生成する。
3. 2図が7×5 inch・300 dpi・2100×1500 pxであることを確認する。
4. 探索メモで由来、分析対象、図の選択理由、観察、限界、再生成手順を分離する。
5. 列名と題材を変えた反復測定データで、図と非主張事項を選び直す。

## 公式資料

- R `source()`: https://stat.ethz.ch/R-manual/R-devel/library/base/html/source.html
- R `tools::md5sum()`: https://stat.ethz.ch/R-manual/R-devel/library/tools/html/md5sum.html
- ggplot2 `ggsave()`: https://ggplot2.tidyverse.org/reference/ggsave.html
