library(cmdstanr)

find_reparameterization_project_root <- function(start = getwd()) {
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

configure_cmdstan_239 <- function(project_root) {
  configured <- Sys.getenv("LEARNING_STAN_CMDSTAN", unset = "")
  candidates <- unique(Filter(
    nzchar,
    c(
      configured,
      file.path(project_root, ".codex-cmdstan", "cmdstan-2.39.0"),
      file.path(path.expand("~"), ".cmdstan", "cmdstan-2.39.0")
    )
  ))
  stanc_name <- if (.Platform$OS.type == "windows") "stanc.exe" else "stanc"

  for (candidate in candidates) {
    stanc <- file.path(candidate, "bin", stanc_name)
    if (!dir.exists(candidate) || !file.exists(stanc) || file.access(stanc, 1L) != 0L) next
    set_cmdstan_path(candidate)
    if (identical(as.character(cmdstan_version()), "2.39.0")) return(invisible(candidate))
  }

  stop(
    "CmdStan 2.39.0 was not found. Set LEARNING_STAN_CMDSTAN or run ",
    "cmdstanr::install_cmdstan(version = \"2.39.0\")."
  )
}

reparameterization_scenarios <- function() {
  definitions <- list(
    weak = list(seed = 202608091L, groups = 8L, observations_per_group = 1L, true_mu = 0.5, true_tau = 0.1),
    strong = list(seed = 202608092L, groups = 8L, observations_per_group = 30L, true_mu = 0.5, true_tau = 1.0)
  )

  lapply(names(definitions), function(name) {
    definition <- definitions[[name]]
    set.seed(definition$seed)
    theta <- rnorm(definition$groups, definition$true_mu, definition$true_tau)
    group <- rep(seq_len(definition$groups), each = definition$observations_per_group)
    y <- rnorm(length(group), theta[group], 1)
    list(
      name = name,
      definition = definition,
      theta = theta,
      stan_data = list(
        N = length(group),
        J = definition$groups,
        group = group,
        y = y
      )
    )
  }) |> setNames(names(definitions))
}

fit_summary <- function(fit) {
  as.data.frame(fit$summary(
    c("mu", "tau", "theta"),
    "mean", "sd", "quantile2", "rhat", "ess_bulk", "ess_tail", "mcse_mean", "mcse_sd"
  ))
}

fit_diagnostics <- function(fit, scenario, parameterization, run_type, repetition) {
  diagnostics <- fit$diagnostic_summary(quiet = TRUE)
  data.frame(
    scenario = scenario,
    parameterization = parameterization,
    run_type = run_type,
    repetition = repetition,
    chain = seq_along(diagnostics$num_divergent),
    num_divergent = diagnostics$num_divergent,
    num_max_treedepth = diagnostics$num_max_treedepth,
    ebfmi = diagnostics$ebfmi,
    stringsAsFactors = FALSE
  )
}

fit_once <- function(
  model,
  scenario,
  parameterization,
  output_dir,
  seed,
  chains,
  parallel_chains,
  iter_warmup,
  iter_sampling,
  adapt_delta,
  max_treedepth,
  run_type,
  repetition
) {
  fit_dir <- file.path(output_dir, "cmdstan-output", run_type, scenario$name, parameterization, paste0("r", repetition))
  dir.create(fit_dir, recursive = TRUE, showWarnings = FALSE)
  fit <- model$sample(
    data = scenario$stan_data,
    seed = seed,
    chains = chains,
    parallel_chains = parallel_chains,
    iter_warmup = iter_warmup,
    iter_sampling = iter_sampling,
    init = 0,
    adapt_delta = adapt_delta,
    max_treedepth = max_treedepth,
    refresh = 0,
    output_dir = fit_dir
  )
  summary <- fit_summary(fit)
  tau <- summary[summary$variable == "tau", , drop = FALSE]
  timing <- fit$time()
  list(
    fit = fit,
    summary = summary,
    scenario = scenario$name,
    parameterization = parameterization,
    run_type = run_type,
    repetition = repetition,
    diagnostics = fit_diagnostics(fit, scenario$name, parameterization, run_type, repetition),
    timing = data.frame(
      scenario = scenario$name,
      parameterization = parameterization,
      run_type = run_type,
      repetition = repetition,
      seed = seed,
      elapsed_seconds = timing$total,
      tau_bulk_ess = tau$ess_bulk,
      tau_tail_ess = tau$ess_tail,
      tau_bulk_ess_per_second = tau$ess_bulk / timing$total,
      stringsAsFactors = FALSE
    )
  )
}

write_efficiency_plot <- function(efficiency, output_file) {
  scenarios <- c("weak", "strong")
  parameterizations <- c("centered", "noncentered")
  values <- sapply(scenarios, function(scenario) {
    rows <- efficiency[match(
      paste(scenario, parameterizations),
      paste(efficiency$scenario, efficiency$parameterization)
    ), ]
    rows$tau_bulk_ess_per_second_median
  })
  rownames(values) <- parameterizations
  colors <- c(centered = "#7C1128", noncentered = "#2563EB")

  png(output_file, width = 1300, height = 800, res = 120)
  positions <- barplot(
    values,
    beside = TRUE,
    log = "y",
    col = colors[rownames(values)],
    border = NA,
    ylim = c(min(values) * 0.7, max(values) * 2.2),
    ylab = "tau bulk ESS per second (log scale)",
    names.arg = c("weak group information", "strong group information"),
    main = "Parameterization efficiency depends on group information"
  )
  text(
    positions,
    values * 1.12,
    labels = format(round(values), big.mark = ",", scientific = FALSE),
    cex = 0.8
  )
  legend("top", legend = names(colors), fill = colors, bty = "n", horiz = TRUE)
  dev.off()
}

write_agreement_plot <- function(agreement, output_file) {
  colors <- c(weak = "#7C1128", strong = "#2563EB")
  limits <- range(c(agreement$centered_mean, agreement$noncentered_mean))
  padding <- max(diff(limits) * 0.06, 0.05)

  png(output_file, width = 1000, height = 900, res = 120)
  plot(
    agreement$centered_mean,
    agreement$noncentered_mean,
    pch = 19,
    col = colors[agreement$scenario],
    xlim = limits + c(-padding, padding),
    ylim = limits + c(-padding, padding),
    xlab = "centered posterior mean",
    ylab = "non-centered posterior mean",
    main = "Model-scale posterior agreement"
  )
  abline(0, 1, lwd = 2, lty = 2, col = "#475569")
  legend("topleft", legend = names(colors), col = colors, pch = 19, bty = "n")
  dev.off()
}

run_reparameterization_comparison <- function(
  output_dir,
  project_root = find_reparameterization_project_root(),
  chains = 4L,
  parallel_chains = 4L,
  iter_warmup = 1000L,
  iter_sampling = 1000L,
  repetitions = 3L,
  seed = 20260810L,
  equivalence_iter_sampling = 2000L,
  equivalence_adapt_delta = 0.99
) {
  stopifnot(
    chains == 4L,
    parallel_chains >= 1L,
    iter_warmup >= 500L,
    iter_sampling >= 500L,
    repetitions >= 3L,
    equivalence_iter_sampling >= iter_sampling,
    equivalence_adapt_delta >= 0.9
  )
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  output_dir <- normalizePath(output_dir, winslash = "/", mustWork = TRUE)
  configure_cmdstan_239(project_root)
  if (!identical(as.character(packageVersion("cmdstanr")), "0.9.0")) {
    stop("This evidence run requires CmdStanR 0.9.0")
  }

  scenarios <- reparameterization_scenarios()
  source_dir <- file.path(project_root, "content", "stan", "model-review")
  model_files <- c(
    centered = "mr03-centered.candidate.stan",
    noncentered = "mr03-noncentered.reference.stan"
  )
  model_dir <- file.path(output_dir, "compiled-models")
  dir.create(model_dir, recursive = TRUE, showWarnings = FALSE)
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

  scenario_rows <- do.call(rbind, lapply(scenarios, function(scenario) {
    definition <- scenario$definition
    data.frame(
      scenario = scenario$name,
      observation = seq_len(scenario$stan_data$N),
      group = scenario$stan_data$group,
      y = scenario$stan_data$y,
      true_theta = scenario$theta[scenario$stan_data$group],
      true_mu = definition$true_mu,
      true_tau = definition$true_tau,
      observation_sigma = 1,
      observations_per_group = definition$observations_per_group,
      stringsAsFactors = FALSE
    )
  }))
  rownames(scenario_rows) <- NULL
  write.csv(scenario_rows, file.path(output_dir, "scenario-data.csv"), row.names = FALSE)

  scenario_metadata <- do.call(rbind, lapply(scenarios, function(scenario) {
    definition <- scenario$definition
    data.frame(
      scenario = scenario$name,
      seed = definition$seed,
      groups = definition$groups,
      observations_per_group = definition$observations_per_group,
      observations = scenario$stan_data$N,
      true_mu = definition$true_mu,
      true_tau = definition$true_tau,
      observation_sigma = 1,
      stringsAsFactors = FALSE
    )
  }))
  write.csv(scenario_metadata, file.path(output_dir, "scenario-metadata.csv"), row.names = FALSE)
  for (name in names(scenarios)) {
    write_stan_json(scenarios[[name]]$stan_data, file.path(output_dir, paste0(name, "-input.json")))
  }

  performance_results <- list()
  timing_rows <- list()
  result_index <- 1L
  for (repetition in seq_len(repetitions)) {
    parameterization_order <- if (repetition %% 2L == 1L) names(models) else rev(names(models))
    for (scenario_index in seq_along(scenarios)) {
      scenario <- scenarios[[scenario_index]]
      for (parameterization_index in seq_along(parameterization_order)) {
        parameterization <- parameterization_order[[parameterization_index]]
        run_seed <- seed + scenario_index * 1000L + repetition * 10L + parameterization_index
        result <- fit_once(
          model = models[[parameterization]],
          scenario = scenario,
          parameterization = parameterization,
          output_dir = output_dir,
          seed = run_seed,
          chains = chains,
          parallel_chains = parallel_chains,
          iter_warmup = iter_warmup,
          iter_sampling = iter_sampling,
          adapt_delta = 0.9,
          max_treedepth = 10L,
          run_type = "performance",
          repetition = repetition
        )
        performance_results[[paste(scenario$name, parameterization, repetition, sep = ":")]] <- result
        timing_rows[[result_index]] <- result$timing
        result_index <- result_index + 1L
      }
    }
  }
  timing <- do.call(rbind, timing_rows)
  rownames(timing) <- NULL
  write.csv(timing, file.path(output_dir, "timing-repetitions.csv"), row.names = FALSE)

  primary_results <- lapply(names(scenarios), function(scenario) {
    lapply(names(models), function(parameterization) {
      performance_results[[paste(scenario, parameterization, 1L, sep = ":")]]
    }) |> setNames(names(models))
  }) |> setNames(names(scenarios))

  performance_diagnostics <- do.call(rbind, lapply(performance_results, `[[`, "diagnostics"))
  performance_summary <- do.call(rbind, lapply(performance_results, function(result) {
    table <- result$summary
    table$scenario <- result$scenario
    table$parameterization <- result$parameterization
    table$run_type <- result$run_type
    table$repetition <- result$repetition
    metadata <- c("scenario", "parameterization", "run_type", "repetition")
    table[, c(metadata, setdiff(names(table), metadata))]
  }))

  equivalence_results <- lapply(seq_along(scenarios), function(scenario_index) {
    scenario <- scenarios[[scenario_index]]
    lapply(seq_along(models), function(parameterization_index) {
      parameterization <- names(models)[[parameterization_index]]
      fit_once(
        model = models[[parameterization]],
        scenario = scenario,
        parameterization = parameterization,
        output_dir = output_dir,
        seed = seed + 9000L + scenario_index * 100L + parameterization_index,
        chains = chains,
        parallel_chains = parallel_chains,
        iter_warmup = iter_warmup,
        iter_sampling = equivalence_iter_sampling,
        adapt_delta = equivalence_adapt_delta,
        max_treedepth = 15L,
        run_type = "equivalence",
        repetition = 1L
      )
    }) |> setNames(names(models))
  }) |> setNames(names(scenarios))

  equivalence_diagnostics <- do.call(rbind, lapply(equivalence_results, function(results) {
    do.call(rbind, lapply(results, `[[`, "diagnostics"))
  }))
  equivalence_summary <- do.call(rbind, lapply(names(equivalence_results), function(scenario) {
    do.call(rbind, lapply(names(equivalence_results[[scenario]]), function(parameterization) {
      table <- equivalence_results[[scenario]][[parameterization]]$summary
      table$scenario <- scenario
      table$parameterization <- parameterization
      table$run_type <- "equivalence"
      table$repetition <- 1L
      metadata <- c("scenario", "parameterization", "run_type", "repetition")
      table[, c(metadata, setdiff(names(table), metadata))]
    }))
  }))

  diagnostics <- rbind(performance_diagnostics, equivalence_diagnostics)
  posterior_summary <- rbind(performance_summary, equivalence_summary)
  rownames(diagnostics) <- NULL
  rownames(posterior_summary) <- NULL
  write.csv(diagnostics, file.path(output_dir, "diagnostics.csv"), row.names = FALSE)
  write.csv(posterior_summary, file.path(output_dir, "posterior-summary.csv"), row.names = FALSE)

  efficiency <- do.call(rbind, lapply(names(primary_results), function(scenario) {
    do.call(rbind, lapply(names(primary_results[[scenario]]), function(parameterization) {
      matching_results <- performance_results[vapply(
        performance_results,
        function(result) {
          identical(result$scenario, scenario) && identical(result$parameterization, parameterization)
        },
        logical(1)
      )]
      summaries <- do.call(rbind, lapply(matching_results, `[[`, "summary"))
      tau <- summaries[summaries$variable == "tau", , drop = FALSE]
      diagnostic <- do.call(rbind, lapply(matching_results, `[[`, "diagnostics"))
      timing_subset <- timing[
        timing$scenario == scenario & timing$parameterization == parameterization,
        ,
        drop = FALSE
      ]
      data.frame(
        scenario = scenario,
        parameterization = parameterization,
        divergent_total = sum(diagnostic$num_divergent),
        max_treedepth_total = sum(diagnostic$num_max_treedepth),
        ebfmi_min = min(diagnostic$ebfmi),
        rhat_max = max(summaries$rhat),
        ess_bulk_min = min(summaries$ess_bulk),
        ess_tail_min = min(summaries$ess_tail),
        mcse_mean_max = max(summaries$mcse_mean),
        tau_mean_median = median(tau$mean),
        tau_mcse_mean_max = max(tau$mcse_mean),
        elapsed_seconds_median = median(timing_subset$elapsed_seconds),
        tau_bulk_ess_per_second_median = median(timing_subset$tau_bulk_ess_per_second),
        timing_repetitions = nrow(timing_subset),
        stringsAsFactors = FALSE
      )
    }))
  }))
  rownames(efficiency) <- NULL
  write.csv(efficiency, file.path(output_dir, "efficiency-comparison.csv"), row.names = FALSE)

  agreement <- do.call(rbind, lapply(names(equivalence_results), function(scenario) {
    centered <- equivalence_results[[scenario]]$centered$summary
    noncentered <- equivalence_results[[scenario]]$noncentered$summary
    indices <- match(centered$variable, noncentered$variable)
    combined_mcse <- sqrt(centered$mcse_mean^2 + noncentered$mcse_mean[indices]^2)
    difference <- noncentered$mean[indices] - centered$mean
    data.frame(
      scenario = scenario,
      variable = centered$variable,
      centered_mean = centered$mean,
      noncentered_mean = noncentered$mean[indices],
      mean_difference = difference,
      combined_mcse = combined_mcse,
      absolute_mcse_z = abs(difference) / combined_mcse,
      within_four_mcse = abs(difference) <= 4 * combined_mcse,
      stringsAsFactors = FALSE
    )
  }))
  rownames(agreement) <- NULL
  write.csv(agreement, file.path(output_dir, "posterior-equivalence.csv"), row.names = FALSE)

  environment <- data.frame(
    field = c(
      "os", "release", "architecture", "r", "cmdstanr", "cmdstan", "compiler",
      "chains", "parallel_chains", "iter_warmup", "iter_sampling", "repetitions",
      "initialization", "performance_adapt_delta", "performance_max_treedepth",
      "equivalence_iter_sampling", "equivalence_adapt_delta", "equivalence_max_treedepth"
    ),
    value = c(
      Sys.info()[["sysname"]], Sys.info()[["release"]], R.version$arch,
      paste(R.version$major, R.version$minor, sep = "."),
      as.character(packageVersion("cmdstanr")), as.character(cmdstan_version()),
      system2("clang++", "--version", stdout = TRUE, stderr = TRUE)[[1]],
      chains, parallel_chains, iter_warmup, iter_sampling, repetitions, 0, 0.9, 10,
      equivalence_iter_sampling, equivalence_adapt_delta, 15
    ),
    stringsAsFactors = FALSE
  )
  write.csv(environment, file.path(output_dir, "run-environment.csv"), row.names = FALSE)
  write_efficiency_plot(efficiency, file.path(output_dir, "01-parameterization-efficiency.png"))
  write_agreement_plot(agreement, file.path(output_dir, "02-posterior-agreement.png"))

  invisible(list(
    output_dir = output_dir,
    scenarios = scenarios,
    primary = primary_results,
    equivalence = equivalence_results,
    diagnostics = diagnostics,
    posterior_summary = posterior_summary,
    timing = timing,
    efficiency = efficiency,
    agreement = agreement,
    environment = environment
  ))
}

if (sys.nframe() == 0L) {
  arguments <- commandArgs(trailingOnly = TRUE)
  output_dir <- if (length(arguments) >= 1L) {
    arguments[[1]]
  } else {
    file.path("outputs", "stan-reparameterization-comparison")
  }
  result <- run_reparameterization_comparison(output_dir)
  print(result$efficiency, row.names = FALSE)
  print(result$agreement, row.names = FALSE)
  message("Generated L40 reparameterization files: ", result$output_dir)
}
