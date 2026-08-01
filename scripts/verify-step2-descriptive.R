required <- c("dplyr", "readr")
missing <- required[!vapply(
  required,
  requireNamespace,
  quietly = TRUE,
  FUN.VALUE = logical(1)
)]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
script_source <- file.path(
  project_root,
  "content",
  "step2",
  "examples",
  "step2_descriptive.R"
)
data_source <- file.path(
  project_root,
  "content",
  "step2",
  "data",
  "expanded_pilot_trials.csv"
)

work_dir <- tempfile("learning-stan-step2-l17-")
dir.create(work_dir)
dir.create(file.path(work_dir, "data"))
on.exit(unlink(work_dir, recursive = TRUE, force = TRUE), add = TRUE)

stopifnot(
  file.copy(script_source, file.path(work_dir, "step2_descriptive.R")),
  file.copy(data_source, file.path(work_dir, "data", basename(data_source)))
)

raw_path <- file.path(work_dir, "data", "expanded_pilot_trials.csv")
raw_before <- unname(tools::md5sum(raw_path))

old_dir <- setwd(work_dir)
on.exit(setwd(old_dir), add = TRUE)
source(
  "step2_descriptive.R",
  local = new.env(parent = globalenv()),
  encoding = "UTF-8"
)

participant_condition <- readr::read_csv(
  "output/participant_condition_summary.csv",
  show_col_types = FALSE
)
descriptive <- readr::read_csv(
  "output/descriptive_statistics.csv",
  show_col_types = FALSE
)
differences <- readr::read_csv(
  "output/participant_differences.csv",
  show_col_types = FALSE
)
note <- readLines(
  "output/exploratory_note.txt",
  encoding = "UTF-8",
  warn = FALSE
)

expected_conditions <- c("cong", "incong")
expected_means <- c(499.08804036234375, 568.7107558264534)
expected_medians <- c(510.7266081871345, 580.421052631579)
expected_iqr <- c(48.79627192982457, 43.76900584795317)

stopifnot(
  identical(unname(tools::md5sum(raw_path)), raw_before),
  nrow(participant_condition) == 48,
  dplyr::n_distinct(participant_condition$id) == 24,
  identical(as.character(descriptive$condition), expected_conditions),
  identical(descriptive$n_participants, c(24, 24)),
  identical(descriptive$n_correct_trials, c(453, 431)),
  isTRUE(all.equal(
    descriptive$mean_of_participant_means,
    expected_means,
    tolerance = 1e-10
  )),
  isTRUE(all.equal(
    descriptive$median_of_participant_means,
    expected_medians,
    tolerance = 1e-10
  )),
  isTRUE(all.equal(descriptive$iqr, expected_iqr, tolerance = 1e-10)),
  nrow(differences) == 24,
  sum(differences$incong_minus_cong > 0) == 24,
  isTRUE(all.equal(
    median(differences$incong_minus_cong),
    64.70701754385965,
    tolerance = 1e-10
  )),
  length(note) == 4,
  startsWith(
    note,
    c("分析対象:", "記述結果:", "次の確認:", "解釈の限界:")
  ),
  grepl("母集団差・因果効果を結論しない", note[[4]], fixed = TRUE)
)

cat(
  "STEP 2 L17 verification passed: raw preserved, ",
  "48 participant-condition rows, 3 CSV files and note reproduced\n",
  sep = ""
)
