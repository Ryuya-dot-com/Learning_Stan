# Run from the extracted research-case directory. No previous R session required.
setup_run <- function(label) {
  args <- commandArgs(trailingOnly = TRUE)
  smoke <- "--smoke" %in% args
  out <- Sys.getenv("LEARNING_STAN_OUTPUT", file.path("outputs", label))
  if (dir.exists(out) && length(list.files(out, all.files = TRUE, no.. = TRUE)))
    stop("Output directory is not empty; choose a new LEARNING_STAN_OUTPUT to preserve earlier runs")
  dir.create(out, recursive = TRUE, showWarnings = FALSE)
  stopifnot(requireNamespace("brms", quietly = TRUE), requireNamespace("cmdstanr", quietly = TRUE))
  configured <- Sys.getenv("LEARNING_STAN_CMDSTAN", "")
  if (nzchar(configured)) cmdstanr::set_cmdstan_path(configured)
  cmdstanr::cmdstan_version(error_on_NA = TRUE)
  set.seed(20260922)
  writeLines(c(capture.output(sessionInfo()), paste("CmdStan", cmdstanr::cmdstan_version()),
    paste("mode", if (smoke) "smoke: execution only" else "full"),
    paste("args", paste(args, collapse = " "))), file.path(out, "environment.txt"))
  inputs <- list.files(".", pattern = "\\.(R|stan|md|json)$", recursive = TRUE, full.names = TRUE)
  inputs <- inputs[!grepl("/(outputs|r-library)/", inputs)]
  write.csv(data.frame(file = inputs, md5 = unname(tools::md5sum(inputs))),
    file.path(out, "source-manifest.csv"), row.names = FALSE)
  list(out = out, smoke = smoke, chains = if (smoke) 2L else 4L,
    iter = if (smoke) 400L else 2000L, warmup = if (smoke) 200L else 1000L)
}

fit_case <- function(formula, data, prior, cfg, name, family = brms::bernoulli()) {
  fit <- brms::brm(formula, data = data, family = family, prior = prior,
    backend = "cmdstanr", chains = cfg$chains, cores = min(cfg$chains, 2L),
    iter = cfg$iter, warmup = cfg$warmup, seed = 20260922,
    control = list(adapt_delta = .99, max_treedepth = 12), refresh = 0)
  saveRDS(fit, file.path(cfg$out, paste0(name, ".rds")))
  writeLines(brms::stancode(fit), file.path(cfg$out, paste0(name, ".stan")))
  inspect_fit(fit, cfg, name)
  fit
}

inspect_fit <- function(fit, cfg, name) {
  draws <- posterior::as_draws_array(fit)
  diag <- posterior::summarise_draws(draws)
  write.csv(diag, file.path(cfg$out, paste0(name, "-diagnostics.csv")), row.names = FALSE)
  np <- brms::nuts_params(fit)
  write.csv(np, file.path(cfg$out, paste0(name, "-nuts.csv")), row.names = FALSE)
  energy <- split(np$Value[np$Parameter == "energy__"], np$Chain[np$Parameter == "energy__"])
  bfmi <- vapply(energy, function(e) mean(diff(e)^2) / var(e), numeric(1))
  write.csv(data.frame(chain = names(bfmi), ebfmi = bfmi), file.path(cfg$out, paste0(name, "-energy.csv")), row.names = FALSE)
  ok <- all(is.finite(diag$rhat)) && all(diag$rhat < 1.01) &&
    all(diag$ess_bulk >= 400 & diag$ess_tail >= 400) &&
    !any(np$Value[np$Parameter == "divergent__"] > 0) &&
    !any(np$Value[np$Parameter == "treedepth__"] >= 12) && all(bfmi >= .3)
  writeLines(if (cfg$smoke) "SMOKE_ONLY: do not interpret estimates" else if (ok) "PASS" else "STOP: diagnose before interpreting",
    file.path(cfg$out, paste0(name, "-status.txt")))
  if (!cfg$smoke && !ok) stop(structure(
    list(message=paste0(name, ": diagnostic stopping rule triggered; artifacts preserved"), call=NULL),
    class=c("stan_diagnostic_stop", "error", "condition")))
  invisible(ok)
}

intervals <- function(draws) {
  t(apply(draws, 2, quantile, probs = c(.05, .5, .95)))
}
