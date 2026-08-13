# STEP 2 参加者内差図: 同じ参加者の2条件を結ぶ対応図
#
# 入力:
#   output/participant_condition_summary.csv（記述統計スクリプトの出力）
#   output/participant_differences.csv（記述統計スクリプトの出力）
#
# 出力:
#   output/participant_differences.png

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
participant_differences <- readr::read_csv(
  "output/participant_differences.csv",
  show_col_types = FALSE
)

expected_summary_columns <- c(
  "id",
  "condition",
  "n_correct",
  "mean_rt",
  "median_rt"
)
expected_difference_columns <- c(
  "id",
  "incong_mean_rt",
  "cong_mean_rt",
  "incong_minus_cong"
)
expected_conditions <- c("cong", "incong")

pair_counts <- participant_condition |>
  dplyr::count(id, name = "n_conditions")
recomputed_differences <- participant_condition |>
  dplyr::filter(condition == "incong") |>
  dplyr::select(id, incong_mean_rt = mean_rt) |>
  dplyr::inner_join(
    participant_condition |>
      dplyr::filter(condition == "cong") |>
      dplyr::select(id, cong_mean_rt = mean_rt),
    by = "id"
  ) |>
  dplyr::mutate(incong_minus_cong = incong_mean_rt - cong_mean_rt) |>
  dplyr::arrange(id)

stopifnot(
  identical(names(participant_condition), expected_summary_columns),
  identical(names(participant_differences), expected_difference_columns),
  nrow(participant_condition) == 48,
  nrow(pair_counts) == 24,
  all(pair_counts$n_conditions == 2),
  setequal(participant_condition$condition, expected_conditions),
  nrow(participant_differences) == 24,
  isTRUE(all.equal(
    as.data.frame(participant_differences),
    as.data.frame(recomputed_differences),
    tolerance = 1e-10
  )),
  all(participant_differences$incong_minus_cong > 0)
)

participant_condition <- participant_condition |>
  dplyr::mutate(
    condition = factor(condition, levels = expected_conditions)
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
  ) +
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

stopifnot(file.exists("output/participant_differences.png"))

message(
  "STEP 2 participant-difference plot complete: 24 paired lines, 48 points, ",
  "2100 x 1500 px PNG"
)
