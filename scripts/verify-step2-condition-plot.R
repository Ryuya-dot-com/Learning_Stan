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
work_dir <- tempfile("learning-stan-step2-l18-")
dir.create(work_dir)
dir.create(file.path(work_dir, "data"))
on.exit(unlink(work_dir, recursive = TRUE, force = TRUE), add = TRUE)

copy_contract <- c(
  file.copy(
    file.path(content_root, "data", "expanded_pilot_trials.csv"),
    file.path(work_dir, "data", "expanded_pilot_trials.csv")
  ),
  file.copy(
    file.path(content_root, "examples", "step2_descriptive.R"),
    file.path(work_dir, "step2_descriptive.R")
  ),
  file.copy(
    file.path(content_root, "examples", "step2_condition_plot.R"),
    file.path(work_dir, "step2_condition_plot.R")
  )
)
stopifnot(all(copy_contract))

raw_path <- file.path(work_dir, "data", "expanded_pilot_trials.csv")
raw_before <- unname(tools::md5sum(raw_path))

old_dir <- setwd(work_dir)
on.exit(setwd(old_dir), add = TRUE)
source(
  "step2_descriptive.R",
  local = new.env(parent = globalenv()),
  encoding = "UTF-8"
)

summary_path <- "output/participant_condition_summary.csv"
summary_before <- unname(tools::md5sum(summary_path))
plot_environment <- new.env(parent = globalenv())
source(
  "step2_condition_plot.R",
  local = plot_environment,
  encoding = "UTF-8"
)

plot_path <- "output/condition_distributions.png"
plot_object <- plot_environment$condition_plot
built <- ggplot2::ggplot_build(plot_object)
box_data <- built$data[[1]]
point_data <- built$data[[2]]
summary_data <- readr::read_csv(summary_path, show_col_types = FALSE)

stopifnot(
  identical(unname(tools::md5sum(raw_path)), raw_before),
  identical(unname(tools::md5sum(summary_path)), summary_before),
  inherits(plot_object, "ggplot"),
  length(plot_object$layers) == 2,
  inherits(plot_object$layers[[1]]$geom, "GeomBoxplot"),
  inherits(plot_object$layers[[2]]$geom, "GeomPoint"),
  nrow(box_data) == 2,
  nrow(point_data) == 48,
  nrow(unique(data.frame(
    x = round(point_data$x, 6),
    y = round(point_data$y, 6)
  ))) == 48,
  isTRUE(all.equal(
    sort(point_data$y),
    sort(summary_data$mean_rt),
    tolerance = 1e-10
  )),
  all(abs(point_data$x - round(point_data$x)) <= 0.080001),
  identical(plot_object$labels$x, "Condition"),
  identical(plot_object$labels$y, "Mean correct-trial RT (ms)"),
  grepl("Synthetic teaching data", plot_object$labels$caption, fixed = TRUE),
  identical(unname(png_dimensions(plot_path)), c(2100, 1500)),
  file.info(plot_path)$size > 30000
)

preview_target <- Sys.getenv("STEP2_L18_PREVIEW", unset = "")
if (nzchar(preview_target)) {
  preview_target <- normalizePath(
    preview_target,
    winslash = "/",
    mustWork = FALSE
  )
  dir.create(dirname(preview_target), recursive = TRUE, showWarnings = FALSE)
  stopifnot(file.copy(plot_path, preview_target, overwrite = TRUE))
  message("STEP 2 L18 preview copied to ", preview_target)
}

cat(
  "STEP 2 L18 verification passed: raw and L17 CSV preserved, ",
  "2 boxes, 48 points, 2100 x 1500 px PNG\n",
  sep = ""
)
