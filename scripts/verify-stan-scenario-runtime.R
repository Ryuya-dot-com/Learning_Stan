source(file.path("content", "stan", "examples", "run-distribution-models.R"), local = TRUE)

source_files <- file.path(
  "content", "stan", "examples",
  c(
    "prior-predictive.stan",
    "truncated-normal.stan",
    "wrong-naive-bounded-normal.stan",
    "run-distribution-models.R"
  )
)
source_md5_before <- tools::md5sum(source_files)

verification_dir <- tempfile("learning-stan-scenario-verification-")
dir.create(verification_dir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(verification_dir, recursive = TRUE, force = TRUE), add = TRUE)

result <- run_distribution_models(verification_dir)

expected_files <- c(
  "scenario-data.csv",
  "scenario-metadata.csv",
  "prior-predictive-summary.csv",
  "model-comparison.csv",
  "diagnostics.csv",
  "01-stan-prior-predictive.png",
  "02-truncation-estimates.png",
  "03-truncated-posterior-predictive.png"
)
expected_paths <- file.path(verification_dir, expected_files)
if (!all(file.exists(expected_paths))) {
  stop("The Stan scenario did not generate the complete eight-file artifact contract")
}
png_paths <- expected_paths[grepl("[.]png$", expected_paths)]
if (any(file.info(png_paths)$size < 10000)) {
  stop("A generated Stan scenario visualization is unexpectedly small")
}

metadata <- read.csv(file.path(verification_dir, "scenario-metadata.csv"))
metadata_values <- setNames(metadata$value, metadata$field)
if (
  metadata_values[["seed"]] != 20260802 ||
  metadata_values[["N"]] != 2000 ||
  metadata_values[["true_mu"]] != 0.15 ||
  metadata_values[["true_sigma"]] != 0.45 ||
  abs(metadata_values[["retention_probability"]] - 0.6292087618) > 1e-9
) {
  stop("The Stan scenario metadata does not match the teaching contract")
}

prior_summary <- read.csv(file.path(verification_dir, "prior-predictive-summary.csv"))
prior_summary <- prior_summary[match(c("narrow", "baseline", "wide"), prior_summary$scenario), ]
if (
  any(is.na(prior_summary$scenario)) ||
  !all(diff(prior_summary$y_sd) > 0) ||
  !all(diff(prior_summary$sigma_mean) > 0)
) {
  stop("Prior hyperparameters do not produce the expected increasing predictive spread")
}

comparison <- read.csv(file.path(verification_dir, "model-comparison.csv"))
lookup <- function(model, variable, column) {
  row <- comparison[comparison$model == model & comparison$variable == variable, ]
  if (nrow(row) != 1L) stop("Model comparison does not contain one row per model and parameter")
  row[[column]][[1]]
}
if (
  abs(lookup("correct_truncated", "mu", "mean") - 0.15) > 0.02 ||
  abs(lookup("correct_truncated", "sigma", "mean") - 0.45) > 0.02
) {
  stop("The correct truncated model did not recover the data-generating parameters")
}
if (
  abs(lookup("wrong_naive", "mu", "mean") - 0.15) < 0.2 ||
  abs(lookup("wrong_naive", "sigma", "mean") - 0.45) < 0.1
) {
  stop("The intentionally wrong model does not show the required teaching contrast")
}
if (any(comparison$rhat > 1.01) || any(comparison$ess_bulk < 400) || any(comparison$ess_tail < 400)) {
  stop("A Stan scenario model failed the R-hat or ESS evidence threshold")
}

diagnostics <- read.csv(file.path(verification_dir, "diagnostics.csv"))
if (
  nrow(diagnostics) != 8L ||
  any(diagnostics$num_divergent != 0) ||
  any(diagnostics$num_max_treedepth != 0) ||
  any(!is.finite(diagnostics$ebfmi)) ||
  any(diagnostics$ebfmi < 0.3)
) {
  stop("A Stan scenario model failed the sampler diagnostic evidence threshold")
}

source_md5_after <- tools::md5sum(source_files)
if (!identical(unname(source_md5_before), unname(source_md5_after))) {
  stop("The isolated Stan scenario run modified a teaching source file")
}

cat(
  sprintf(
    paste0(
      "Stan scenario runtime: PASS ",
      "(%d artifacts, correct mu %.3f/sigma %.3f, wrong mu %.3f/sigma %.3f)\n"
    ),
    length(expected_files),
    lookup("correct_truncated", "mu", "mean"),
    lookup("correct_truncated", "sigma", "mean"),
    lookup("wrong_naive", "mu", "mean"),
    lookup("wrong_naive", "sigma", "mean")
  )
)
