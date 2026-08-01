required <- c("dplyr", "readr")
missing <- required[!vapply(
  required,
  requireNamespace,
  quietly = TRUE,
  FUN.VALUE = logical(1)
)]
if (length(missing) > 0) {
  stop("CHECK ENV: 不足パッケージ: ", paste(missing, collapse = ", "))
}

fail <- function(category, message) {
  stop(sprintf("CHECK %s: %s", category, message), call. = FALSE)
}

png_dimensions <- function(path) {
  bytes <- readBin(path, what = "raw", n = 24)
  signature <- as.raw(c(137, 80, 78, 71, 13, 10, 26, 10))
  if (length(bytes) != 24 || !identical(bytes[1:8], signature)) {
    fail("FIGURE", paste(path, "は有効なPNGではありません"))
  }
  big_endian_uint32 <- function(value) {
    sum(as.integer(value) * 256^(3:0))
  }
  c(
    width = big_endian_uint32(bytes[17:20]),
    height = big_endian_uint32(bytes[21:24])
  )
}

raw_path <- "data/device_load_trials.csv"
expected_outputs <- c(
  "output/device_condition_summary.csv",
  "output/descriptive_statistics.csv",
  "output/device_differences.csv",
  "output/condition_distributions.png",
  "output/device_differences.png",
  "output/exploratory_note.txt"
)
if (!file.exists(raw_path)) fail("PATH", paste(raw_path, "がありません"))
missing_outputs <- expected_outputs[!file.exists(expected_outputs)]
if (length(missing_outputs) > 0) {
  fail("PATH", paste("不足成果物:", paste(missing_outputs, collapse = ", ")))
}
if (!identical(
  tolower(unname(tools::md5sum(raw_path))),
  "f5f13b38a895f8f18be69afbe09a1dcb"
)) {
  fail("RAW", "入力CSVのfingerprintが配布時と一致しません")
}

raw <- readr::read_csv(raw_path, show_col_types = FALSE)
expected_raw_columns <- c(
  "device_id",
  "load_condition",
  "reading",
  "latency_ms",
  "valid"
)
if (!identical(names(raw), expected_raw_columns) || nrow(raw) != 384) {
  fail("INPUT", "入力の列または行数が契約と一致しません")
}

expected_summary <- raw |>
  dplyr::filter(valid) |>
  dplyr::group_by(device_id, load_condition) |>
  dplyr::summarise(
    n_valid = dplyr::n(),
    mean_latency = mean(latency_ms),
    median_latency = median(latency_ms),
    .groups = "drop"
  ) |>
  dplyr::arrange(device_id, factor(load_condition, levels = c("baseline", "high_load")))

expected_descriptive <- expected_summary |>
  dplyr::group_by(load_condition) |>
  dplyr::summarise(
    n_devices = dplyr::n(),
    median_of_device_means = median(mean_latency),
    q1 = quantile(mean_latency, 0.25, names = FALSE),
    q3 = quantile(mean_latency, 0.75, names = FALSE),
    iqr = IQR(mean_latency),
    .groups = "drop"
  ) |>
  dplyr::arrange(factor(load_condition, levels = c("baseline", "high_load")))

expected_differences <- expected_summary |>
  dplyr::filter(load_condition == "baseline") |>
  dplyr::select(device_id, baseline_mean_latency = mean_latency) |>
  dplyr::inner_join(
    expected_summary |>
      dplyr::filter(load_condition == "high_load") |>
      dplyr::select(device_id, high_load_mean_latency = mean_latency),
    by = "device_id"
  ) |>
  dplyr::mutate(
    high_load_minus_baseline = high_load_mean_latency - baseline_mean_latency
  ) |>
  dplyr::arrange(device_id)

actual_summary <- readr::read_csv(expected_outputs[[1]], show_col_types = FALSE)
actual_descriptive <- readr::read_csv(expected_outputs[[2]], show_col_types = FALSE)
actual_differences <- readr::read_csv(expected_outputs[[3]], show_col_types = FALSE)
if (!identical(names(actual_summary), names(expected_summary))) {
  fail("SUMMARY", "デバイス×条件の要約列が契約と一致しません")
}
if (!identical(names(actual_descriptive), names(expected_descriptive))) {
  fail("SUMMARY", "条件別記述統計の列が契約と一致しません")
}
if (!identical(names(actual_differences), names(expected_differences))) {
  fail("PAIRING", "デバイス内差の列が契約と一致しません")
}
actual_summary <- actual_summary |>
  dplyr::arrange(device_id, factor(load_condition, levels = c("baseline", "high_load")))
actual_descriptive <- actual_descriptive |>
  dplyr::arrange(factor(load_condition, levels = c("baseline", "high_load")))
actual_differences <- actual_differences |>
  dplyr::arrange(device_id)
if (!isTRUE(all.equal(
  as.data.frame(actual_summary),
  as.data.frame(expected_summary),
  tolerance = 1e-8,
  check.attributes = FALSE
))) fail("SUMMARY", "デバイス×条件の要約が入力から再計算した値と一致しません")
if (!isTRUE(all.equal(
  as.data.frame(actual_descriptive),
  as.data.frame(expected_descriptive),
  tolerance = 1e-8,
  check.attributes = FALSE
))) fail("SUMMARY", "条件別記述統計が入力から再計算した値と一致しません")
if (!isTRUE(all.equal(
  as.data.frame(actual_differences),
  as.data.frame(expected_differences),
  tolerance = 1e-8,
  check.attributes = FALSE
))) fail("PAIRING", "デバイス内差が同じdevice_idの2条件から再計算した値と一致しません")

for (path in expected_outputs[4:5]) {
  if (!identical(unname(png_dimensions(path)), c(2100, 1500))) {
    fail("FIGURE", paste(path, "は2100×1500 pxではありません"))
  }
  if (file.info(path)$size < 20000) {
    fail("FIGURE", paste(path, "のファイルサイズが想定より小さいため内容を確認してください"))
  }
}

note <- readLines(expected_outputs[[6]], encoding = "UTF-8", warn = FALSE)
expected_prefixes <- c(
  "データの由来:",
  "分析対象:",
  "図の選択理由（条件別分布）:",
  "図の選択理由（デバイス内対応）:",
  "観察結果:",
  "解釈の限界:",
  "再生成手順:"
)
if (length(note) != 7 || !all(startsWith(note, expected_prefixes))) {
  fail("NOTE", "探索メモの7行構造または接頭辞が契約と一致しません")
}
if (!grepl("合成", note[[1]], fixed = TRUE)) {
  fail("NOTE", "データの由来に合成データであることがありません")
}
if (!grepl("16", note[[2]], fixed = TRUE) || !grepl("有効", note[[2]], fixed = TRUE)) {
  fail("NOTE", "分析対象にデバイス数と有効測定の説明がありません")
}
if (!grepl("44.73", note[[5]], fixed = TRUE) || !grepl("16", note[[5]], fixed = TRUE)) {
  fail("NOTE", "観察結果に参加単位内差の方向と中央値がありません")
}
if (!grepl("結論しない", note[[6]], fixed = TRUE)) {
  fail("NOTE", "解釈の限界に非主張事項がありません")
}
if (!grepl("step2_transfer.R", note[[7]], fixed = TRUE)) {
  fail("NOTE", "再生成手順に入口スクリプトがありません")
}

cat("STEP 2 TRANSFER PASS\n")
