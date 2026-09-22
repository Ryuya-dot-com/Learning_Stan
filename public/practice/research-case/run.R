source("common.R")
source("data.R")
library(brms)
cfg <- setup_run("crossed")
dat <- split_trials(simulate_trials())
stopifnot(!anyDuplicated(dat$row_id), !anyNA(dat), all(dat$correct %in% 0:1), all(dat$x %in% c(-.5, .5)))
write.csv(dat, file.path(cfg$out, "raw-trials.csv"), row.names = FALSE)
train <- subset(dat, split == "train")
write.csv(train, file.path(cfg$out, "analysis.csv"), row.names = FALSE)
write.csv(as.data.frame(with(dat, table(split, correct))), file.path(cfg$out, "data-audit.csv"), row.names = FALSE)
write.csv(aggregate(correct ~ x + participant, train, mean), file.path(cfg$out, "descriptive.csv"), row.names = FALSE)
base_prior <- c(set_prior("normal(0, 1.5)", class = "b", coef = "Intercept"),
                set_prior("normal(0, 1)", class = "b", coef = "x"))
# Explicit intercept prevents hidden intercept centering in the equivalence lab.
formulas <- list(independent = correct ~ 0 + Intercept + x,
                participant = correct ~ 0 + Intercept + x + (1 | participant),
                crossed = correct ~ 0 + Intercept + x + (1 | participant) + (1 | item))
# Prior predictive check from the exact crossed model priors, without conditioning on y.
set.seed(20260924)
prior_rates <- replicate(500, {
  alpha <- rnorm(1, 0, 1.5); beta <- rnorm(1, 0, 1)
  ap <- rnorm(max(train$p), 0, rexp(1)); bi <- rnorm(max(train$i), 0, rexp(1))
  mean(rbinom(nrow(train), 1, plogis(alpha + beta*train$x + ap[train$p] + bi[train$i])))
})
write.csv(data.frame(accuracy=prior_rates), file.path(cfg$out,"prior-rates.csv"), row.names=FALSE)
png(file.path(cfg$out,"prior-predictive.png"), width=1000,height=650)
hist(prior_rates, xlim=c(0,1), xlab="Replicated overall accuracy", main="Prior predictive")
dev.off()
# This broad prior allows extreme accuracy. Inspect whether that is plausible before applying to real data.
fits <- list(); scores <- list(); predictions <- list(); effects <- list()
for (name in names(formulas)) {
  pr <- if (name == "independent") base_prior else c(base_prior, set_prior("exponential(1)", class = "sd"))
  fit <- fit_case(formulas[[name]], train, pr, cfg, name)
  fits[[name]] <- fit
  beta <- as.data.frame(fit)$b_x
  effects[[name]] <- data.frame(model = name, mean = mean(beta), t(quantile(beta, c(.05, .5, .95))), check.names = FALSE)
  for (target in setdiff(unique(dat$split), "train")) {
    test <- subset(dat, split == target)
    ep <- posterior_epred(fit, newdata = test, allow_new_levels = TRUE, sample_new_levels = "gaussian")
    # Binary individual predictive intervals are often [0,1]; summarize a cohort rate instead.
    yp <- posterior_predict(fit, newdata = test, allow_new_levels = TRUE, sample_new_levels = "gaussian")
    prob <- colMeans(ep)
    prob <- pmin(pmax(prob, 1e-12), 1 - 1e-12)
    scores[[paste(name, target)]] <- data.frame(model = name, target = target, n = nrow(test),
      brier = mean((prob - test$correct)^2),
      marginal_log_score = mean(ifelse(test$correct == 1, log(prob), log1p(-prob))))
    predictions[[paste(name, target)]] <- data.frame(model = name, target = target,
      type = c("expected cohort rate", "replicated cohort rate"),
      rbind(quantile(rowMeans(ep), c(.05, .5, .95)), quantile(rowMeans(yp), c(.05, .5, .95))), check.names = FALSE)
    write.csv(data.frame(row_id = test$row_id, probability = colMeans(ep), intervals(ep)),
      file.path(cfg$out, paste(name, target, "probabilities.csv", sep = "-")), row.names = FALSE)
  }
}
sensitive_prior <- c(set_prior("normal(0, 1.5)", class="b", coef="Intercept"),
  set_prior("normal(0, .5)", class="b", coef="x"), set_prior("exponential(1)", class="sd"))
sensitive <- fit_case(formulas$crossed, train, sensitive_prior, cfg, "crossed-prior-sensitivity")
sensitivity <- rbind(data.frame(prior="normal(0,1)", beta=as.data.frame(fits$crossed)$b_x),
  data.frame(prior="normal(0,.5)", beta=as.data.frame(sensitive)$b_x))
write.csv(aggregate(beta ~ prior, sensitivity, function(x) c(mean=mean(x), quantile(x,c(.05,.95)))),
  file.path(cfg$out,"prior-sensitivity.csv"), row.names=FALSE)
write.csv(do.call(rbind, effects), file.path(cfg$out, "condition-effects.csv"), row.names = FALSE)
write.csv(do.call(rbind, scores), file.path(cfg$out, "holdout-scores.csv"), row.names = FALSE)
write.csv(do.call(rbind, predictions), file.path(cfg$out, "predictive-intervals.csv"), row.names = FALSE)
pp <- pp_check(fits$crossed, type = "stat_grouped", group = "item", stat = "mean", ndraws = 100)
ggplot2::ggsave(file.path(cfg$out, "item-ppc.png"), pp, width = 8, height = 5)
png(file.path(cfg$out, "participant-observed.png"), width = 1000, height = 650)
with(aggregate(correct ~ participant + x, train, mean),
     boxplot(correct ~ x, ylab = "Participant accuracy", xlab = "Condition (-.5, +.5)"))
dev.off()
writeLines(c(
  "# Analysis record (synthetic data)",
  paste("Mode:", if (cfg$smoke) "SMOKE ONLY: no statistical conclusion" else "full; computational stopping rules passed"),
  "Question: how does condition relate to accuracy, and whom can this model predict?",
  "Estimand: b_x is a conditional log odds contrast (+.5 minus -.5), not a probability difference.",
  "All three models use the same training rows. Their coefficients condition on different group structures; logistic non-collapsibility prevents interpreting every coefficient change as bias.",
  "See condition-effects.csv for magnitude and interval; predictive-intervals.csv for expected versus replicated cohort rates.",
  "Four holdout targets use only training outcomes. The new_new test has neither person nor item in training.",
  "holdout-scores.csv contains pointwise marginal predictive scores, not a joint score for a whole new group.",
  "This single split has no repeated-CV uncertainty estimate and establishes no model ranking across populations.",
  "PPC and prior sensitivity must be interpreted by the learner before a substantive report is signed.",
  "Limits: synthetic, normal random intercepts, constant slope, no visit/carryover effect, no missingness.",
  "A probability difference must be computed on a declared target population; an odds contrast cannot be substituted.",
  "Complete starter/report.md with claim, numeric evidence, scope and unresolved problems."
), file.path(cfg$out, "analysis-record.md"))
