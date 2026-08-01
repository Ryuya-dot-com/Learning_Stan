library(cmdstanr)

find_project_root <- function(start = getwd()) {
  candidate <- normalizePath(start, winslash = "/", mustWork = TRUE)
  repeat {
    if (
      file.exists(file.path(candidate, "package.json")) &&
      dir.exists(file.path(candidate, "content", "stan"))
    ) {
      return(candidate)
    }
    parent <- dirname(candidate)
    if (identical(parent, candidate)) {
      stop("Learning_Stan project root was not found")
    }
    candidate <- parent
  }
}

sample_truncated_normal <- function(n, mu, sigma, lower_bound, upper_bound) {
  lower_probability <- pnorm(lower_bound, mean = mu, sd = sigma)
  upper_probability <- pnorm(upper_bound, mean = mu, sd = sigma)
  probability <- runif(n, min = lower_probability, max = upper_probability)
  qnorm(probability, mean = mu, sd = sigma)
}

summarize_prior_draws <- function(draws) {
  groups <- split(draws, draws$scenario)
  do.call(
    rbind,
    lapply(groups, function(group) {
      data.frame(
        scenario = group$scenario[[1]],
        prior_scale = group$prior_scale[[1]],
        sigma_rate = group$sigma_rate[[1]],
        y_mean = mean(group$y_sim),
        y_sd = sd(group$y_sim),
        y_q05 = unname(quantile(group$y_sim, 0.05)),
        y_median = median(group$y_sim),
        y_q95 = unname(quantile(group$y_sim, 0.95)),
        sigma_mean = mean(group$sigma_sim),
        stringsAsFactors = FALSE
      )
    })
  )
}

write_prior_plot <- function(draws, output_file) {
  colors <- c(narrow = "#16a34a", baseline = "#2563eb", wide = "#dc2626")
  groups <- split(draws, draws$scenario)
  densities <- lapply(
    groups,
    function(group) density(group$y_sim, n = 800, from = -15, to = 15)
  )

  png(output_file, width = 1200, height = 760, res = 120)
  on.exit(dev.off(), add = TRUE)
  first <- names(densities)[[1]]
  plot(
    densities[[first]],
    type = "l",
    lwd = 3,
    col = colors[[first]],
    xlim = c(-15, 15),
    ylim = c(0, max(vapply(densities, function(value) max(value$y), numeric(1))) * 1.05),
    xlab = "Stan-generated y_sim",
    ylab = "density",
    main = "Prior predictive sensitivity from Stan"
  )
  for (name in names(densities)[-1]) {
    lines(densities[[name]], lwd = 3, col = colors[[name]])
  }
  legend(
    "topright",
    legend = names(densities),
    col = unname(colors[names(densities)]),
    lwd = 3,
    bty = "n"
  )
}

write_estimate_plot <- function(comparison, output_file) {
  colors <- c(correct_truncated = "#2563eb", wrong_naive = "#dc2626")
  png(output_file, width = 1300, height = 720, res = 120)
  old_par <- par(mfrow = c(1, 2), mar = c(5, 4.5, 3.5, 1))
  on.exit({
    par(old_par)
    dev.off()
  }, add = TRUE)

  for (parameter in c("mu", "sigma")) {
    table <- comparison[comparison$variable == parameter, ]
    positions <- seq_len(nrow(table))
    limits <- range(c(table$q5, table$q95, table$truth))
    padding <- diff(limits) * 0.18
    plot(
      positions,
      table$mean,
      ylim = limits + c(-padding, padding),
      xlim = c(0.5, length(positions) + 0.5),
      xaxt = "n",
      xlab = "model",
      ylab = parameter,
      pch = 19,
      cex = 1.5,
      col = unname(colors[table$model]),
      main = paste("Posterior", parameter)
    )
    axis(1, at = positions, labels = c("correct T[L,U]", "wrong: no normalizer"))
    segments(
      positions,
      table$q5,
      positions,
      table$q95,
      lwd = 4,
      col = unname(colors[table$model])
    )
    abline(h = table$truth[[1]], lty = 2, lwd = 2, col = "#111827")
    legend("topright", legend = "data-generating value", lty = 2, lwd = 2, bty = "n")
  }
}

write_posterior_predictive_plot <- function(observed, y_rep, output_file) {
  png(output_file, width = 1200, height = 760, res = 120)
  on.exit(dev.off(), add = TRUE)
  observed_density <- density(observed, from = min(observed), to = max(observed), n = 500)
  plot(
    observed_density,
    type = "l",
    lwd = 4,
    col = "#111827",
    xlab = "retained measurement (seconds)",
    ylab = "density",
    main = "Posterior predictive check for the truncated model"
  )
  selected <- unique(round(seq(1, nrow(y_rep), length.out = min(40, nrow(y_rep)))))
  for (index in selected) {
    replicated_density <- density(
      y_rep[index, ],
      from = min(observed),
      to = max(observed),
      n = 500
    )
    lines(replicated_density, col = grDevices::adjustcolor("#60a5fa", alpha.f = 0.18))
  }
  lines(observed_density, lwd = 4, col = "#111827")
  legend(
    "topright",
    legend = c("observed", "40 posterior replications"),
    col = c("#111827", "#60a5fa"),
    lwd = c(4, 2),
    bty = "n"
  )
}

run_distribution_models <- function(
  output_dir,
  project_root = find_project_root(),
  chains = 4L,
  iter_warmup = 1000L,
  iter_sampling = 1000L,
  prior_iterations = 1000L,
  seed = 20260802L
) {
  stopifnot(chains >= 1L, iter_warmup >= 1L, iter_sampling >= 1L, prior_iterations >= 100L)
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
  model_dir <- file.path(output_dir, "compiled-models")
  cmdstan_output_dir <- file.path(output_dir, "cmdstan-output")
  dir.create(model_dir, recursive = TRUE, showWarnings = FALSE)
  dir.create(cmdstan_output_dir, recursive = TRUE, showWarnings = FALSE)

  model_files <- c(
    prior = "prior-predictive.stan",
    correct_truncated = "truncated-normal.stan",
    wrong_naive = "wrong-naive-bounded-normal.stan"
  )
  copied_files <- file.path(model_dir, unname(model_files))
  copied <- file.copy(file.path(source_dir, unname(model_files)), copied_files, overwrite = TRUE)
  if (!all(copied)) stop("Stan source files could not be copied to the isolated runtime directory")

  models <- lapply(copied_files, function(file) {
    model <- cmdstan_model(file, compile = FALSE)
    model$check_syntax()
    model$compile()
    model
  })
  names(models) <- names(model_files)

  prior_settings <- data.frame(
    scenario = c("narrow", "baseline", "wide"),
    prior_scale = c(0.5, 2, 4),
    sigma_rate = c(2, 1, 0.5),
    stringsAsFactors = FALSE
  )
  prior_draws <- vector("list", nrow(prior_settings))
  for (index in seq_len(nrow(prior_settings))) {
    setting <- prior_settings[index, ]
    prior_output_dir <- file.path(cmdstan_output_dir, paste0("prior-", setting$scenario))
    dir.create(prior_output_dir, recursive = TRUE, showWarnings = FALSE)
    fit <- models$prior$sample(
      data = list(
        N = 1L,
        prior_location = 0,
        prior_scale = setting$prior_scale,
        sigma_rate = setting$sigma_rate
      ),
      seed = seed + index,
      chains = 1,
      parallel_chains = 1,
      iter_warmup = 0,
      iter_sampling = prior_iterations,
      fixed_param = TRUE,
      refresh = 0,
      output_dir = prior_output_dir
    )
    values <- as.matrix(fit$draws(c("mu_sim", "sigma_sim", "y_sim[1]"), format = "matrix"))
    prior_draws[[index]] <- data.frame(
      scenario = setting$scenario,
      prior_scale = setting$prior_scale,
      sigma_rate = setting$sigma_rate,
      mu_sim = values[, "mu_sim"],
      sigma_sim = values[, "sigma_sim"],
      y_sim = values[, "y_sim[1]"],
      stringsAsFactors = FALSE
    )
  }
  prior_draws <- do.call(rbind, prior_draws)
  rownames(prior_draws) <- NULL
  prior_summary <- summarize_prior_draws(prior_draws)
  write.csv(prior_summary, file.path(output_dir, "prior-predictive-summary.csv"), row.names = FALSE)
  write_prior_plot(prior_draws, file.path(output_dir, "01-stan-prior-predictive.png"))

  set.seed(seed)
  truth <- c(mu = 0.15, sigma = 0.45)
  lower_bound <- 0
  upper_bound <- 1.5
  observed <- sample_truncated_normal(
    n = 2000,
    mu = truth[["mu"]],
    sigma = truth[["sigma"]],
    lower_bound = lower_bound,
    upper_bound = upper_bound
  )
  scenario_data <- data.frame(
    measurement_id = seq_along(observed),
    retained_seconds = observed
  )
  write.csv(scenario_data, file.path(output_dir, "scenario-data.csv"), row.names = FALSE)
  metadata <- data.frame(
    field = c("seed", "N", "true_mu", "true_sigma", "lower_bound", "upper_bound", "retention_probability"),
    value = c(
      seed,
      length(observed),
      truth[["mu"]],
      truth[["sigma"]],
      lower_bound,
      upper_bound,
      pnorm(upper_bound, truth[["mu"]], truth[["sigma"]]) -
        pnorm(lower_bound, truth[["mu"]], truth[["sigma"]])
    )
  )
  write.csv(metadata, file.path(output_dir, "scenario-metadata.csv"), row.names = FALSE)

  stan_data <- list(
    N = length(observed),
    lower_bound = lower_bound,
    upper_bound = upper_bound,
    y = observed
  )
  sampling_arguments <- list(
    data = stan_data,
    seed = seed,
    chains = chains,
    parallel_chains = chains,
    iter_warmup = iter_warmup,
    iter_sampling = iter_sampling,
    init = 0,
    refresh = 0
  )
  correct_output_dir <- file.path(cmdstan_output_dir, "correct-truncated")
  wrong_output_dir <- file.path(cmdstan_output_dir, "wrong-naive")
  dir.create(correct_output_dir, recursive = TRUE, showWarnings = FALSE)
  dir.create(wrong_output_dir, recursive = TRUE, showWarnings = FALSE)
  correct_fit <- do.call(
    models$correct_truncated$sample,
    c(sampling_arguments, list(output_dir = correct_output_dir))
  )
  wrong_fit <- do.call(
    models$wrong_naive$sample,
    c(sampling_arguments, list(output_dir = wrong_output_dir))
  )

  correct_summary <- as.data.frame(correct_fit$summary(c("mu", "sigma")))
  correct_summary$model <- "correct_truncated"
  wrong_summary <- as.data.frame(wrong_fit$summary(c("mu", "sigma")))
  wrong_summary$model <- "wrong_naive"
  comparison <- rbind(correct_summary, wrong_summary)
  comparison$truth <- unname(truth[comparison$variable])
  comparison <- comparison[, c(
    "model", "variable", "truth", "mean", "median", "sd", "q5", "q95",
    "rhat", "ess_bulk", "ess_tail"
  )]
  write.csv(comparison, file.path(output_dir, "model-comparison.csv"), row.names = FALSE)

  correct_diagnostics <- as.data.frame(correct_fit$diagnostic_summary())
  correct_diagnostics$model <- "correct_truncated"
  correct_diagnostics$chain <- seq_len(nrow(correct_diagnostics))
  wrong_diagnostics <- as.data.frame(wrong_fit$diagnostic_summary())
  wrong_diagnostics$model <- "wrong_naive"
  wrong_diagnostics$chain <- seq_len(nrow(wrong_diagnostics))
  diagnostics <- rbind(correct_diagnostics, wrong_diagnostics)
  diagnostics <- diagnostics[, c("model", "chain", setdiff(names(diagnostics), c("model", "chain")))]
  write.csv(diagnostics, file.path(output_dir, "diagnostics.csv"), row.names = FALSE)

  y_rep <- as.matrix(correct_fit$draws("y_rep", format = "matrix"))
  write_estimate_plot(comparison, file.path(output_dir, "02-truncation-estimates.png"))
  write_posterior_predictive_plot(
    observed,
    y_rep,
    file.path(output_dir, "03-truncated-posterior-predictive.png")
  )

  invisible(list(
    output_dir = output_dir,
    prior_summary = prior_summary,
    comparison = comparison,
    diagnostics = diagnostics,
    correct_fit = correct_fit,
    wrong_fit = wrong_fit
  ))
}

if (sys.nframe() == 0L) {
  arguments <- commandArgs(trailingOnly = TRUE)
  output_dir <- if (length(arguments) >= 1L) {
    arguments[[1]]
  } else {
    file.path(tempdir(), "learning-stan-model-scenario")
  }
  result <- run_distribution_models(output_dir)
  print(result$prior_summary, row.names = FALSE)
  print(result$comparison, row.names = FALSE)
  print(result$diagnostics, row.names = FALSE)
  message("Generated Stan scenario files: ", result$output_dir)
}
