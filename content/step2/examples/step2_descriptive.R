# STEP 2 L17完成版: 拡大合成パイロットの記述統計
#
# 入力:
#   data/expanded_pilot_trials.csv（教材用の合成データ）
#
# 出力:
#   output/participant_condition_summary.csv
#   output/descriptive_statistics.csv
#   output/participant_differences.csv
#   output/exploratory_note.txt

required <- c("dplyr", "readr")
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
    "。Consoleで install.packages(c(\"dplyr\", \"readr\")) を1回実行してください。"
  )
}

dir.create("output", showWarnings = FALSE)

trials <- readr::read_csv(
  "data/expanded_pilot_trials.csv",
  show_col_types = FALSE
)

expected_columns <- c("id", "condition", "trial", "rt_ms", "correct")
expected_conditions <- c("cong", "incong")
stopifnot(
  identical(names(trials), expected_columns),
  nrow(trials) == 960,
  dplyr::n_distinct(trials$id) == 24,
  setequal(trials$condition, expected_conditions),
  all(dplyr::between(trials$rt_ms, 250, 1500)),
  !anyNA(trials$correct)
)

cell_counts <- trials |>
  dplyr::count(id, condition, name = "n_trials")
stopifnot(nrow(cell_counts) == 48, all(cell_counts$n_trials == 20))

correct_trials <- trials |>
  dplyr::filter(correct)

participant_condition <- correct_trials |>
  dplyr::group_by(id, condition) |>
  dplyr::summarise(
    n_correct = dplyr::n(),
    mean_rt = mean(rt_ms),
    median_rt = median(rt_ms),
    .groups = "drop"
  ) |>
  dplyr::arrange(id, factor(condition, levels = expected_conditions))

stopifnot(
  nrow(correct_trials) == 884,
  nrow(participant_condition) == 48,
  dplyr::n_distinct(participant_condition$id) == 24
)

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
  ) |>
  dplyr::arrange(factor(condition, levels = expected_conditions))

participant_differences <- participant_condition |>
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

tolerance <- 1e-8
stopifnot(
  identical(as.character(descriptive_statistics$condition), expected_conditions),
  identical(descriptive_statistics$n_participants, c(24L, 24L)),
  identical(descriptive_statistics$n_correct_trials, c(453L, 431L)),
  abs(descriptive_statistics$median_of_participant_means[1] - 510.7266081871345) < tolerance,
  abs(descriptive_statistics$median_of_participant_means[2] - 580.421052631579) < tolerance,
  nrow(participant_differences) == 24,
  all(participant_differences$incong_minus_cong > 0)
)

exploratory_note <- c(
  "分析対象: 24名の合成パイロットについて、884正答試行を参加者×条件の48行へ要約した。",
  sprintf(
    "記述結果: 参加者平均RTの中央値はcong %.2f ms、incong %.2f msで、24名全員のincong−cong差が正だった。",
    descriptive_statistics$median_of_participant_means[1],
    descriptive_statistics$median_of_participant_means[2]
  ),
  "次の確認: 平均と中央値だけで判断せず、条件別分布と各参加者の対応を図で確認する。",
  "解釈の限界: 教材用の合成データなので、p値・母集団差・因果効果を結論しない。"
)

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
writeLines(
  exploratory_note,
  "output/exploratory_note.txt",
  useBytes = TRUE
)

saved_participant <- readr::read_csv(
  "output/participant_condition_summary.csv",
  show_col_types = FALSE
)
saved_descriptive <- readr::read_csv(
  "output/descriptive_statistics.csv",
  show_col_types = FALSE
)
saved_differences <- readr::read_csv(
  "output/participant_differences.csv",
  show_col_types = FALSE
)
saved_note <- readLines(
  "output/exploratory_note.txt",
  encoding = "UTF-8",
  warn = FALSE
)

stopifnot(
  nrow(saved_participant) == 48,
  nrow(saved_descriptive) == 2,
  nrow(saved_differences) == 24,
  identical(saved_note, exploratory_note)
)

message(
  "STEP 2 L17 complete: 960 trials, 884 correct trials, ",
  "48 participant-condition summaries, 4 L17 deliverables"
)
