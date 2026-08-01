# STEP 1 完成版: 認知課題パイロットの分析
#
# 研究上の問い:
#   正答試行では、この小さなデータ内でincong条件の平均反応時間は
#   cong条件より長いか。
#
# 入力(raw。上書きしない):
#   data/rt_data_dirty.csv
#   data/participants.csv
#
# 出力(このスクリプトから再生成する):
#   data/processed/rt_data_issues.csv
#   data/processed/rt_data_checked.csv
#   output/condition_means.csv
#   output/analysis_note.txt

required <- c("dplyr", "readr", "tidyr")
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
    "。Consoleで install.packages(c(\"dplyr\", \"readr\", \"tidyr\")) を1回実行してください。"
  )
}

dir.create("data/processed", recursive = TRUE, showWarnings = FALSE)
dir.create("output", showWarnings = FALSE)

# 1. 入力を読み、表の契約を確認する
dirty <- readr::read_csv(
  "data/rt_data_dirty.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)
participants <- readr::read_csv(
  "data/participants.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)

expected_trial_cols <- c("id", "cond", "rt", "correct")
expected_participant_cols <- c("id", "age", "group")
stopifnot(
  identical(names(dirty), expected_trial_cols),
  identical(names(participants), expected_participant_cols),
  !anyDuplicated(participants$id)
)

# 2. 問題をラベル化し、rawとは別の表へ分ける
allowed_cond <- c("cong", "incong")
reviewed <- dirty |>
  dplyr::mutate(
    issue = dplyr::case_when(
      duplicated(dirty) ~ "duplicate",
      !cond %in% allowed_cond ~ "invalid_cond",
      is.na(rt) | !dplyr::between(rt, 100, 3000) ~ "rt_out_of_range",
      !id %in% participants$id ~ "unknown_participant",
      is.na(correct) ~ "missing_correct",
      TRUE ~ NA_character_
    )
  )

issues <- reviewed |>
  dplyr::filter(!is.na(issue))
checked <- reviewed |>
  dplyr::filter(is.na(issue)) |>
  dplyr::select(-issue)

unmatched_ids <- checked |>
  dplyr::distinct(id) |>
  dplyr::anti_join(
    dplyr::distinct(participants, id),
    by = "id"
  )

stopifnot(
  nrow(issues) == 5,
  setequal(
    issues$issue,
    c(
      "duplicate",
      "invalid_cond",
      "missing_correct",
      "rt_out_of_range",
      "unknown_participant"
    )
  ),
  nrow(checked) == 12,
  !anyDuplicated(checked),
  all(checked$cond %in% allowed_cond),
  all(dplyr::between(checked$rt, 100, 3000)),
  !anyNA(checked$correct),
  nrow(unmatched_ids) == 0
)

readr::write_csv(issues, "data/processed/rt_data_issues.csv")
readr::write_csv(checked, "data/processed/rt_data_checked.csv")

# 3. 正答試行を参加者×条件で要約する
participant_summary <- checked |>
  dplyr::filter(correct) |>
  dplyr::group_by(id, cond) |>
  dplyr::summarise(
    n = dplyr::n(),
    mean_rt = mean(rt),
    .groups = "drop"
  )

condition_means <- participant_summary |>
  dplyr::select(id, cond, mean_rt) |>
  tidyr::pivot_wider(
    names_from = cond,
    values_from = mean_rt
  ) |>
  dplyr::arrange(id)

# 4. 条件差を計算し、記述結果と限界を分ける
scenario_result <- condition_means |>
  dplyr::mutate(incong_minus_cong = incong - cong)

stopifnot(
  identical(names(condition_means), c("id", "cong", "incong")),
  nrow(condition_means) == 3,
  all(scenario_result$incong_minus_cong > 0)
)

analysis_note <- c(
  "分析対象: 正答試行だけを参加者×条件で要約した。",
  sprintf(
    "記述結果: 3名全員でincong平均がcong平均より長く、差は%.2f〜%.2f msだった。",
    min(scenario_result$incong_minus_cong),
    max(scenario_result$incong_minus_cong)
  ),
  "解釈の限界: 3名の合成データなので、母集団へ一般化せず、言語群差も結論しない。"
)

# 5. 成果物を保存し、直後に読み直して検査する
readr::write_csv(condition_means, "output/condition_means.csv")
writeLines(
  analysis_note,
  "output/analysis_note.txt",
  useBytes = TRUE
)

saved_means <- readr::read_csv(
  "output/condition_means.csv",
  show_col_types = FALSE
)
saved_note <- readLines(
  "output/analysis_note.txt",
  encoding = "UTF-8",
  warn = FALSE
)

stopifnot(
  isTRUE(all.equal(
    as.data.frame(saved_means),
    as.data.frame(condition_means)
  )),
  identical(saved_note, analysis_note)
)

message(
  "STEP 1 analysis complete: ",
  nrow(checked),
  " checked trials, ",
  nrow(condition_means),
  " participant summaries, 2 deliverables"
)
