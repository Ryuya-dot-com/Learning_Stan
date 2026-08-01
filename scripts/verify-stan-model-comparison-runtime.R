source(file.path("content", "stan", "examples", "run-link-model-comparison.R"), local = TRUE)

source_files <- file.path(
  "content", "stan", "examples",
  c(
    "binary-logit-linear.stan",
    "binary-logit-quadratic.stan",
    "poisson-log-exposure.stan",
    "simulate-link-functions.R",
    "run-link-model-comparison.R"
  )
)
source_md5_before <- tools::md5sum(source_files)
verification_dir <- tempfile("learning-stan-link-comparison-")
dir.create(verification_dir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(verification_dir, recursive = TRUE, force = TRUE), add = TRUE)

result <- run_link_model_comparison(verification_dir)
expected_files <- c(
  "link-function-summary.csv",
  "logit-baseline-effects.csv",
  "01-binary-inverse-links.png",
  "02-logit-coefficient-baseline.png",
  "03-poisson-log-exposure.png",
  "simulated-binary-data.csv",
  "model-comparison.csv",
  "pareto-k.csv",
  "stacking-weights.csv",
  "diagnostics.csv",
  "04-loo-model-predictions.png",
  "pointwise-elpd.csv",
  "05-pointwise-elpd.png"
)
expected_paths <- file.path(verification_dir, expected_files)
if (!all(file.exists(expected_paths))) {
  stop("The link/model-comparison scenario did not generate the complete 13-file artifact contract")
}
if (any(file.info(expected_paths[grepl("[.]png$", expected_paths)])$size < 8000)) {
  stop("A link/model-comparison visualization is unexpectedly small")
}

simulated <- read.csv(file.path(verification_dir, "simulated-binary-data.csv"))
if (nrow(simulated) != 400L || sum(simulated$y) != 113L || any(simulated$y < 0 | simulated$y > 1)) {
  stop("The fixed binary teaching scenario does not match its data contract")
}

comparison <- read.csv(file.path(verification_dir, "model-comparison.csv"))
row_for <- function(model) {
  row <- comparison[comparison$model == model, ]
  if (nrow(row) != 1L) stop("Model comparison must contain one row per named model")
  row
}
linear <- row_for("linear")
quadratic <- row_for("quadratic")
if (
  abs(linear$elpd_loo - (-231.4119383)) > 0.05 ||
  abs(quadratic$elpd_loo - (-212.2779508)) > 0.05 ||
  abs(linear$elpd_diff - (-19.1339875)) > 0.05 ||
  abs(linear$se_diff - 5.6012233) > 0.05 ||
  quadratic$elpd_diff != 0
) {
  stop("The fixed PSIS-LOO comparison changed beyond its teaching tolerance")
}
if (
  linear$pareto_k_flagged != 0L || quadratic$pareto_k_flagged != 0L ||
  linear$pareto_k_max > linear$pareto_threshold ||
  quadratic$pareto_k_max > quadratic$pareto_threshold
) {
  stop("The fixed PSIS-LOO comparison has an unresolved Pareto-k warning")
}

pareto <- read.csv(file.path(verification_dir, "pareto-k.csv"))
if (nrow(pareto) != 800L || any(pareto$flagged) || max(pareto$pareto_k) > 0.7) {
  stop("The observation-level Pareto-k artifact does not match the comparison summary")
}
pointwise <- read.csv(file.path(verification_dir, "pointwise-elpd.csv"))
if (nrow(pointwise) != 400L || abs(sum(pointwise$elpd_difference) + linear$elpd_diff) > 1e-6) {
  stop("Pointwise ELPD differences do not sum to the loo_compare difference")
}

weights <- read.csv(file.path(verification_dir, "stacking-weights.csv"))
if (abs(sum(weights$weight) - 1) > 1e-8 || weights$weight[weights$model == "quadratic"] < 0.95) {
  stop("Stacking weights do not match the fixed predictive comparison")
}

diagnostics <- read.csv(file.path(verification_dir, "diagnostics.csv"))
if (
  any(diagnostics$num_divergent != 0) ||
  any(diagnostics$num_max_treedepth != 0) ||
  any(diagnostics$ebfmi < 0.3)
) {
  stop("A fitted comparison model failed the transition or E-BFMI checks")
}
for (name in c("linear", "quadratic")) {
  parameters <- if (name == "linear") c("alpha", "beta") else c("alpha", "beta_linear", "beta_square")
  summary <- as.data.frame(result$fits[[name]]$summary(parameters))
  if (any(summary$rhat > 1.01) || any(summary$ess_bulk < 400) || any(summary$ess_tail < 400)) {
    stop(paste("The", name, "model failed the R-hat or ESS evidence threshold"))
  }
}

source_md5_after <- tools::md5sum(source_files)
if (!identical(unname(source_md5_before), unname(source_md5_after))) {
  stop("The link/model-comparison runtime modified a teaching source file")
}

message(
  sprintf(
    paste0(
      "Stan link/model comparison runtime: PASS (13 artifacts, ",
      "linear elpd %.3f, quadratic elpd %.3f, diff %.3f +/- %.3f, ",
      "Pareto-k flags 0, source unchanged)"
    ),
    linear$elpd_loo,
    quadratic$elpd_loo,
    linear$elpd_diff,
    linear$se_diff
  )
)
