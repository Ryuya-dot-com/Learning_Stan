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

project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
gate_root <- file.path(project_root, "quality", "step2-observation-gate")
pack_source <- file.path(gate_root, "participant-pack.zip")
checker_source <- file.path(gate_root, "step2_transfer_check.R")
pack_root <- "Learning_Stan_STEP2_Observation"
expected_pack_files <- sort(paste(
  pack_root,
  c("PARTICIPANT_TASK.md", "data/device_load_trials.csv"),
  sep = "/"
))

stopifnot(file.exists(pack_source), file.exists(checker_source))
pack_md5_before <- unname(tools::md5sum(pack_source))
pack_listing <- utils::unzip(pack_source, list = TRUE)
actual_pack_files <- sort(pack_listing$Name[!endsWith(pack_listing$Name, "/")])
stopifnot(
  identical(actual_pack_files, expected_pack_files),
  !any(grepl(
    "checker|facilitator|decision|status|report_and_transfer",
    actual_pack_files,
    ignore.case = TRUE
  ))
)

work_dir <- tempfile("learning-stan-step2-observation-")
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
  file.exists("data/device_load_trials.csv"),
  !file.exists("step2_transfer_check.R"),
  !file.exists("FACILITATOR_KEY.md"),
  !file.exists("step2_report_and_transfer.R")
)

raw_path <- "data/device_load_trials.csv"
raw_md5_before <- unname(tools::md5sum(raw_path))
raw <- readr::read_csv(raw_path, show_col_types = FALSE)
stopifnot(
  identical(tolower(raw_md5_before), "f5f13b38a895f8f18be69afbe09a1dcb"),
  identical(
    names(raw),
    c("device_id", "load_condition", "reading", "latency_ms", "valid")
  ),
  nrow(raw) == 384,
  dplyr::n_distinct(raw$device_id) == 16,
  sum(raw$valid) == 352
)

# 採点動線用fixtureです。学習者の解答や理解の証拠には数えません。
dir.create("output", showWarnings = FALSE)
summary_data <- raw |>
  dplyr::filter(valid) |>
  dplyr::group_by(device_id, load_condition) |>
  dplyr::summarise(
    n_valid = dplyr::n(),
    mean_latency = mean(latency_ms),
    median_latency = median(latency_ms),
    .groups = "drop"
  ) |>
  dplyr::arrange(device_id, factor(load_condition, levels = c("baseline", "high_load")))

descriptive <- summary_data |>
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

differences <- summary_data |>
  dplyr::filter(load_condition == "baseline") |>
  dplyr::select(device_id, baseline_mean_latency = mean_latency) |>
  dplyr::inner_join(
    summary_data |>
      dplyr::filter(load_condition == "high_load") |>
      dplyr::select(device_id, high_load_mean_latency = mean_latency),
    by = "device_id"
  ) |>
  dplyr::mutate(
    high_load_minus_baseline = high_load_mean_latency - baseline_mean_latency
  ) |>
  dplyr::arrange(device_id)

plot_data <- summary_data |>
  dplyr::mutate(
    load_condition = factor(load_condition, levels = c("baseline", "high_load"))
  )
condition_plot <- ggplot2::ggplot(
  plot_data,
  ggplot2::aes(x = load_condition, y = mean_latency)
) +
  ggplot2::geom_boxplot(
    ggplot2::aes(fill = load_condition),
    outlier.shape = NA,
    alpha = 0.25
  ) +
  ggplot2::geom_point(
    ggplot2::aes(fill = load_condition),
    position = ggplot2::position_jitter(width = 0.07, height = 0, seed = 20260801),
    shape = 21,
    size = 2.8
  ) +
  ggplot2::labs(
    title = "Device latency distributions by load condition",
    x = "Load condition",
    y = "Mean valid latency (ms)",
    caption = "Synthetic teaching data; each point is one device-condition mean."
  ) +
  ggplot2::theme_minimal(base_size = 12)

paired_plot <- ggplot2::ggplot(
  plot_data,
  ggplot2::aes(x = load_condition, y = mean_latency)
) +
  ggplot2::geom_line(
    ggplot2::aes(group = device_id),
    color = "#6B7280",
    alpha = 0.7
  ) +
  ggplot2::geom_point(
    ggplot2::aes(fill = load_condition),
    shape = 21,
    size = 2.8
  ) +
  ggplot2::labs(
    title = "Within-device latency differences",
    x = "Load condition",
    y = "Mean valid latency (ms)",
    caption = "Synthetic teaching data; each line connects the same device."
  ) +
  ggplot2::theme_minimal(base_size = 12)

# 行順は成果物契約に含めず、チェッカーがキー順へ正規化できることも確認します。
readr::write_csv(
  summary_data[rev(seq_len(nrow(summary_data))), ],
  "output/device_condition_summary.csv"
)
readr::write_csv(
  descriptive[rev(seq_len(nrow(descriptive))), ],
  "output/descriptive_statistics.csv"
)
readr::write_csv(
  differences[rev(seq_len(nrow(differences))), ],
  "output/device_differences.csv"
)
ggplot2::ggsave(
  "output/condition_distributions.png",
  plot = condition_plot,
  width = 7,
  height = 5,
  units = "in",
  dpi = 300,
  bg = "white"
)
ggplot2::ggsave(
  "output/device_differences.png",
  plot = paired_plot,
  width = 7,
  height = 5,
  units = "in",
  dpi = 300,
  bg = "white"
)
note <- c(
  "データの由来: 16台のデバイスについて生成した教材用の合成データである。",
  "分析対象: 16台の352有効測定をデバイス×条件の32行へ要約した。",
  "図の選択理由（条件別分布）: 全デバイス点と箱ひげで条件内分布を示した。",
  "図の選択理由（デバイス内対応）: 同じdevice_idの2条件を線で結んだ。",
  "観察結果: 16台全てでhigh_load−baseline差が正で、差の中央値は44.73 msだった。",
  "解釈の限界: 合成標本の記述であり、有意差・母集団差・因果効果を結論しない。",
  "再生成手順: 空のRセッションでstep2_transfer.Rを上から実行して6成果物を作る。"
)
writeLines(note, "output/exploratory_note.txt", useBytes = TRUE)

submission_files <- c(
  "output/device_condition_summary.csv",
  "output/descriptive_statistics.csv",
  "output/device_differences.csv",
  "output/condition_distributions.png",
  "output/device_differences.png",
  "output/exploratory_note.txt"
)
stopifnot(
  all(file.exists(submission_files)),
  !file.exists("step2_transfer_check.R"),
  identical(unname(tools::md5sum(raw_path)), raw_md5_before)
)
submission_md5_before <- unname(tools::md5sum(submission_files))

# 初回提出固定後だけチェッカーを追加します。
stopifnot(file.copy(checker_source, "step2_transfer_check.R"))
source(
  "step2_transfer_check.R",
  local = new.env(parent = asNamespace("stats")),
  encoding = "UTF-8"
)

stopifnot(
  identical(unname(tools::md5sum(raw_path)), raw_md5_before),
  identical(unname(tools::md5sum(submission_files)), submission_md5_before),
  identical(unname(tools::md5sum(pack_source)), pack_md5_before)
)

cat(
  "STEP 2 observation REHEARSAL PASS: safe pack extracted, ",
  "6-output initial submission fixed, checker added afterward\n",
  sep = ""
)
