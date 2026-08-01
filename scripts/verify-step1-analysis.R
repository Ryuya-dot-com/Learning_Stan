required <- c("dplyr", "readr", "tidyr")
missing <- required[!vapply(required, requireNamespace, quietly = TRUE, FUN.VALUE = logical(1))]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
script_source <- file.path(project_root, "public", "scripts", "step1_analysis.R")
data_source <- file.path(project_root, "public", "data")
work_dir <- tempfile("learning-stan-step1-script-")
dir.create(work_dir)

stopifnot(
  file.copy(script_source, file.path(work_dir, "step1_analysis.R")),
  file.copy(data_source, work_dir, recursive = TRUE)
)

raw_path <- file.path(work_dir, "data", "rt_data_dirty.csv")
raw_before <- unname(tools::md5sum(raw_path))

old_dir <- setwd(work_dir)
on.exit(setwd(old_dir), add = TRUE)
source("step1_analysis.R", local = new.env(parent = globalenv()), encoding = "UTF-8")

clean <- readr::read_csv("data/rt_data.csv", show_col_types = FALSE)
checked <- readr::read_csv("data/processed/rt_data_checked.csv", show_col_types = FALSE)
issues <- readr::read_csv("data/processed/rt_data_issues.csv", show_col_types = FALSE)
means <- readr::read_csv("output/condition_means.csv", show_col_types = FALSE)
note <- readLines("output/analysis_note.txt", encoding = "UTF-8", warn = FALSE)
differences <- means$incong - means$cong

stopifnot(
  identical(unname(tools::md5sum("data/rt_data_dirty.csv")), raw_before),
  nrow(issues) == 5,
  isTRUE(all.equal(as.data.frame(checked), as.data.frame(clean))),
  identical(names(means), c("id", "cong", "incong")),
  identical(means$id, c("P01", "P02", "P03")),
  isTRUE(all.equal(unname(round(differences, 2)), c(55.05, 80.65, 104.55))),
  length(note) == 3,
  startsWith(note, c("分析対象:", "記述結果:", "解釈の限界:")),
  grepl("母集団へ一般化せず", note[[3]], fixed = TRUE)
)

cat("STEP 1 script smoke: raw preserved, 5 issues, 12 checked rows, CSV and note passed\n")
