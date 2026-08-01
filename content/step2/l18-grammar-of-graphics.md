# L18 データ・対応付け・図形を重ねる

## このレッスンのゴール

変数型と問いから`aes()`と`geom_*()`を選び、参加者平均の全点と分布要約を同時に示す図を作成できるようになります。

完成条件は、見本と同じ色の図を作ることではありません。L17の48行CSVを入力として、次の図を再生成し、データ・対応付け・図形・保存の責務を説明できることです。

- `output/condition_distributions.png`

## 1. まず作図入力の1行を確認する

```r
participant_condition <- readr::read_csv(
  "output/participant_condition_summary.csv",
  show_col_types = FALSE
)

c(
  nrow(participant_condition),
  dplyr::n_distinct(participant_condition$id),
  dplyr::n_distinct(participant_condition$condition)
)
```

```text
[1] 48 24  2
```

作図入力の1行は「ある参加者の、ある条件における正答試行の要約」です。したがって参加者点の層は48点を受け取ります。960試行を直接描く図でも、24名を1点ずつ描く図でもありません。

## 2. `ggplot()`と`aes()`は図形を描かない

```r
base_plot <- ggplot2::ggplot(
  participant_condition,
  ggplot2::aes(x = condition, y = mean_rt)
)
```

`ggplot()`は使用するデータを、`aes()`は列と視覚属性の対応を定義します。ここではカテゴリ変数`condition`を横位置、連続変数`mean_rt`を縦位置へ対応付けました。この段階では、まだ点や箱はありません。

`aes(color = condition)`は列の値に応じて色を対応付けます。一方、`color = "#1F2937"`を`aes()`の外に置くと、全要素へ同じ色を設定します。`aes(color = "condition")`は列参照ではなく、文字列`condition`を全行へ対応付けるので意図と異なります。

## 3. 分布要約と全参加者点を別レイヤーで重ねる

```r
jitter_position <- ggplot2::position_jitter(
  width = 0.08,
  height = 0,
  seed = 20260802
)

condition_plot <- base_plot +
  ggplot2::geom_boxplot(
    ggplot2::aes(fill = condition),
    width = 0.48,
    outlier.shape = NA,
    alpha = 0.22,
    color = "#1F2937"
  ) +
  ggplot2::geom_point(
    ggplot2::aes(fill = condition),
    position = jitter_position,
    shape = 21,
    size = 2.7,
    stroke = 0.45,
    color = "#1F2937",
    alpha = 0.88
  )
```

箱ひげは中央値と四分位範囲を要約し、点は48行を隠さず示します。`outlier.shape = NA`は外れた参加者をデータから除外する指定ではありません。同じ点を箱ひげの外れ値記号と参加者点で二重表示しないための表示指定です。

`position_jitter()`は、重なる点を見やすくするため横位置だけを少し動かします。`height = 0`なので反応時間の縦位置は変えません。seedを固定し、再生成するたびに点の横位置が変わらないようにします。

## 4. 軸・単位・データ由来を図の中へ残す

```r
condition_plot <- condition_plot +
  ggplot2::scale_x_discrete(
    labels = c(cong = "Congruent", incong = "Incongruent")
  ) +
  ggplot2::scale_fill_manual(
    values = c(cong = "#0072B2", incong = "#D55E00"),
    guide = "none"
  ) +
  ggplot2::labs(
    title = "Condition distributions of participant mean RT",
    subtitle = "24 participants; each point is one participant-condition mean",
    x = "Condition",
    y = "Mean correct-trial RT (ms)",
    caption = paste(
      "Synthetic teaching data.",
      "Descriptive summary; no population or causal claim."
    )
  ) +
  ggplot2::theme_minimal(base_size = 12) +
  ggplot2::theme(
    panel.grid.minor = ggplot2::element_blank(),
    plot.title.position = "plot"
  )
```

図だけが切り離されても、何の値か、単位は何か、実データか、どこまで主張しているかを追跡できます。色は条件識別を補助しますが、条件は横位置でも区別できるため、色だけに意味を依存させません。

## 5. 寸法と対象plotを明示して保存する

```r
dir.create("output", showWarnings = FALSE)
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

この段階では実行契約として保存まで行います。`plot = condition_plot`を明示し、最後に画面表示した別の図を誤保存しないようにします。寸法・解像度・報告媒体の詳しい選択はL20で扱います。

生成画像は2100×1500 pxです。ファイルが存在するだけでなく、入力48行、箱ひげ2群、参加者点48個、軸ラベル、caption、画像寸法を自動検査します。

## 図から観察できること・できないこと

この合成パイロットでは、incong条件の参加者平均分布がcong条件より高い側にあります。また両条件とも参加者間のばらつきがあります。

ただし、この図では同じ参加者の2条件が線で結ばれていません。誰の差が大きいか、全員が同じ方向かを読むにはL19の対応図が必要です。また、図だけから有意差、母集団差、因果効果を結論しません。

## よくある誤り

- `aes()`だけで点や箱が描かれると思う。
- `aes(color = "condition")`と書き、列ではなく同じ文字列を対応付ける。
- 条件平均の棒だけを描き、24名の値と分布を隠す。
- jitterで縦位置まで動かし、反応時間そのものを変えて見せる。
- `ggsave()`で`plot`や寸法を省略し、別の図や端末依存サイズを保存する。
- 合成データ表記とms単位を図から落とす。

## 内容理解問題

問題の正本は`assessments.json`です。

1. `step2-l18-q1-aes-roles`: `aes()`、`geom_*()`、保存の責務を区別する。
2. `step2-l18-q2-point-count`: 作図前に参加者点の数を予測する。
3. `step2-l18-q3-mapped-vs-fixed`: 列への対応付けと固定文字列を診断する。
4. `step2-l18-q4-why-points`: 箱ひげと全点を重ねる理由・限界を説明する。
5. `step2-l18-q5-transfer-yield`: 品種×収量の未見データへ作図方針を移す。

選択問題だけでL18を実践済みにはしません。完成図の再生成、図を選んだ理由、未見データへの転移を別々に確認します。

## 直接評価

1. L17の48行CSVから、2条件の箱ひげと48参加者点を持つPNGを再生成する。
2. `aes()`、箱ひげ、点、jitter、`ggsave()`の責務をそれぞれ説明する。
3. 棒グラフだけにせず全点を残した理由と、この図から結論できないことを書く。
4. 3品種×収量kgの未見データで、変数型から対応付けとレイヤーを選び直す。

## 公式資料

- ggplot2 `ggplot()`: https://ggplot2.tidyverse.org/reference/ggplot.html
- ggplot2 `aes()`: https://ggplot2.tidyverse.org/reference/aes.html
- ggplot2 `geom_boxplot()`: https://ggplot2.tidyverse.org/reference/geom_boxplot.html
- ggplot2 `position_jitter()`: https://ggplot2.tidyverse.org/reference/position_jitter.html
- ggplot2 `ggsave()`: https://ggplot2.tidyverse.org/reference/ggsave.html
