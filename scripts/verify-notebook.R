required <- c("knitr", "readr")
missing <- required[!vapply(required, requireNamespace, quietly = TRUE, FUN.VALUE = logical(1))]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
notebook_source <- file.path(project_root, "public", "notebooks", "nb1-data.qmd")
data_source <- file.path(project_root, "public", "data")
work_dir <- tempfile("learning-stan-nb1-")
dir.create(work_dir)

stopifnot(
  file.copy(notebook_source, file.path(work_dir, "nb1-data.qmd")),
  file.copy(data_source, work_dir, recursive = TRUE)
)

old_dir <- setwd(work_dir)
on.exit(setwd(old_dir), add = TRUE)

script_path <- knitr::purl(
  "nb1-data.qmd",
  output = "nb1-data.R",
  documentation = 0,
  quiet = TRUE
)
source(script_path, local = new.env(parent = globalenv()), echo = FALSE, encoding = "UTF-8")

clean <- readr::read_csv("data/rt_data.csv", show_col_types = FALSE)
checked <- readr::read_csv(
  "data/processed/rt_data_checked.csv",
  show_col_types = FALSE
)
issues <- readr::read_csv(
  "data/processed/rt_data_issues.csv",
  show_col_types = FALSE
)
summary <- readr::read_csv(
  "output/condition_means.csv",
  show_col_types = FALSE
)
analysis_note <- readLines(
  "output/analysis_note.txt",
  encoding = "UTF-8",
  warn = FALSE
)

stopifnot(
  nrow(issues) == 5,
  isTRUE(all.equal(as.data.frame(checked), as.data.frame(clean))),
  identical(names(summary), c("id", "cong", "incong")),
  nrow(summary) == 3,
  all(summary$incong > summary$cong),
  length(analysis_note) == 3,
  startsWith(analysis_note, c("分析対象:", "記述結果:", "解釈の限界:")),
  grepl("3名全員", analysis_note[[2]], fixed = TRUE),
  grepl("一般化", analysis_note[[3]], fixed = TRUE)
)

cat("NB1 smoke: all executable chunks, data checks, CSV, and interpretation note passed\n")
