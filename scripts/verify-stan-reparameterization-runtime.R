source(file.path("content", "stan", "examples", "run-reparameterization-comparison.R"), local = TRUE)

source_files <- c(
  file.path("content", "stan", "model-review", "mr03-centered.candidate.stan"),
  file.path("content", "stan", "model-review", "mr03-noncentered.reference.stan"),
  file.path("content", "stan", "examples", "run-reparameterization-comparison.R")
)
source_md5_before <- tools::md5sum(source_files)

verification_dir <- tempfile("learning-stan-reparameterization-")
dir.create(verification_dir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(verification_dir, recursive = TRUE, force = TRUE), add = TRUE)

result <- run_reparameterization_comparison(verification_dir)
expected_files <- c(
  "scenario-data.csv",
  "scenario-metadata.csv",
  "weak-input.json",
  "strong-input.json",
  "diagnostics.csv",
  "posterior-summary.csv",
  "timing-repetitions.csv",
  "efficiency-comparison.csv",
  "posterior-equivalence.csv",
  "run-environment.csv",
  "01-parameterization-efficiency.png",
  "02-posterior-agreement.png"
)
expected_paths <- file.path(verification_dir, expected_files)
if (!all(file.exists(expected_paths))) {
  stop("The L40 comparison did not generate the complete 12-file artifact contract")
}
png_paths <- expected_paths[grepl("[.]png$", expected_paths)]
if (any(file.info(png_paths)$size < 10000)) {
  stop("An L40 comparison visualization is unexpectedly small")
}

metadata <- read.csv(file.path(verification_dir, "scenario-metadata.csv"))
weak_metadata <- metadata[metadata$scenario == "weak", , drop = FALSE]
strong_metadata <- metadata[metadata$scenario == "strong", , drop = FALSE]
if (
  nrow(weak_metadata) != 1L || nrow(strong_metadata) != 1L ||
  weak_metadata$seed != 202608091L || strong_metadata$seed != 202608092L ||
  weak_metadata$groups != 8L || strong_metadata$groups != 8L ||
  weak_metadata$observations_per_group != 1L ||
  strong_metadata$observations_per_group != 30L ||
  weak_metadata$observations != 8L || strong_metadata$observations != 240L ||
  weak_metadata$true_tau != 0.1 || strong_metadata$true_tau != 1 ||
  any(metadata$observation_sigma != 1)
) {
  stop("The weak/strong group-information scenarios changed")
}

scenario_data <- read.csv(file.path(verification_dir, "scenario-data.csv"))
if (
  nrow(scenario_data) != 248L ||
  abs(sum(scenario_data$y[scenario_data$scenario == "weak"]) - 4.8587047) > 1e-6 ||
  abs(sum(scenario_data$y[scenario_data$scenario == "strong"]) - 162.900108) > 1e-6
) {
  stop("The fixed L40 scenario data changed")
}

environment <- read.csv(file.path(verification_dir, "run-environment.csv"), stringsAsFactors = FALSE)
environment_values <- setNames(environment$value, environment$field)
if (
  environment_values[["r"]] != "4.6.1" ||
  environment_values[["cmdstanr"]] != "0.9.0" ||
  environment_values[["cmdstan"]] != "2.39.0" ||
  environment_values[["chains"]] != "4" ||
  environment_values[["iter_warmup"]] != "1000" ||
  environment_values[["iter_sampling"]] != "1000" ||
  environment_values[["repetitions"]] != "3" ||
  environment_values[["initialization"]] != "0" ||
  environment_values[["performance_adapt_delta"]] != "0.9" ||
  environment_values[["equivalence_adapt_delta"]] != "0.99"
) {
  stop("The L40 runtime environment or sampling contract changed")
}

efficiency <- read.csv(file.path(verification_dir, "efficiency-comparison.csv"))
row_for <- function(scenario, parameterization) {
  row <- efficiency[
    efficiency$scenario == scenario & efficiency$parameterization == parameterization,
    ,
    drop = FALSE
  ]
  if (nrow(row) != 1L) stop("Efficiency comparison must contain one row per scenario and parameterization")
  row
}
weak_centered <- row_for("weak", "centered")
weak_noncentered <- row_for("weak", "noncentered")
strong_centered <- row_for("strong", "centered")
strong_noncentered <- row_for("strong", "noncentered")

if (
  weak_centered$divergent_total <= 0L ||
  weak_centered$ebfmi_min >= 0.3 ||
  weak_centered$rhat_max <= 1.01 ||
  weak_noncentered$divergent_total != 0L ||
  weak_noncentered$max_treedepth_total != 0L ||
  weak_noncentered$ebfmi_min < 0.3 ||
  weak_noncentered$rhat_max > 1.01 ||
  weak_noncentered$ess_bulk_min < 400 ||
  weak_noncentered$ess_tail_min < 400
) {
  stop("The weak-information scenario no longer exposes the centered geometry failure and non-centered repair")
}
if (
  strong_centered$divergent_total != 0L ||
  strong_centered$max_treedepth_total != 0L ||
  strong_centered$ebfmi_min < 0.3 ||
  strong_centered$rhat_max > 1.01 ||
  strong_centered$ess_bulk_min < 400 ||
  strong_centered$ess_tail_min < 400
) {
  stop("The strong-information centered parameterization failed the diagnostic evidence threshold")
}
if (
  weak_noncentered$tau_bulk_ess_per_second_median <=
    5 * weak_centered$tau_bulk_ess_per_second_median ||
  strong_centered$tau_bulk_ess_per_second_median <=
    2 * strong_noncentered$tau_bulk_ess_per_second_median ||
  any(efficiency$timing_repetitions != 3L)
) {
  stop("The repeated ESS-per-second comparison no longer shows the planned data-dependent contrast")
}

agreement <- read.csv(file.path(verification_dir, "posterior-equivalence.csv"))
if (
  nrow(agreement) != 20L ||
  !all(agreement$within_four_mcse) ||
  any(!is.finite(agreement$absolute_mcse_z)) ||
  max(agreement$absolute_mcse_z) > 4
) {
  stop("Centered and non-centered model-scale summaries do not agree within four combined MCSE")
}

diagnostics <- read.csv(file.path(verification_dir, "diagnostics.csv"))
if (
  nrow(diagnostics) != 64L ||
  !all(c("performance", "equivalence") %in% diagnostics$run_type) ||
  nrow(diagnostics[diagnostics$run_type == "performance", , drop = FALSE]) != 48L ||
  nrow(diagnostics[diagnostics$run_type == "equivalence", , drop = FALSE]) != 16L ||
  !setequal(unique(diagnostics$repetition[diagnostics$run_type == "performance"]), 1:3) ||
  any(!is.finite(diagnostics$ebfmi))
) {
  stop("The chain-level diagnostic artifact is incomplete")
}

source_md5_after <- tools::md5sum(source_files)
if (!identical(unname(source_md5_before), unname(source_md5_after))) {
  stop("The isolated L40 runtime modified a teaching source file")
}

message(sprintf(
  paste0(
    "Stan reparameterization runtime: PASS (12 artifacts, weak centered/non-centered divergences %d/%d, ",
    "strong centered/non-centered tau ESS/sec %.0f/%.0f, posterior max |z_MCSE| %.3f)"
  ),
  weak_centered$divergent_total,
  weak_noncentered$divergent_total,
  strong_centered$tau_bulk_ess_per_second_median,
  strong_noncentered$tau_bulk_ess_per_second_median,
  max(agreement$absolute_mcse_z)
))
