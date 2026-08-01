source(file.path("content", "stan", "examples", "simulate-distributions.R"), local = TRUE)

verification_dir <- tempfile("learning-stan-distribution-verification-")
dir.create(verification_dir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(verification_dir, recursive = TRUE, force = TRUE), add = TRUE)

result <- run_distribution_grammar_lab(verification_dir, seed = 20260802L)

expected_pngs <- c(
  "01-normal-parameters.png",
  "02-beta-shapes.png",
  "03-prior-predictive.png",
  "04-truncation-vs-clamping.png"
)
png_paths <- file.path(verification_dir, expected_pngs)
if (!all(file.exists(png_paths))) {
  stop("Expected distribution visualizations were not generated")
}
if (any(file.info(png_paths)$size < 5000)) {
  stop("A generated distribution visualization is unexpectedly small")
}

summary_path <- file.path(verification_dir, "simulation-summary.csv")
if (!file.exists(summary_path)) {
  stop("simulation-summary.csv was not generated")
}

summary_table <- read.csv(summary_path, check.names = FALSE)
expected_columns <- c("quantity", "theoretical", "simulated", "absolute_error")
if (!identical(names(summary_table), expected_columns)) {
  stop("Simulation summary columns do not match the teaching contract")
}

expected_quantities <- c(
  "normal_mean", "normal_sd", "beta_mean", "beta_variance",
  "truncated_mean", "truncated_sd"
)
if (!identical(summary_table$quantity, expected_quantities)) {
  stop("Simulation summary rows do not match the teaching contract")
}
if (any(!is.finite(summary_table$theoretical)) || any(!is.finite(summary_table$simulated))) {
  stop("Simulation summary contains a non-finite value")
}

tolerances <- c(0.04, 0.04, 0.01, 0.005, 0.025, 0.025)
if (any(summary_table$absolute_error > tolerances)) {
  failed <- summary_table$quantity[summary_table$absolute_error > tolerances]
  stop("Simulation did not reproduce theoretical moments: ", paste(failed, collapse = ", "))
}

cat(
  sprintf(
    "Stan distribution lab: PASS (%d PNG visualizations, %d theory/simulation checks)\n",
    length(expected_pngs),
    nrow(summary_table)
  )
)
