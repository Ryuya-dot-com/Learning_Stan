required <- c("readr")
missing <- required[!vapply(required, requireNamespace, quietly = TRUE, FUN.VALUE = logical(1))]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

paths <- c(
  raw = "data/transfer/switch_trials_dirty.csv",
  participants = "data/transfer/switch_participants.csv",
  issues = "data/processed/switch_trials_issues.csv",
  checked = "data/processed/switch_trials_checked.csv",
  costs = "output/switch_costs.csv",
  note = "output/transfer_note.txt"
)

missing_files <- paths[!file.exists(paths)]
if (length(missing_files) > 0) {
  stop("不足ファイル: ", paste(unname(missing_files), collapse = ", "))
}

expected_raw_md5 <- "55e3056af5bda9a8cf86c19df9b0ad6f"
actual_raw_md5 <- unname(tools::md5sum(paths[["raw"]]))
if (!identical(tolower(actual_raw_md5), expected_raw_md5)) {
  stop("rawファイルの内容が配布時から変わっています。新しいコピーでやり直してください。")
}

raw <- readr::read_csv(paths[["raw"]], na = c("", "NA"), show_col_types = FALSE)
participants <- readr::read_csv(paths[["participants"]], na = c("", "NA"), show_col_types = FALSE)
issues <- readr::read_csv(paths[["issues"]], show_col_types = FALSE)
checked <- readr::read_csv(paths[["checked"]], show_col_types = FALSE)
costs <- readr::read_csv(paths[["costs"]], show_col_types = FALSE)
note <- readLines(paths[["note"]], encoding = "UTF-8", warn = FALSE)

expected_cols <- c("participant_id", "trial_type", "response_ms", "is_correct", "block")
expected_issue_types <- c(
  "duplicate",
  "invalid_trial_type",
  "missing_correct",
  "response_out_of_range",
  "unknown_participant"
)
expected_checked <- raw[seq_len(16), expected_cols]
expected_issues <- raw[17:21, expected_cols]
expected_issues$issue <- c(
  "duplicate",
  "invalid_trial_type",
  "response_out_of_range",
  "unknown_participant",
  "missing_correct"
)
expected_costs <- data.frame(
  participant_id = c("A01", "A02", "A03", "A04"),
  repeat_ms = c(420, 400, 440, 415),
  switch = c(500, 500, 540, 525),
  switch_cost_ms = c(80, 100, 100, 110)
)
names(expected_costs)[names(expected_costs) == "repeat_ms"] <- "repeat"
issues_order <- order(issues$issue)
expected_issues_order <- order(expected_issues$issue)

stopifnot(
  identical(names(raw), expected_cols),
  identical(names(participants), c("participant_id", "training_group", "age")),
  !anyDuplicated(participants$participant_id),
  nrow(issues) == 5,
  identical(names(issues), c(expected_cols, "issue")),
  setequal(issues$issue, expected_issue_types),
  isTRUE(all.equal(
    as.data.frame(issues[issues_order, ]),
    as.data.frame(expected_issues[expected_issues_order, ]),
    check.attributes = FALSE
  )),
  nrow(checked) == 16,
  identical(names(checked), expected_cols),
  isTRUE(all.equal(
    as.data.frame(checked),
    as.data.frame(expected_checked),
    check.attributes = FALSE
  )),
  sum(checked$is_correct) == 14,
  identical(names(costs), names(expected_costs)),
  isTRUE(all.equal(
    as.data.frame(costs),
    expected_costs,
    check.attributes = FALSE
  )),
  length(note) == 3,
  startsWith(note, c("分析対象:", "記述結果:", "解釈の限界:")),
  grepl("正答試行", note[[1]], fixed = TRUE),
  grepl("4名全員", note[[2]], fixed = TRUE),
  grepl("一般化", note[[3]], fixed = TRUE)
)

cat("TRANSFER PASS: raw preserved, 5 issues, 16 checked rows, 4 switch costs, and note passed\n")
