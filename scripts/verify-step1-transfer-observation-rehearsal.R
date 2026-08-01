required <- c("readr")
missing <- required[!vapply(required, requireNamespace, quietly = TRUE, FUN.VALUE = logical(1))]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
pack_source <- file.path(
  project_root,
  "quality",
  "step1-transfer-gate",
  "participant-pack.zip"
)
checker_source <- file.path(
  project_root,
  "public",
  "challenges",
  "step1_transfer_check.R"
)
pack_root <- "Learning_Stan_STEP1_Transfer_Observation"
expected_pack_files <- sort(paste(
  pack_root,
  c(
    "PARTICIPANT_TASK.md",
    "data/transfer/switch_trials_dirty.csv",
    "data/transfer/switch_participants.csv"
  ),
  sep = "/"
))

stopifnot(file.exists(pack_source), file.exists(checker_source))
pack_md5_before <- unname(tools::md5sum(pack_source))
pack_listing <- utils::unzip(pack_source, list = TRUE)
actual_pack_files <- sort(pack_listing$Name[!endsWith(pack_listing$Name, "/")])
stopifnot(
  identical(actual_pack_files, expected_pack_files),
  !any(grepl("step1_analysis|nb1-data|step1-transfer\\.qmd|step1_transfer_check|FACILITATOR", actual_pack_files, ignore.case = TRUE))
)

work_dir <- tempfile("learning-stan-step1-transfer-observation-")
dir.create(work_dir)
normalized_work <- normalizePath(work_dir, winslash = "/", mustWork = TRUE)
normalized_temp <- normalizePath(tempdir(), winslash = "/", mustWork = TRUE)
stopifnot(startsWith(paste0(normalized_work, "/"), paste0(normalized_temp, "/")))
on.exit(unlink(normalized_work, recursive = TRUE, force = TRUE), add = TRUE)

utils::unzip(pack_source, exdir = normalized_work)
session_root <- file.path(normalized_work, pack_root)
stopifnot(dir.exists(session_root))

old_dir <- setwd(session_root)
on.exit(setwd(old_dir), add = TRUE)

stopifnot(
  file.exists("PARTICIPANT_TASK.md"),
  file.exists("data/transfer/switch_trials_dirty.csv"),
  file.exists("data/transfer/switch_participants.csv"),
  !file.exists("step1_transfer_check.R"),
  !file.exists("step1_analysis.R"),
  !file.exists("nb1-data.qmd"),
  !file.exists("step1-transfer.qmd"),
  !file.exists("FACILITATOR_KEY.md")
)

task <- paste(readLines("PARTICIPANT_TASK.md", encoding = "UTF-8", warn = FALSE), collapse = "\n")
forbidden_task_fragments <- c(
  "55e3056af5bda9a8cf86c19df9b0ad6f",
  "21入力行",
  "16行",
  "| A01 | 420 | 500 | 80 |",
  "TRANSFER PASS"
)
stopifnot(!any(vapply(
  forbidden_task_fragments,
  grepl,
  logical(1),
  x = task,
  fixed = TRUE
)))

raw_path <- "data/transfer/switch_trials_dirty.csv"
participants_path <- "data/transfer/switch_participants.csv"
raw_md5_before <- unname(tools::md5sum(raw_path))
raw <- readr::read_csv(raw_path, na = c("", "NA"), show_col_types = FALSE)
participants <- readr::read_csv(participants_path, na = c("", "NA"), show_col_types = FALSE)

stopifnot(
  identical(tolower(raw_md5_before), "55e3056af5bda9a8cf86c19df9b0ad6f"),
  identical(names(raw), c("participant_id", "trial_type", "response_ms", "is_correct", "block")),
  nrow(raw) == 21,
  identical(names(participants), c("participant_id", "training_group", "age")),
  nrow(participants) == 4,
  !anyDuplicated(participants$participant_id)
)

# リハーサル用fixtureです。学習者の解答コードではなく、配布後の採点動線だけを検証します。
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
  "分析対象: 検査済みデータの正答試行だけを参加者と条件で要約した。",
  "記述結果: 4名全員でswitch平均がrepeat平均より高く、切替コストは80〜110 msだった。",
  "解釈の限界: 4名の合成パイロットなので母集団へ一般化せず、群差も結論しない。"
)

readr::write_csv(issues, "data/processed/switch_trials_issues.csv")
readr::write_csv(checked, "data/processed/switch_trials_checked.csv")
readr::write_csv(costs, "output/switch_costs.csv")
writeLines(note, "output/transfer_note.txt", useBytes = TRUE)

submission_files <- c(
  "data/processed/switch_trials_issues.csv",
  "data/processed/switch_trials_checked.csv",
  "output/switch_costs.csv",
  "output/transfer_note.txt"
)
stopifnot(
  all(file.exists(submission_files)),
  !file.exists("step1_transfer_check.R"),
  identical(unname(tools::md5sum(raw_path)), raw_md5_before)
)

# 初回提出を固定した後だけ、進行役が自己チェッカーを追加します。
stopifnot(file.copy(checker_source, "step1_transfer_check.R"))
source("step1_transfer_check.R", local = new.env(parent = globalenv()), encoding = "UTF-8")

stopifnot(
  identical(unname(tools::md5sum(raw_path)), raw_md5_before),
  identical(unname(tools::md5sum(pack_source)), pack_md5_before)
)

cat("STEP 1 transfer observation REHEARSAL PASS: safe pack extracted, initial submission fixed, checker added afterward\n")
