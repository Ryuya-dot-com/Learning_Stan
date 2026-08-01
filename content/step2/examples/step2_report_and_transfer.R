# STEP 2 L20完成版: 2図・3CSV・探索メモを一括再生成して監査する
#
# 入力:
#   data/expanded_pilot_trials.csv（教材用の合成データ）
#   step2_descriptive.R
#   step2_condition_plot.R
#   step2_participant_differences_plot.R
#
# 出力:
#   output/participant_condition_summary.csv
#   output/descriptive_statistics.csv
#   output/participant_differences.csv
#   output/condition_distributions.png
#   output/participant_differences.png
#   output/exploratory_note.txt

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

input_path <- "data/expanded_pilot_trials.csv"
analysis_scripts <- c(
  "step2_descriptive.R",
  "step2_condition_plot.R",
  "step2_participant_differences_plot.R"
)
stopifnot(file.exists(input_path), all(file.exists(analysis_scripts)))

input_md5_before <- unname(tools::md5sum(input_path))
analysis_environment <- new.env(parent = asNamespace("stats"))
for (script in analysis_scripts) {
  source(
    script,
    local = analysis_environment,
    encoding = "UTF-8"
  )
}
stopifnot(identical(unname(tools::md5sum(input_path)), input_md5_before))

participant_condition <- readr::read_csv(
  "output/participant_condition_summary.csv",
  show_col_types = FALSE
)
descriptive_statistics <- readr::read_csv(
  "output/descriptive_statistics.csv",
  show_col_types = FALSE
)
participant_differences <- readr::read_csv(
  "output/participant_differences.csv",
  show_col_types = FALSE
)

cong_median <- descriptive_statistics |>
  dplyr::filter(condition == "cong") |>
  dplyr::pull(median_of_participant_means)
incong_median <- descriptive_statistics |>
  dplyr::filter(condition == "incong") |>
  dplyr::pull(median_of_participant_means)
difference_median <- median(participant_differences$incong_minus_cong)
difference_range <- range(participant_differences$incong_minus_cong)

stopifnot(
  nrow(participant_condition) == 48,
  dplyr::n_distinct(participant_condition$id) == 24,
  nrow(descriptive_statistics) == 2,
  nrow(participant_differences) == 24,
  all(participant_differences$incong_minus_cong > 0),
  length(cong_median) == 1,
  length(incong_median) == 1
)

final_note <- c(
  "データの由来: 実在の研究結果ではなく、seed 20260802で生成した教材用の合成データである。",
  "分析対象: 24名の884正答試行を、参加者×条件の48行へ要約した。",
  "図の選択理由（条件別分布）: 箱ひげと全参加者の点を重ね、条件内の中央値・中央50%・参加者間のばらつきを示した。",
  "図の選択理由（参加者内対応）: 同じIDの2条件を線で結び、各参加者の変化方向と差の大きさを示した。",
  sprintf(
    paste0(
      "観察結果: 参加者平均RTの中央値はcong %.2f ms、incong %.2f ms。",
      "24名全員でincong−cong差が正で、差の中央値は%.2f ms、範囲は%.2f〜%.2f msだった。"
    ),
    cong_median,
    incong_median,
    difference_median,
    difference_range[[1]],
    difference_range[[2]]
  ),
  "解釈の限界: この24名の合成標本の記述であり、p値・統計的有意差・母集団差・因果効果を結論しない。",
  "再生成手順: 空のRセッションでstep2_report_and_transfer.Rを実行し、2図・3CSV・この探索メモを再生成する。"
)
writeLines(
  final_note,
  "output/exploratory_note.txt",
  useBytes = TRUE
)

expected_outputs <- c(
  "output/participant_condition_summary.csv",
  "output/descriptive_statistics.csv",
  "output/participant_differences.csv",
  "output/condition_distributions.png",
  "output/participant_differences.png",
  "output/exploratory_note.txt"
)
output_roles <- c(
  "参加者×条件の分析単位",
  "条件別の記述統計",
  "参加者内差",
  "条件別分布図",
  "参加者内対応図",
  "由来・選択理由・観察・限界・再生成手順"
)
stopifnot(all(file.exists(expected_outputs)))

portfolio_manifest <- data.frame(
  path = expected_outputs,
  role = output_roles,
  bytes = unname(file.info(expected_outputs)$size),
  md5 = unname(tools::md5sum(expected_outputs)),
  stringsAsFactors = FALSE
)
saved_note <- readLines(
  "output/exploratory_note.txt",
  encoding = "UTF-8",
  warn = FALSE
)
stopifnot(
  all(portfolio_manifest$bytes > 0),
  !anyNA(portfolio_manifest$md5),
  identical(saved_note, final_note)
)

print(portfolio_manifest, row.names = FALSE)
message(
  "STEP 2 L20 complete: one entry point reproduced and audited ",
  "2 figures, 3 CSV files, and 1 exploratory note"
)
