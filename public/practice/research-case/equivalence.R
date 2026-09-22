source("common.R"); source("data.R")
library(brms)
cfg <- setup_run("equivalence")
dat <- subset(split_trials(simulate_trials()), split == "train")
pr <- c(set_prior("normal(0, 1.5)", class = "b", coef = "Intercept"),
        set_prior("normal(0, 1)", class = "b", coef = "x"))
fit <- fit_case(correct ~ 0 + Intercept + x, dat, pr, cfg, "brms")
mod <- cmdstanr::cmdstan_model("models/equivalent.stan", dir = cfg$out)
x_new <- c(-.5, 0, .5)
hand <- mod$sample(data = list(N = nrow(dat), x = dat$x, y = dat$correct,
  K = length(x_new), x_new = x_new), chains = cfg$chains, parallel_chains = min(2L, cfg$chains),
  iter_warmup = cfg$warmup, iter_sampling = cfg$iter - cfg$warmup,
  seed = 20260923, adapt_delta = .99, max_treedepth = 12, refresh = 0, output_dir = cfg$out)
hand$save_object(file = file.path(cfg$out, "hand-stan.rds"))
diag <- hand$summary(c("lp__", "alpha", "beta", "p")); sampler <- hand$diagnostic_summary()
write.csv(diag, file.path(cfg$out, "hand-diagnostics.csv"), row.names = FALSE)
write.csv(sampler, file.path(cfg$out, "hand-sampler.csv"), row.names = FALSE)
if (!cfg$smoke && (any(sampler$num_divergent > 0 | sampler$num_max_treedepth > 0 | sampler$ebfmi < .3) ||
    any(!is.finite(diag$rhat) | diag$rhat >= 1.01 | diag$ess_bulk < 400 | diag$ess_tail < 400)))
  stop("Hand Stan diagnostics failed; do not assess equivalence")
# Both expectations and predictive distributions refer to exactly this input grid.
b <- posterior_epred(fit, newdata = data.frame(x = x_new))
h <- posterior::as_draws_matrix(hand$draws("p"))
# Preserve chain dimensions when computing the MCSE of each mean.
br_draws <- posterior::as_draws_array(fit)
br_a <- br_draws[, , "b_Intercept"]; br_b <- br_draws[, , "b_x"]
b_mcse <- vapply(x_new, function(x) posterior::mcse_mean(plogis(br_a + br_b*x)), numeric(1))
h_sum <- hand$summary("p", "mean", "mcse_mean")
comparison <- data.frame(x = x_new, brms_mean = colMeans(b), stan_mean = colMeans(h),
  combined_mcse = sqrt(b_mcse^2 + h_sum$mcse_mean^2))
comparison$difference <- comparison$brms_mean - comparison$stan_mean
comparison$within_mc_error <- abs(comparison$difference) <= 4 * comparison$combined_mcse
write.csv(comparison, file.path(cfg$out, "expected-comparison.csv"), row.names = FALSE)
write.csv(data.frame(x = x_new, intervals(b), intervals(h)), file.path(cfg$out, "expected-intervals.csv"), row.names = FALSE)
byp <- posterior_predict(fit, newdata = data.frame(x = x_new))
hyp <- posterior::as_draws_matrix(hand$draws("y_rep"))
write.csv(data.frame(x = x_new, brms_success = colMeans(byp), stan_success = colMeans(hyp)),
  file.path(cfg$out, "predictive-comparison.csv"), row.names = FALSE)
writeLines(c("Same likelihood: Bernoulli with logit link; identical rows and numeric x.",
  "Same priors: alpha N(0,1.5), beta N(0,1); brms 0 + Intercept avoids centered-intercept prior.",
  "Hand Stan deliberately matches the independent model, not the crossed model.",
  "For a single Bernoulli reaction, the posterior predictive success probability is E[p].",
  "The 4 combined MCSE rule is a numerical check, not a proof or an equivalence test for all quantities.",
  if (cfg$smoke) "SMOKE ONLY" else if (all(comparison$within_mc_error)) "Numerical check passed" else "STOP: investigate mismatch"),
  file.path(cfg$out, "equivalence-record.txt"))
if (!cfg$smoke && !all(comparison$within_mc_error)) stop("Equivalence comparison outside Monte Carlo tolerance")
