required <- c("readr", "readxl", "purrr")
missing <- required[!vapply(required, requireNamespace, quietly = TRUE, FUN.VALUE = logical(1))]
if (length(missing) > 0) {
  stop("不足パッケージ: ", paste(missing, collapse = ", "))
}

# 配布ファイル: CSV・TSV・任意区切りTXTが同じ表契約を保つことを検証
rt_csv <- readr::read_csv(
  "public/data/rt_data.csv",
  show_col_types = FALSE
)
tsv <- readr::read_tsv(
  "public/data/rt_data.tsv",
  show_col_types = FALSE
)
participants_csv <- readr::read_csv(
  "public/data/participants.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)
pipe_delimited <- readr::read_delim(
  "public/data/participants_pipe.txt",
  delim = "|",
  na = c("", "NA"),
  show_col_types = FALSE
)
stopifnot(
  identical(names(tsv), names(rt_csv)),
  isTRUE(all.equal(as.data.frame(tsv), as.data.frame(rt_csv))),
  identical(names(pipe_delimited), names(participants_csv)),
  isTRUE(all.equal(as.data.frame(pipe_delimited), as.data.frame(participants_csv)))
)

# 問題入りCSV: clean 12行を保ち、5種類の既知問題を各1件だけ含むことを検証
dirty <- readr::read_csv(
  "public/data/rt_data_dirty.csv",
  na = c("", "NA"),
  show_col_types = FALSE
)
stopifnot(
  nrow(dirty) == 17,
  isTRUE(all.equal(as.data.frame(dirty[seq_len(12), ]), as.data.frame(rt_csv))),
  sum(duplicated(dirty)) == 1,
  sum(!dirty$cond %in% c("cong", "incong")) == 1,
  sum(is.na(dirty$rt) | dirty$rt < 100 | dirty$rt > 3000) == 1,
  sum(!dirty$id %in% participants_csv$id) == 1,
  sum(is.na(dirty$correct)) == 1
)

# Excel: 公開サンプルで、シート指定と複数ファイルの反復読込を検証
excel_path <- "public/data/trials.xlsx"
stopifnot(identical(readxl::excel_sheets(excel_path), c("README", "trials")))
excel_trials <- readxl::read_excel(
  excel_path,
  sheet = "trials",
  range = "A1:D13"
)
stopifnot(isTRUE(all.equal(as.data.frame(excel_trials), as.data.frame(rt_csv))))

files <- list.files(
  "public/data/batches",
  pattern = "\\.xlsx$",
  full.names = TRUE,
  ignore.case = TRUE
)
files <- sort(files[!startsWith(basename(files), "~$")])
stopifnot(length(files) == 2)
names(files) <- basename(files)
tables <- files |>
  purrr::map(\(path) readxl::read_excel(path, sheet = "trials"))
expected_cols <- names(rt_csv)
stopifnot(purrr::every(
  tables,
  \(table) identical(names(table), expected_cols)
))

combined <- tables |>
  purrr::list_rbind(names_to = "source_file")
stopifnot(
  nrow(combined) == nrow(rt_csv),
  setequal(combined$source_file, names(files)),
  isTRUE(all.equal(
    as.data.frame(combined[expected_cols]),
    as.data.frame(rt_csv)
  ))
)

# 書出し: 一時領域へ保存し、再読込できることを確認
output_dir <- file.path(tempdir(), "learning-stan-file-io")
dir.create(output_dir, showWarnings = FALSE)
csv_path <- file.path(output_dir, "mtcars.csv")
tsv_path <- file.path(output_dir, "mtcars.tsv")
excel_csv_path <- file.path(output_dir, "mtcars_excel.csv")

readr::write_csv(tables[[1]], csv_path)
readr::write_tsv(tables[[1]], tsv_path)
readr::write_excel_csv(tables[[1]], excel_csv_path)

csv_again <- readr::read_csv(csv_path, show_col_types = FALSE)
tsv_again <- readr::read_tsv(tsv_path, show_col_types = FALSE)
stopifnot(
  file.exists(excel_csv_path),
  isTRUE(all.equal(as.data.frame(csv_again), as.data.frame(tsv_again))),
  nrow(csv_again) == nrow(tables[[1]])
)

cat("File I/O smoke: clean/dirty CSV, TSV, delimited, Excel, batch, and write checks passed\n")
