# STEP 2 条件分布図: 参加者点を残した箱ひげ図
#
# 入力:
#   output/participant_condition_summary.csv（記述統計スクリプトの出力）
#
# 出力:
#   output/condition_distributions.png

required <- c("dplyr", "readr", "ggplot2")
missing <- required[!vapply(
  required,
  requireNamespace,
  quietly = TRUE,
  FUN.VALUE = logical(1)
)]
if (length(missing) > 0) {
  stop(
    "不足パッケージ: ",
    paste(missing, collapse = ", "),
    "。Consoleで install.packages(c(\"dplyr\", \"readr\", \"ggplot2\")) を1回実行してください。"
  )
}

participant_condition <- readr::read_csv(
  "output/participant_condition_summary.csv",
  show_col_types = FALSE
)

expected_columns <- c(
  "id",
  "condition",
  "n_correct",
  "mean_rt",
  "median_rt"
)
expected_conditions <- c("cong", "incong")
cell_counts <- participant_condition |>
  dplyr::count(id, condition, name = "n_cells")

stopifnot(
  identical(names(participant_condition), expected_columns),
  nrow(participant_condition) == 48,
  dplyr::n_distinct(participant_condition$id) == 24,
  setequal(participant_condition$condition, expected_conditions),
  nrow(cell_counts) == 48,
  all(cell_counts$n_cells == 1),
  all(dplyr::between(participant_condition$mean_rt, 250, 1500))
)

participant_condition <- participant_condition |>
  dplyr::mutate(
    condition = factor(condition, levels = expected_conditions)
  )

jitter_position <- ggplot2::position_jitter(
  width = 0.08,
  height = 0,
  seed = 20260802
)

condition_plot <- ggplot2::ggplot(
  participant_condition,
  ggplot2::aes(x = condition, y = mean_rt)
) +
  ggplot2::geom_boxplot(
    ggplot2::aes(fill = condition),
    width = 0.48,
    outlier.shape = NA,
    alpha = 0.22,
    color = "#1F2937",
    linewidth = 0.7
  ) +
  ggplot2::geom_point(
    ggplot2::aes(fill = condition),
    position = jitter_position,
    shape = 21,
    size = 2.7,
    stroke = 0.45,
    color = "#1F2937",
    alpha = 0.88
  ) +
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

stopifnot(file.exists("output/condition_distributions.png"))

message(
  "STEP 2 condition plot complete: 48 participant-condition points, ",
  "2 boxplots, 2100 x 1500 px PNG"
)
