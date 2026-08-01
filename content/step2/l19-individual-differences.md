# L19 平均の背後にある個人差を示す

## このレッスンのゴール

対応のあるデータを参加者IDで結び、条件別分布だけでは失われる参加者内変化の方向とばらつきを説明できるようになります。

完成条件は、線を多く描くことではありません。L17の2つのCSVを入力として次の図を再生成し、線が誰と誰を結んでいるか、L18の分布図と何が違うか、どこまで結論できるかを説明できることです。

- `output/participant_differences.png`

## 1. 2条件が同じ参加者にそろっているか確認する

```r
participant_condition <- readr::read_csv(
  "output/participant_condition_summary.csv",
  show_col_types = FALSE
)
participant_differences <- readr::read_csv(
  "output/participant_differences.csv",
  show_col_types = FALSE
)

pair_counts <- participant_condition |>
  dplyr::count(id, name = "n_conditions")

c(
  nrow(participant_condition),
  nrow(pair_counts),
  sum(pair_counts$n_conditions == 2),
  nrow(participant_differences)
)
```

```text
[1] 48 24 24 24
```

24名全員に2条件があり、参加者内差も24行あります。片方の条件が欠けた参加者を無視して線を描くと、図に出なかった欠測を見落とします。作図前にIDごとの条件数と、差CSVのID一致を検査します。

## 2. L18の分布図とL19の対応図は答える問いが違う

L18の箱ひげ＋全点図は、各条件の中央値、四分位、参加者間の分布を読みやすくします。しかし、congの点とincongの点のどれが同じ参加者かは分かりません。

L19では、同じIDの2条件を1本の線で結びます。線の傾きから各参加者の変化方向を、縦方向の長さから差の大きさを追跡できます。条件内分布と参加者内変化は別の問いなので、2つの図を補完的に使います。

## 3. `group = id`で線の接続単位を指定する

```r
participant_condition <- participant_condition |>
  dplyr::mutate(
    condition = factor(condition, levels = c("cong", "incong"))
  )

paired_plot <- ggplot2::ggplot(
  participant_condition,
  ggplot2::aes(x = condition, y = mean_rt)
) +
  ggplot2::geom_line(
    ggplot2::aes(group = id),
    color = "#6B7280",
    linewidth = 0.7,
    alpha = 0.68
  ) +
  ggplot2::geom_point(
    ggplot2::aes(fill = condition),
    shape = 21,
    size = 2.8,
    stroke = 0.45,
    color = "#1F2937",
    alpha = 0.92
  )
```

`group = id`は、線の描画単位を参加者ごとに分けます。これがなければ、離散的な横軸から推測される既定groupは「同じ参加者の2点」にならず、意図した対応線を描けません。

入力は48行ですが、線は24本です。1人につき2点と、それらを結ぶ1本の線があります。線へ24色を割り当てると読みにくくなるため、線は同じ灰色にし、条件は横位置と点の塗りで区別します。

## 4. 軸・対応・限界を図の中へ残す

```r
paired_plot <- paired_plot +
  ggplot2::scale_x_discrete(
    labels = c(cong = "Congruent", incong = "Incongruent")
  ) +
  ggplot2::scale_fill_manual(
    values = c(cong = "#0072B2", incong = "#D55E00"),
    guide = "none"
  ) +
  ggplot2::labs(
    title = "Within-participant condition differences",
    subtitle = "24 participants; each line connects two means from the same participant",
    x = "Condition",
    y = "Mean correct-trial RT (ms)",
    caption = paste(
      "Synthetic teaching data.",
      "Lines show within-participant descriptions; no population or causal claim."
    )
  ) +
  ggplot2::theme_minimal(base_size = 12) +
  ggplot2::theme(
    panel.grid.minor = ggplot2::element_blank(),
    plot.title.position = "plot"
  )
```

subtitleに、線が同じ参加者の2平均を結ぶことを明記します。色が見えなくても、横位置と線で2条件と対応を読めます。IDを図中へ24個表示すると線と重なるため、詳細値は`participant_differences.csv`で追跡します。

## 5. 対応図を保存して構造を検査する

```r
dir.create("output", showWarnings = FALSE)
ggplot2::ggsave(
  filename = "output/participant_differences.png",
  plot = paired_plot,
  width = 7,
  height = 5,
  units = "in",
  dpi = 300,
  bg = "white"
)
```

生成画像は2100×1500 pxです。自動検証では、24本すべてが2点を結ぶこと、48点が入力の縦値と一致すること、congからincongへ読んだ線の差が差CSVと一致することも確認します。

## この合成データで観察できること

この24名では全員の線がcongからincongへ上向きです。参加者内差`incong - cong`は33.79〜108.77 msで、中央値は64.71 msです。一方、線の長さは同じではなく、参加者によって差の大きさがばらついています。

これは24名の合成パイロット内の記述です。全員が同じ方向だったことだけで、母集団の全員も同じ、条件が反応時間を因果的に変えた、統計的に有意である、とは結論しません。

## よくある誤り

- `group = condition`とし、同じ条件内の別参加者を結ぶ。
- `group = id`を省き、離散xの既定groupに任せる。
- 24本の線を24色にして、条件や方向よりID凡例を目立たせる。
- L18の条件別分布図だけを見て、同じ人の2点を対応付けたと思う。
- 上向き線が多いことを、有意差・母集団差・因果効果の証明と書く。
- 欠けた条件がないか確認せず、描けた線だけを報告する。

## 内容理解問題

問題の正本は`assessments.json`です。

1. `step2-l19-q1-group-id`: `group = id`が同じ参加者だけを結ぶことを説明する。
2. `step2-l19-q2-layer-counts`: 実行前に24本の線と48点を予測する。
3. `step2-l19-q3-missing-group`: 離散xでgroupを省いたときの誤りを診断する。
4. `step2-l19-q4-compare-plots`: 分布図と対応図の役割・限界を比較する。
5. `step2-l19-q5-transfer-blood-pressure`: 18名の前後血圧データへ対応図を移す。

選択問題だけでL19を実践済みにはしません。完成図、差CSVとの一致、図の使い分け説明、未見の前後測定への転移を別々に確認します。

## 直接評価

1. L17の48行CSVから、24本の対応線と48点を持つPNGを再生成する。
2. 各線が同じIDの2条件だけを結ぶことをコードと文章で説明する。
3. 差の方向・範囲・中央値を図と`participant_differences.csv`で一致させる。
4. L18の分布図との使い分けと、どちらからも結論できないことを書く。
5. 18名の前後血圧という未見文脈で対応キーと作図層を選び直す。

## 公式資料

- ggplot2 grouping: https://ggplot2.tidyverse.org/reference/aes_group_order.html
- ggplot2 `geom_line()`: https://ggplot2.tidyverse.org/reference/geom_path.html
- ggplot2 `geom_point()`: https://ggplot2.tidyverse.org/reference/geom_point.html
- ggplot2 `ggsave()`: https://ggplot2.tidyverse.org/reference/ggsave.html
