source("common.R")
source("measurement.R")
library(brms)
cfg <- setup_run("observation")
set.seed(20260922)
n <- 160
d <- data.frame(x = rep(c(-.5, .5), n/2))
d$latent_rt <- rlnorm(n, log(600) + .25*d$x, .35)
limit <- 800
d$rt <- pmin(d$latent_rt, limit)
d$cens <- ifelse(d$latent_rt >= limit, "right", "none")
write.csv(d, file.path(cfg$out, "timeout-data.csv"), row.names = FALSE)
pr <- c(set_prior("normal(6.4, .5)", class = "Intercept"), set_prior("normal(0, .5)", class = "b"), set_prior("exponential(2)", class = "sigma"))
forms <- list(delete = rt ~ x, replace = rt ~ x, censored = rt | cens(cens) ~ x)
fits <- lapply(names(forms), function(name) {
  data <- if (name == "delete") subset(d, cens == "none") else d
  fit_case(forms[[name]], data, pr, cfg, paste0("timeout-", name), lognormal())
})
write.csv(do.call(rbind, lapply(seq_along(fits), function(i) {
  b <- as.data.frame(fits[[i]])$b_x
  data.frame(method = names(forms)[i], n = nobs(fits[[i]]), true_log_ratio = .25,
    mean = mean(b), t(quantile(b, c(.05, .5, .95))), check.names = FALSE)
})), file.path(cfg$out, "timeout-comparison.csv"), row.names = FALSE)
# Measurement error: the error SD is external information, not estimated from one noisy measurement.
e <- measurement_data()
write.csv(e, file.path(cfg$out, "measurement-data.csv"), row.names = FALSE)
naive <- fit_case(y ~ xobs, e, c(set_prior("normal(0, 1)", class="b"),
  set_prior("normal(0, 1)", class="Intercept"), set_prior("exponential(1)", class="sigma")), cfg, "measurement-naive", gaussian())
summarize_slope <- function(name, b, status="PASS") {
  data.frame(method=name, status=status, true_slope=.8, mean=mean(b),
    low=unname(quantile(b,.05)), high=unname(quantile(b,.95)))
}
measurement <- list(summarize_slope("naive", as.data.frame(naive)$b_xobs,
  if(cfg$smoke) "SMOKE_ONLY" else "PASS"))
scales <- as.numeric(strsplit(Sys.getenv("MEASUREMENT_SCALES", ".75,1,1.25"), ",", fixed=TRUE)[[1]])
stopifnot(length(scales)>0, all(is.finite(scales) & scales>0), 1 %in% scales)
model <- cmdstanr::cmdstan_model("models/measurement-error-marginal.stan",dir=cfg$out)
for (scale in scales) {
  e$se <- .7*scale
  # Only a diagnosed sampling failure is a scientific comparison outcome.
  # Syntax, API and filesystem errors still abort rather than being relabeled as model failure.
  row <- tryCatch({
    fit <- fit_measurement(model,e,cfg,paste0("measurement-",scale))
    summarize_slope(paste0("error_sd_x",scale), as.numeric(fit$draws("beta",format="matrix")),
      if(cfg$smoke) "SMOKE_ONLY" else "PASS")
  }, stan_diagnostic_stop=function(e) data.frame(method=paste0("error_sd_x",scale),
    status=conditionMessage(e), true_slope=.8, mean=NA_real_, low=NA_real_, high=NA_real_))
  measurement[[length(measurement)+1L]] <- row
  write.csv(do.call(rbind,measurement), file.path(cfg$out,"measurement-comparison.csv"),row.names=FALSE)
}
comparison <- do.call(rbind,measurement)
if (!cfg$smoke && comparison$status[comparison$method == "error_sd_x1"] != "PASS")
  stop("Reference measurement-error model failed diagnostics; inspect saved artifacts")
writeLines(if (anyNA(comparison$mean)) "INCOMPLETE_SENSITIVITY: failed fits withheld; no robustness claim" else
  if(cfg$smoke) "SMOKE_ONLY" else "PASS", file.path(cfg$out,"observation-status.txt"))
writeLines(c("Synthetic examples, not a demonstration that more complex models are always correct.",
 "Timeout: deletion conditions on response before deadline; replacement asserts an exact time; censoring asserts only rt>=800.",
 "The censoring model assumes lognormal latent time and a known fixed deadline; it does not model all causes of nonresponse.",
 "Measurement error: normal latent predictor distribution and independent normal error with externally supplied SD.",
 "Latent x is analytically marginalized with the same likelihood and priors as the brms mi() model.",
 "See measurement-sensitivity.R and measurement-sensitivity.md for the extended grid and validation.",
 "A larger SD assumption may conflict with observed spread: inspect diagnostics and prior dependence, do not prefer it automatically.",
 "A single replication is not a bias/coverage study. Check intervals, diagnostics and the observation assumptions before reporting."),
 file.path(cfg$out, "observation-record.txt"))
