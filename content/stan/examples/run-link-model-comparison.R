library(cmdstanr)
library(loo)

find_link_project_root <- function(start = getwd()) {
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

draw_matrix <- function(fit, variables) {
  as.matrix(fit$draws(variables, format = "matrix"))
}

prediction_band <- function(fit, model, grid) {
  if (identical(model, "linear")) {
    draws <- draw_matrix(fit, c("alpha", "beta"))
    eta <- outer(as.numeric(draws[, "alpha"]), rep(1, length(grid))) +
      outer(as.numeric(draws[, "beta"]), grid)
  } else {
    draws <- draw_matrix(fit, c("alpha", "beta_linear", "beta_square"))
    eta <- outer(as.numeric(draws[, "alpha"]), rep(1, length(grid))) +
      outer(as.numeric(draws[, "beta_linear"]), grid) +
      outer(as.numeric(draws[, "beta_square"]), grid^2)
  }
  probabilities <- plogis(eta)
  data.frame(
    model = model,
    x = grid,
    mean = colMeans(probabilities),
    q05 = apply(probabilities, 2, quantile, probs = 0.05),
    q95 = apply(probabilities, 2, quantile, probs = 0.95),
    stringsAsFactors = FALSE
  )
}

write_prediction_plot <- function(data, predictions, truth, output_file) {
  colors <- c(linear = "#dc2626", quadratic = "#2563eb")
  png(output_file, width = 1300, height = 800, res = 120)
  plot(
    data$x,
    data$y,
    pch = 16,
    cex = 0.65,
    col = rgb(15 / 255, 23 / 255, 42 / 255, 0.22),
    xlab = "standardized predictor x",
    ylab = "outcome and Pr(y = 1)",
    main = "Posterior predictions: linear and quadratic logit models"
  )
  grid <- truth$x
  for (name in c("linear", "quadratic")) {
    table <- predictions[predictions$model == name, ]
    polygon(
      c(table$x, rev(table$x)),
      c(table$q05, rev(table$q95)),
      border = NA,
      col = if (name == "linear") rgb(220 / 255, 38 / 255, 38 / 255, 0.12) else rgb(37 / 255, 99 / 255, 235 / 255, 0.12)
    )
    lines(table$x, table$mean, lwd = 3, col = colors[[name]])
  }
  lines(grid, truth$probability, lwd = 4, lty = 2, col = "#111827")
  legend(
    "bottomright",
    legend = c("data-generating probability", "linear logit", "quadratic logit", "90% posterior interval"),
    col = c("#111827", colors[["linear"]], colors[["quadratic"]], "#94a3b8"),
    lty = c(2, 1, 1, 1),
    lwd = c(4, 3, 3, 8),
    bty = "n"
  )
  dev.off()
}

write_pointwise_plot <- function(pointwise, output_file) {
  colors <- ifelse(pointwise$elpd_difference >= 0, "#2563eb", "#dc2626")
  png(output_file, width = 1300, height = 760, res = 120)
  plot(
    pointwise$observation,
    pointwise$elpd_difference,
    type = "h",
    lwd = 2,
    col = colors,
    xlab = "observation index",
    ylab = "pointwise ELPD: quadratic - linear",
    main = "Aggregate ELPD is a sum of observation-level differences"
  )
  abline(h = 0, lwd = 2, col = "#111827")
  legend(
    "topright",
    legend = c("quadratic predicts better", "linear predicts better"),
    col = c("#2563eb", "#dc2626"),
    lwd = 3,
    bty = "n"
  )
  dev.off()
}

run_link_model_comparison <- function(
  output_dir,
  project_root = find_link_project_root(),
  chains = 4L,
  iter_warmup = 750L,
  iter_sampling = 750L,
  seed = 20260802L,
  n = 400L
) {
  stopifnot(chains >= 2L, iter_warmup >= 250L, iter_sampling >= 250L, n >= 100L)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  output_dir <- normalizePath(output_dir, winslash = "/", mustWork = TRUE)

  local_cmdstan <- file.path(project_root, ".codex-cmdstan", "cmdstan-2.39.0")
  configured_cmdstan <- Sys.getenv("LEARNING_STAN_CMDSTAN", unset = "")
  if (nzchar(configured_cmdstan)) {
    set_cmdstan_path(configured_cmdstan)
  } else if (dir.exists(local_cmdstan)) {
    set_cmdstan_path(local_cmdstan)
  }
  if (!identical(as.character(cmdstan_version()), "2.39.0")) {
    stop("This evidence run requires CmdStan 2.39.0")
  }

  source_dir <- file.path(project_root, "content", "stan", "examples")
  source(file.path(source_dir, "simulate-link-functions.R"), local = TRUE)
  run_link_function_lab(output_dir, seed = seed)

  model_dir <- file.path(output_dir, "compiled-models")
  cmdstan_output_dir <- file.path(output_dir, "cmdstan-output")
  dir.create(model_dir, recursive = TRUE, showWarnings = FALSE)
  dir.create(cmdstan_output_dir, recursive = TRUE, showWarnings = FALSE)

  model_files <- c(
    linear = "binary-logit-linear.stan",
    quadratic = "binary-logit-quadratic.stan"
  )
  copied_files <- file.path(model_dir, unname(model_files))
  if (!all(file.copy(file.path(source_dir, unname(model_files)), copied_files, overwrite = TRUE))) {
    stop("Stan source files could not be copied to the isolated runtime directory")
  }
  models <- lapply(copied_files, function(file) {
    model <- cmdstan_model(file, compile = FALSE)
    model$check_syntax()
    model$compile()
    model
  })
  names(models) <- names(model_files)

  set.seed(seed)
  x <- sort(runif(n, min = -2, max = 2))
  truth <- c(alpha = -0.4, beta_linear = 1.1, beta_square = -0.9)
  true_eta <- truth[["alpha"]] + truth[["beta_linear"]] * x + truth[["beta_square"]] * x^2
  true_probability <- plogis(true_eta)
  y <- rbinom(n, size = 1, prob = true_probability)
  simulated_data <- data.frame(
    observation = seq_len(n),
    x = x,
    y = y,
    true_probability = true_probability
  )
  write.csv(simulated_data, file.path(output_dir, "simulated-binary-data.csv"), row.names = FALSE)

  stan_data <- list(N = n, x = x, y = y)
  fits <- lapply(names(models), function(name) {
    fit_output_dir <- file.path(cmdstan_output_dir, name)
    dir.create(fit_output_dir, recursive = TRUE, showWarnings = FALSE)
    models[[name]]$sample(
      data = stan_data,
      seed = seed,
      chains = chains,
      parallel_chains = chains,
      iter_warmup = iter_warmup,
      iter_sampling = iter_sampling,
      refresh = 0,
      output_dir = fit_output_dir
    )
  })
  names(fits) <- names(models)

  log_lik <- lapply(fits, function(fit) fit$draws("log_lik", format = "draws_array"))
  relative_efficiencies <- lapply(log_lik, function(value) relative_eff(exp(value)))
  loo_results <- Map(
    function(value, efficiency) loo(value, r_eff = efficiency, cores = min(chains, 4L)),
    log_lik,
    relative_efficiencies
  )
  comparison <- loo_compare(loo_results)
  sample_count <- chains * iter_sampling
  pareto_threshold <- min(1 - 1 / log10(sample_count), 0.7)

  model_comparison <- do.call(rbind, lapply(names(loo_results), function(name) {
    value <- loo_results[[name]]
    comparison_row <- comparison[comparison$model == name, , drop = FALSE]
    pareto_k <- pareto_k_values(value)
    data.frame(
      model = name,
      elpd_loo = value$estimates["elpd_loo", "Estimate"],
      se_elpd_loo = value$estimates["elpd_loo", "SE"],
      p_loo = value$estimates["p_loo", "Estimate"],
      looic = value$estimates["looic", "Estimate"],
      elpd_diff = comparison_row[1, "elpd_diff"],
      se_diff = comparison_row[1, "se_diff"],
      pareto_k_max = max(pareto_k),
      pareto_threshold = pareto_threshold,
      pareto_k_flagged = sum(pareto_k > pareto_threshold),
      stringsAsFactors = FALSE
    )
  }))
  rownames(model_comparison) <- NULL
  write.csv(model_comparison, file.path(output_dir, "model-comparison.csv"), row.names = FALSE)

  pareto_table <- do.call(rbind, lapply(names(loo_results), function(name) {
    data.frame(
      model = name,
      observation = seq_len(n),
      pareto_k = pareto_k_values(loo_results[[name]]),
      threshold = pareto_threshold,
      flagged = pareto_k_values(loo_results[[name]]) > pareto_threshold,
      stringsAsFactors = FALSE
    )
  }))
  write.csv(pareto_table, file.path(output_dir, "pareto-k.csv"), row.names = FALSE)

  weights <- loo_model_weights(loo_results, method = "stacking")
  stacking <- data.frame(model = names(weights), weight = unname(weights), stringsAsFactors = FALSE)
  write.csv(stacking, file.path(output_dir, "stacking-weights.csv"), row.names = FALSE)

  diagnostics <- do.call(rbind, lapply(names(fits), function(name) {
    value <- as.data.frame(fits[[name]]$diagnostic_summary())
    value$model <- name
    value$chain <- seq_len(nrow(value))
    value[, c("model", "chain", setdiff(names(value), c("model", "chain")))]
  }))
  rownames(diagnostics) <- NULL
  write.csv(diagnostics, file.path(output_dir, "diagnostics.csv"), row.names = FALSE)

  grid <- seq(-2, 2, length.out = 201L)
  predictions <- rbind(
    prediction_band(fits$linear, "linear", grid),
    prediction_band(fits$quadratic, "quadratic", grid)
  )
  true_grid <- data.frame(
    x = grid,
    probability = plogis(truth[["alpha"]] + truth[["beta_linear"]] * grid + truth[["beta_square"]] * grid^2)
  )
  write_prediction_plot(
    simulated_data,
    predictions,
    true_grid,
    file.path(output_dir, "04-loo-model-predictions.png")
  )

  pointwise <- data.frame(
    observation = seq_len(n),
    x = x,
    elpd_difference = loo_results$quadratic$pointwise[, "elpd_loo"] -
      loo_results$linear$pointwise[, "elpd_loo"]
  )
  write.csv(pointwise, file.path(output_dir, "pointwise-elpd.csv"), row.names = FALSE)
  write_pointwise_plot(pointwise, file.path(output_dir, "05-pointwise-elpd.png"))

  invisible(list(
    output_dir = output_dir,
    comparison = model_comparison,
    pareto = pareto_table,
    stacking = stacking,
    diagnostics = diagnostics,
    fits = fits,
    loo = loo_results
  ))
}

if (sys.nframe() == 0L) {
  arguments <- commandArgs(trailingOnly = TRUE)
  output_dir <- if (length(arguments) >= 1L) arguments[[1]] else file.path("outputs", "stan-link-comparison")
  result <- run_link_model_comparison(output_dir)
  print(result$comparison, row.names = FALSE)
  print(result$stacking, row.names = FALSE)
  message("Generated link/model-comparison files: ", result$output_dir)
}
