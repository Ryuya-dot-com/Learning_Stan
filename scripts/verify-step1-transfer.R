required <- c("readr")
missing <- required[!vapply(required, requireNamespace, quietly = TRUE, FUN.VALUE = logical(1))]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
challenge_source <- file.path(project_root, "public", "challenges", "step1-transfer.qmd")
checker_source <- file.path(project_root, "public", "challenges", "step1_transfer_check.R")
data_source <- file.path(project_root, "public", "data")
work_dir <- tempfile("learning-stan-step1-transfer-")
dir.create(work_dir)

stopifnot(
  file.copy(checker_source, file.path(work_dir, "step1_transfer_check.R")),
  file.copy(data_source, work_dir, recursive = TRUE)
)

challenge <- readLines(challenge_source, encoding = "UTF-8", warn = FALSE)
challenge_text <- paste(challenge, collapse = "\n")
stopifnot(
  grepl("完成版`step1_analysis.R`は列名と条件名が違うため、そのままでは動きません", challenge_text, fixed = TRUE),
  grepl("switch_cost_ms = switch - repeat", challenge_text, fixed = TRUE),
  !grepl("case_when(", challenge_text, fixed = TRUE),
  !grepl("pivot_wider(", challenge_text, fixed = TRUE)
)

old_dir <- setwd(work_dir)
on.exit(setwd(old_dir), add = TRUE)

raw_path <- "data/transfer/switch_trials_dirty.csv"
raw <- readr::read_csv(raw_path, na = c("", "NA"), show_col_types = FALSE)
expected_md5 <- "55e3056af5bda9a8cf86c19df9b0ad6f"
stopifnot(
  identical(tolower(unname(tools::md5sum(raw_path))), expected_md5),
  nrow(raw) == 21,
  sum(duplicated(raw)) == 1,
  sum(!raw$trial_type %in% c("repeat", "switch")) == 1,
  sum(is.na(raw$response_ms) | raw$response_ms < 100 | raw$response_ms > 3000) == 1,
  sum(!raw$participant_id %in% c("A01", "A02", "A03", "A04")) == 1,
  sum(is.na(raw$is_correct)) == 1
)

dir.create("data/processed", recursive = TRUE, showWarnings = FALSE)
dir.create("output", showWarnings = FALSE)

checked <- raw[seq_len(16), ]
issues <- raw[17:21, ]
issues$issue <- c(
  "duplicate",
  "invalid_trial_type",
  "response_out_of_range",
  "unknown_participant",
  "missing_correct"
)
costs <- data.frame(
  participant_id = c("A01", "A02", "A03", "A04"),
  repeat_ms = c(420, 400, 440, 415),
  switch = c(500, 500, 540, 525),
  switch_cost_ms = c(80, 100, 100, 110)
)
names(costs)[names(costs) == "repeat_ms"] <- "repeat"
note <- c(
  "分析対象: 検査済みデータの正答試行だけを参加者×条件で要約した。",
  "記述結果: 4名全員でswitch平均がrepeat平均より長く、切替コストは80〜110 msだった。",
  "解釈の限界: 4名の合成データなので、母集団へ一般化せず、群間差も結論しない。"
)

readr::write_csv(issues, "data/processed/switch_trials_issues.csv")
readr::write_csv(checked, "data/processed/switch_trials_checked.csv")
readr::write_csv(costs, "output/switch_costs.csv")
writeLines(note, "output/transfer_note.txt", useBytes = TRUE)

source("step1_transfer_check.R", local = new.env(parent = globalenv()), encoding = "UTF-8")

cat("STEP 1 transfer assets: renamed columns, five issues, expected fixture, and self-checker passed\n")
