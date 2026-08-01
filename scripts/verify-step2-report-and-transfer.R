required <- c("dplyr", "readr", "ggplot2")
missing <- required[!vapply(
  required,
  requireNamespace,
  quietly = TRUE,
  FUN.VALUE = logical(1)
)]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

png_dimensions <- function(path) {
  bytes <- readBin(path, what = "raw", n = 24)
  signature <- as.raw(c(137, 80, 78, 71, 13, 10, 26, 10))
  stopifnot(length(bytes) == 24, identical(bytes[1:8], signature))
  big_endian_uint32 <- function(value) {
    sum(as.integer(value) * 256^(3:0))
  }
  c(
    width = big_endian_uint32(bytes[17:20]),
    height = big_endian_uint32(bytes[21:24])
  )
}

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
content_root <- file.path(project_root, "content", "step2")
work_dir <- tempfile("learning-stan-step2-l20-")
dir.create(work_dir)
dir.create(file.path(work_dir, "data"))
on.exit(unlink(work_dir, recursive = TRUE, force = TRUE), add = TRUE)

source_scripts <- c(
  "step2_descriptive.R",
  "step2_condition_plot.R",
  "step2_participant_differences_plot.R",
  "step2_report_and_transfer.R"
)
copy_contract <- c(
  file.copy(
    file.path(content_root, "data", "expanded_pilot_trials.csv"),
    file.path(work_dir, "data", "expanded_pilot_trials.csv")
  ),
  file.copy(
    file.path(content_root, "examples", source_scripts),
    file.path(work_dir, source_scripts)
  )
)
stopifnot(all(copy_contract))

old_dir <- setwd(work_dir)
on.exit(setwd(old_dir), add = TRUE)
raw_path <- "data/expanded_pilot_trials.csv"
raw_before <- unname(tools::md5sum(raw_path))

portfolio_environment <- new.env(parent = globalenv())
source(
  "step2_report_and_transfer.R",
  local = portfolio_environment,
  encoding = "UTF-8"
)

expected_outputs <- c(
  "output/participant_condition_summary.csv",
  "output/descriptive_statistics.csv",
  "output/participant_differences.csv",
  "output/condition_distributions.png",
  "output/participant_differences.png",
  "output/exploratory_note.txt"
)
actual_outputs <- file.path("output", list.files("output"))
manifest <- portfolio_environment$portfolio_manifest
note <- readLines(
  "output/exploratory_note.txt",
  encoding = "UTF-8",
  warn = FALSE
)
expected_note_sections <- c(
  "データの由来:",
  "分析対象:",
  "図の選択理由（条件別分布）:",
  "図の選択理由（参加者内対応）:",
  "観察結果:",
  "解釈の限界:",
  "再生成手順:"
)
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

stopifnot(
  identical(unname(tools::md5sum(raw_path)), raw_before),
  setequal(actual_outputs, expected_outputs),
  length(actual_outputs) == 6,
  identical(names(manifest), c("path", "role", "bytes", "md5")),
  identical(manifest$path, expected_outputs),
  nrow(manifest) == 6,
  all(manifest$bytes > 0),
  identical(unname(manifest$md5), unname(tools::md5sum(expected_outputs))),
  length(note) == length(expected_note_sections),
  all(startsWith(note, expected_note_sections)),
  grepl("教材用の合成データ", note[[1]], fixed = TRUE),
  grepl("24名の884正答試行", note[[2]], fixed = TRUE),
  grepl("中央値・中央50%", note[[3]], fixed = TRUE),
  grepl("同じIDの2条件", note[[4]], fixed = TRUE),
  grepl("cong 510.73 ms", note[[5]], fixed = TRUE),
  grepl("incong 580.42 ms", note[[5]], fixed = TRUE),
  grepl("差の中央値は64.71 ms", note[[5]], fixed = TRUE),
  grepl("33.79〜108.77 ms", note[[5]], fixed = TRUE),
  grepl("結論しない", note[[6]], fixed = TRUE),
  grepl("step2_report_and_transfer.R", note[[7]], fixed = TRUE),
  nrow(participant_condition) == 48,
  dplyr::n_distinct(participant_condition$id) == 24,
  nrow(descriptive_statistics) == 2,
  nrow(participant_differences) == 24,
  all(participant_differences$incong_minus_cong > 0),
  identical(
    unname(png_dimensions("output/condition_distributions.png")),
    c(2100, 1500)
  ),
  identical(
    unname(png_dimensions("output/participant_differences.png")),
    c(2100, 1500)
  )
)

first_run_md5 <- unname(tools::md5sum(expected_outputs))
second_environment <- new.env(parent = globalenv())
source(
  "step2_report_and_transfer.R",
  local = second_environment,
  encoding = "UTF-8"
)
second_run_md5 <- unname(tools::md5sum(expected_outputs))
stopifnot(
  identical(unname(tools::md5sum(raw_path)), raw_before),
  identical(second_run_md5, first_run_md5),
  identical(
    unname(second_environment$portfolio_manifest$md5),
    second_run_md5
  )
)

cat(
  "STEP 2 L20 verification passed: a clean session reproduced 6 outputs, ",
  "7 report sections, two 2100 x 1500 px figures, and byte-identical reruns\n",
  sep = ""
)
