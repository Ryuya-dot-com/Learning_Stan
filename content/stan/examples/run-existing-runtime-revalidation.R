library(cmdstanr)
library(jsonlite)

find_revalidation_project_root <- function(start = getwd()) {
  candidate <- normalizePath(start, winslash = "/", mustWork = TRUE)
  repeat {
    if (
      file.exists(file.path(candidate, "package.json")) &&
      dir.exists(file.path(candidate, "content", "stan"))
    ) {
      return(candidate)
    }
    parent <- dirname(candidate)
    if (identical(parent, candidate)) stop("Learning_Stan project root was not found")
    candidate <- parent
  }
}

runtime_source_files <- function() {
  c(
    "content/stan/examples/linear-regression.stan",
    "content/stan/examples/run-linear-regression.R",
    "content/stan/examples/prior-predictive.stan",
    "content/stan/examples/truncated-normal.stan",
    "content/stan/examples/wrong-naive-bounded-normal.stan",
    "content/stan/examples/run-distribution-models.R",
    "content/stan/examples/binary-logit-linear.stan",
    "content/stan/examples/binary-logit-quadratic.stan",
    "content/stan/examples/poisson-log-exposure.stan",
    "content/stan/examples/simulate-link-functions.R",
    "content/stan/examples/run-link-model-comparison.R",
    "content/stan/examples/run-existing-runtime-revalidation.R"
  )
}

runtime_source_hashes <- function(project_root) {
  relative_paths <- runtime_source_files()
  paths <- file.path(project_root, relative_paths)
  if (!all(file.exists(paths))) stop("An existing runtime teaching source is missing")
  hashes <- vapply(paths, function(path) {
    size <- file.info(path)$size
    connection <- file(path, open = "rb")
    on.exit(close(connection), add = TRUE)
    source <- rawToChar(readBin(connection, what = "raw", n = size))
    canonical_source <- gsub("\r\n", "\n", source, fixed = TRUE)
    as.character(openssl::sha256(charToRaw(canonical_source)))
  }, character(1))
  names(hashes) <- relative_paths
  as.list(hashes)
}

rows_for_model <- function(table, model) {
  table[table$model == model, , drop = FALSE]
}

single_parameter_value <- function(table, model, variable, column) {
  row <- table[table$model == model & table$variable == variable, , drop = FALSE]
  if (nrow(row) != 1L) stop("Expected exactly one model/parameter row")
  row[[column]][[1]]
}

validate_chain_diagnostics <- function(table, expected_rows, label) {
  errors <- character()
  if (!is.data.frame(table) || nrow(table) != expected_rows) {
    return(paste0(label, ": chain diagnostics are incomplete"))
  }
  if (any(table$num_divergent != 0L)) errors <- c(errors, paste0(label, ": divergences remain"))
  if (any(table$num_max_treedepth != 0L)) errors <- c(errors, paste0(label, ": maximum treedepth was reached"))
  if (any(!is.finite(table$ebfmi)) || any(table$ebfmi < 0.3)) {
    errors <- c(errors, paste0(label, ": E-BFMI is below 0.3"))
  }
  errors
}

validate_existing_runtime_report <- function(report, artifact_root = NULL) {
  errors <- character()
  add <- function(condition, message) {
    if (!isTRUE(condition)) errors <<- c(errors, message)
  }

  add(identical(report$schemaVersion, 1L) || identical(report$schemaVersion, 1),
      "schemaVersion must be 1")
  add(identical(report$environment$r, "4.6.1"), "R version must be 4.6.1")
  add(identical(report$environment$cmdstanr, "0.9.0"), "CmdStanR version must be 0.9.0")
  add(identical(report$environment$cmdstan, "2.39.0"), "CmdStan version must be 2.39.0")
  add(identical(report$environment$loo, "2.10.1"), "loo version must be 2.10.1")
  add(
    length(report$sourceHashes) == length(runtime_source_files()) &&
      setequal(names(report$sourceHashes), runtime_source_files()) &&
      all(grepl("^[0-9a-f]{64}$", unlist(report$sourceHashes))),
    "All existing runtime sources must have SHA-256 hashes"
  )

  linear <- report$scenarios$linearRegression
  add(linear$sample$seed == 20260801L && linear$sample$chains == 4L &&
        linear$sample$iterWarmup == 1000L && linear$sample$iterSampling == 1000L,
      "Linear-regression sampling contract changed")
  linear_summary <- linear$parameterSummary
  add(is.data.frame(linear_summary) && nrow(linear_summary) == 3L,
      "Linear-regression parameter summary is incomplete")
  if (is.data.frame(linear_summary) && nrow(linear_summary) == 3L) {
    add(all(linear_summary$rhat <= 1.01), "Linear-regression R-hat exceeds 1.01")
    add(all(linear_summary$ess_bulk >= 400), "Linear-regression bulk ESS is below 400")
    add(all(linear_summary$ess_tail >= 400), "Linear-regression tail ESS is below 400")
    means <- setNames(linear_summary$mean, linear_summary$variable)
    add(abs(means[["alpha"]] - 1.61) <= 0.1, "Linear-regression alpha changed materially")
    add(abs(means[["beta"]] - 0.647) <= 0.05, "Linear-regression beta changed materially")
    add(abs(means[["sigma"]] - 0.219) <= 0.08, "Linear-regression sigma changed materially")
  }
  errors <- c(
    errors,
    validate_chain_diagnostics(linear$chainDiagnostics, 4L, "Linear regression")
  )
  add(length(linear$predictedMeans) == 8L && all(is.finite(linear$predictedMeans)),
      "Linear-regression posterior predictions are incomplete")

  truncation <- report$scenarios$truncation
  add(truncation$sample$seed == 20260802L && truncation$sample$chains == 4L &&
        truncation$sample$iterWarmup == 1000L && truncation$sample$iterSampling == 2000L,
      "Truncation revalidation sampling contract changed")
  truncation_summary <- truncation$parameterSummary
  add(is.data.frame(truncation_summary) && nrow(truncation_summary) == 4L,
      "Truncation parameter summary is incomplete")
  if (is.data.frame(truncation_summary) && nrow(truncation_summary) == 4L) {
    add(all(truncation_summary$rhat <= 1.01), "Truncation R-hat exceeds 1.01")
    add(all(truncation_summary$ess_bulk >= 400), "Truncation bulk ESS is below 400")
    add(all(truncation_summary$ess_tail >= 400), "Truncation tail ESS is below 400")
    correct_mu <- single_parameter_value(
      truncation_summary, "correct_truncated", "mu", "mean"
    )
    correct_sigma <- single_parameter_value(
      truncation_summary, "correct_truncated", "sigma", "mean"
    )
    wrong_mu <- single_parameter_value(truncation_summary, "wrong_naive", "mu", "mean")
    wrong_sigma <- single_parameter_value(truncation_summary, "wrong_naive", "sigma", "mean")
    add(abs(correct_mu - 0.15) <= 0.02 && abs(correct_sigma - 0.45) <= 0.02,
        "The correct truncation model did not recover the generating parameters")
    add(abs(wrong_mu - 0.15) >= 0.2 && abs(wrong_sigma - 0.45) >= 0.1,
        "The intentionally wrong truncation model lost the teaching contrast")
  }
  errors <- c(
    errors,
    validate_chain_diagnostics(truncation$chainDiagnostics, 8L, "Truncation")
  )

  link <- report$scenarios$linkLoo
  add(link$sample$seed == 20260802L && link$sample$chains == 4L &&
        link$sample$iterWarmup == 750L && link$sample$iterSampling == 750L &&
        link$sample$observations == 400L && link$sample$successes == 113L,
      "Link/LOO sampling and data contract changed")
  link_parameters <- link$parameterSummary
  add(is.data.frame(link_parameters) && nrow(link_parameters) == 5L,
      "Link/LOO parameter summary is incomplete")
  if (is.data.frame(link_parameters) && nrow(link_parameters) == 5L) {
    add(all(link_parameters$rhat <= 1.01), "Link/LOO R-hat exceeds 1.01")
    add(all(link_parameters$ess_bulk >= 400), "Link/LOO bulk ESS is below 400")
    add(all(link_parameters$ess_tail >= 400), "Link/LOO tail ESS is below 400")
  }
  errors <- c(errors, validate_chain_diagnostics(link$chainDiagnostics, 8L, "Link/LOO"))
  comparison <- link$modelComparison
  add(is.data.frame(comparison) && nrow(comparison) == 2L,
      "Link/LOO model comparison is incomplete")
  if (is.data.frame(comparison) && nrow(comparison) == 2L) {
    linear_row <- rows_for_model(comparison, "linear")
    quadratic_row <- rows_for_model(comparison, "quadratic")
    add(nrow(linear_row) == 1L && nrow(quadratic_row) == 1L,
        "Link/LOO comparison model names changed")
    if (nrow(linear_row) == 1L && nrow(quadratic_row) == 1L) {
      add(linear_row$elpd_diff < -2 * linear_row$se_diff,
          "Quadratic-versus-linear ELPD separation is below two SE")
      add(linear_row$elpd_diff > -30 && linear_row$elpd_diff < -10,
          "Link/LOO ELPD contrast changed materially")
      add(quadratic_row$elpd_diff == 0, "Quadratic model is no longer the reference row")
      add(linear_row$pareto_k_flagged == 0L && quadratic_row$pareto_k_flagged == 0L,
          "Link/LOO has a flagged Pareto-k value")
      add(linear_row$pareto_k_max <= linear_row$pareto_threshold &&
            quadratic_row$pareto_k_max <= quadratic_row$pareto_threshold,
          "Link/LOO maximum Pareto k exceeds its threshold")
    }
  }
  weights <- link$stackingWeights
  add(is.data.frame(weights) && nrow(weights) == 2L &&
        abs(sum(weights$weight) - 1) <= 1e-8 &&
        weights$weight[weights$model == "quadratic"] >= 0.95,
      "Link/LOO stacking conclusion changed")
  add(is.finite(link$pointwiseElpdDifferenceSum) &&
        abs(link$pointwiseElpdDifferenceSum +
              comparison$elpd_diff[comparison$model == "linear"]) <= 1e-6,
      "Pointwise ELPD differences do not sum to the model comparison")

  if (!is.null(artifact_root)) {
    relative_artifacts <- unlist(report$artifacts, use.names = FALSE)
    artifact_paths <- file.path(artifact_root, relative_artifacts)
    add(all(file.exists(artifact_paths)), "The existing-runtime artifact contract is incomplete")
    png_paths <- artifact_paths[grepl("[.]png$", artifact_paths)]
    if (length(png_paths) > 0L && all(file.exists(png_paths))) {
      add(all(file.info(png_paths)$size >= 8000),
          "An existing-runtime visualization is unexpectedly small")
    }
  }

  unique(errors)
}

run_existing_runtime_revalidation <- function(
  output_dir,
  project_root = find_revalidation_project_root()
) {
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  output_dir <- normalizePath(output_dir, winslash = "/", mustWork = TRUE)
  project_root <- normalizePath(project_root, winslash = "/", mustWork = TRUE)

  original_cmdstan_environment <- Sys.getenv("LEARNING_STAN_CMDSTAN", unset = "")
  configured_cmdstan <- original_cmdstan_environment
  active_cmdstan <- tryCatch(cmdstan_path(), error = function(error) "")
  selected_cmdstan <- if (nzchar(configured_cmdstan)) configured_cmdstan else active_cmdstan
  if (!nzchar(selected_cmdstan) || !dir.exists(selected_cmdstan)) {
    stop("A platform-native CmdStan installation was not found")
  }
  set_cmdstan_path(selected_cmdstan)
  Sys.setenv(LEARNING_STAN_CMDSTAN = selected_cmdstan)
  on.exit({
    if (nzchar(original_cmdstan_environment)) {
      Sys.setenv(LEARNING_STAN_CMDSTAN = original_cmdstan_environment)
    } else {
      Sys.unsetenv("LEARNING_STAN_CMDSTAN")
    }
  }, add = TRUE)
  if (!identical(as.character(cmdstan_version()), "2.39.0")) {
    stop("This evidence run requires CmdStan 2.39.0")
  }
  if (!identical(as.character(packageVersion("cmdstanr")), "0.9.0") ||
      !identical(as.character(packageVersion("loo")), "2.10.1")) {
    stop("This evidence run requires CmdStanR 0.9.0 and loo 2.10.1")
  }

  source_hashes_before <- runtime_source_hashes(project_root)
  original_working_directory <- getwd()
  setwd(project_root)
  on.exit(setwd(original_working_directory), add = TRUE)

  linear_environment <- new.env(parent = environment())
  sys.source(
    file.path(project_root, "content", "stan", "examples", "run-linear-regression.R"),
    envir = linear_environment
  )
  linear_summary <- as.data.frame(
    linear_environment$fit$summary(c("alpha", "beta", "sigma"))
  )
  linear_diagnostics <- as.data.frame(linear_environment$fit$diagnostic_summary())
  linear_diagnostics$chain <- seq_len(nrow(linear_diagnostics))
  linear_diagnostics <- linear_diagnostics[, c(
    "chain", "num_divergent", "num_max_treedepth", "ebfmi"
  )]
  linear_predicted_means <- colMeans(
    as.matrix(linear_environment$fit$draws("y_rep", format = "matrix"))
  )

  distribution_environment <- new.env(parent = environment())
  sys.source(
    file.path(project_root, "content", "stan", "examples", "run-distribution-models.R"),
    envir = distribution_environment
  )
  truncation_dir <- file.path(output_dir, "truncation")
  truncation_result <- distribution_environment$run_distribution_models(
    truncation_dir,
    project_root = project_root,
    chains = 4L,
    iter_warmup = 1000L,
    iter_sampling = 2000L,
    prior_iterations = 1000L,
    seed = 20260802L
  )

  link_environment <- new.env(parent = environment())
  sys.source(
    file.path(project_root, "content", "stan", "examples", "run-link-model-comparison.R"),
    envir = link_environment
  )
  link_dir <- file.path(output_dir, "link-loo")
  link_result <- link_environment$run_link_model_comparison(
    link_dir,
    project_root = project_root,
    chains = 4L,
    iter_warmup = 750L,
    iter_sampling = 750L,
    seed = 20260802L,
    n = 400L
  )
  link_parameter_summary <- do.call(rbind, lapply(names(link_result$fits), function(model) {
    variables <- if (identical(model, "linear")) {
      c("alpha", "beta")
    } else {
      c("alpha", "beta_linear", "beta_square")
    }
    value <- as.data.frame(link_result$fits[[model]]$summary(variables))
    value$model <- model
    value[, c("model", setdiff(names(value), "model"))]
  }))
  rownames(link_parameter_summary) <- NULL
  link_stacking <- data.frame(
    model = as.character(link_result$stacking$model),
    weight = as.numeric(link_result$stacking$weight),
    stringsAsFactors = FALSE
  )

  truncation_artifacts <- file.path(
    "truncation",
    c(
      "scenario-data.csv", "scenario-metadata.csv", "prior-predictive-summary.csv",
      "model-comparison.csv", "diagnostics.csv", "01-stan-prior-predictive.png",
      "02-truncation-estimates.png", "03-truncated-posterior-predictive.png"
    )
  )
  link_artifacts <- file.path(
    "link-loo",
    c(
      "link-function-summary.csv", "logit-baseline-effects.csv",
      "01-binary-inverse-links.png", "02-logit-coefficient-baseline.png",
      "03-poisson-log-exposure.png", "simulated-binary-data.csv",
      "model-comparison.csv", "pareto-k.csv", "stacking-weights.csv",
      "diagnostics.csv", "04-loo-model-predictions.png", "pointwise-elpd.csv",
      "05-pointwise-elpd.png"
    )
  )

  report <- list(
    schemaVersion = 1L,
    status = "PENDING",
    verifiedAt = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
    sourceHashes = source_hashes_before,
    environment = list(
      os = unname(Sys.info()[["sysname"]]),
      osRelease = unname(Sys.info()[["release"]]),
      architecture = unname(Sys.info()[["machine"]]),
      r = paste(R.version$major, R.version$minor, sep = "."),
      cmdstanr = as.character(packageVersion("cmdstanr")),
      cmdstan = as.character(cmdstan_version()),
      loo = as.character(packageVersion("loo"))
    ),
    scenarios = list(
      linearRegression = list(
        status = "PASS",
        originalEvidence = "content/stan/validation.json",
        sample = list(
          seed = 20260801L, chains = 4L, iterWarmup = 1000L, iterSampling = 1000L
        ),
        parameterSummary = linear_summary,
        chainDiagnostics = linear_diagnostics,
        predictedMeans = unname(linear_predicted_means)
      ),
      truncation = list(
        status = "PASS",
        originalEvidence = "content/stan/scenario-validation.json",
        sample = list(
          seed = 20260802L, chains = 4L, iterWarmup = 1000L, iterSampling = 2000L,
          priorIterationsPerScenario = 1000L
        ),
        parameterSummary = truncation_result$comparison,
        chainDiagnostics = truncation_result$diagnostics
      ),
      linkLoo = list(
        status = "PASS",
        originalEvidence = "content/stan/link-comparison-validation.json",
        sample = list(
          seed = 20260802L, chains = 4L, iterWarmup = 750L, iterSampling = 750L,
          observations = 400L, successes = 113L
        ),
        parameterSummary = link_parameter_summary,
        chainDiagnostics = link_result$diagnostics,
        modelComparison = link_result$comparison,
        stackingWeights = link_stacking,
        pointwiseElpdDifferenceSum = sum(link_result$loo$quadratic$pointwise[, "elpd_loo"] -
          link_result$loo$linear$pointwise[, "elpd_loo"])
      )
    ),
    artifacts = list(
      truncation = truncation_artifacts,
      linkLoo = link_artifacts,
      report = "runtime-revalidation-report.json"
    ),
    checks = list(
      sourceIntegrity = "PENDING",
      linearRegression = "PENDING",
      truncation = "PENDING",
      linkLoo = "PENDING"
    ),
    limitations = c(
      "固定seedの合成教材ケースに対する再検証であり、実データや別モデルへ一般化しない",
      "OS間でMCMC drawが完全一致することは要求せず、source hash、診断、教材上の統計的結論、成果物契約を検査する",
      "切断モデルは1,000 samplingで境界的なR-hatが観測されたため、再検証では各chain 2,000 samplingを用いる",
      "第三者フィードバックと初学者観察は公開を止めない改善証拠である"
    )
  )

  source_hashes_after <- runtime_source_hashes(project_root)
  if (!identical(source_hashes_before, source_hashes_after)) {
    stop("The isolated existing-runtime run modified a teaching source")
  }
  report$checks$sourceIntegrity <- "PASS"
  write_json(
    report,
    file.path(output_dir, "runtime-revalidation-report.json"),
    auto_unbox = TRUE,
    dataframe = "rows",
    digits = 10,
    pretty = TRUE
  )
  validation_errors <- validate_existing_runtime_report(report, artifact_root = output_dir)
  if (length(validation_errors) > 0L) {
    report$status <- "FAIL"
    report$validationErrors <- validation_errors
  } else {
    report$status <- "PASS"
    report$checks$linearRegression <- "PASS"
    report$checks$truncation <- "PASS"
    report$checks$linkLoo <- "PASS"
  }
  write_json(
    report,
    file.path(output_dir, "runtime-revalidation-report.json"),
    auto_unbox = TRUE,
    dataframe = "rows",
    digits = 10,
    pretty = TRUE
  )
  if (length(validation_errors) > 0L) {
    stop(paste(validation_errors, collapse = "\n"))
  }
  invisible(report)
}

if (sys.nframe() == 0L) {
  arguments <- commandArgs(trailingOnly = TRUE)
  output_dir <- if (length(arguments) >= 1L) {
    arguments[[1]]
  } else {
    file.path("outputs", "stan-existing-runtime-revalidation")
  }
  report <- run_existing_runtime_revalidation(output_dir)
  linear <- report$scenarios$linearRegression$parameterSummary
  truncation <- report$scenarios$truncation$parameterSummary
  comparison <- report$scenarios$linkLoo$modelComparison
  message(sprintf(
    paste0(
      "Existing Stan runtime revalidation: PASS ",
      "(linear max R-hat %.4f, truncation max R-hat %.4f, LOO diff %.3f +/- %.3f)"
    ),
    max(linear$rhat),
    max(truncation$rhat),
    comparison$elpd_diff[comparison$model == "linear"],
    comparison$se_diff[comparison$model == "linear"]
  ))
}
