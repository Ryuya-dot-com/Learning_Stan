source("common.R"); source("data.R")
library(brms)
cfg <- setup_run("design")
# Fixed generating parameters: this is a design simulation, NOT SBC.
plans <- data.frame(P = c(16, 32, 16, 16, 16), I = c(12,12,24,12,12),
  repeats = c(2,2,2,4,2), missing = c(0,0,0,0,.25), imbalance = c(0,0,0,0,.7))
B <- as.integer(Sys.getenv("DESIGN_REPS", if (cfg$smoke) "2" else "50"))
stopifnot(!is.na(B), B >= 2)
write.csv(plans, file.path(cfg$out, "plans.csv"), row.names=FALSE)
rows <- list()
for (j in seq_len(nrow(plans))) for (r in seq_len(B)) {
  d <- simulate_trials(plans$P[j], plans$I[j], plans$repeats[j], beta=.6, seed=10000*j+r)
  # MAR/MCAR-like deletion uses the observed condition, not latent correctness.
  keep <- runif(nrow(d)) > plans$missing[j]
  keep <- keep & !(d$x == .5 & runif(nrow(d)) < plans$imbalance[j])
  d <- d[keep, ]
  name <- paste0("plan", j, "-rep", r)
  result <- tryCatch({
    f <- fit_case(correct ~ 0 + Intercept + x + (1|participant) + (1|item), d,
      c(set_prior("normal(0,1.5)", class="b",coef="Intercept"),
        set_prior("normal(0,1)",class="b",coef="x"), set_prior("exponential(1)",class="sd")), cfg, name)
    b <- as.data.frame(f)$b_x; ci <- quantile(b, c(.05,.95))
    data.frame(plan=j, rep=r, n=nrow(d), status="ok", error=mean(b)-.6,
      width=diff(ci), covered=ci[1] <= .6 & .6 <= ci[2], reason="")
  }, error=function(e) data.frame(plan=j,rep=r,n=nrow(d),status="failed",error=NA,
    width=NA,covered=NA,reason=conditionMessage(e)))
  result$mode <- if (cfg$smoke) "smoke_only" else "full"
  rows[[length(rows)+1L]] <- result
  write.csv(do.call(rbind, rows), file.path(cfg$out,"replications.csv"),row.names=FALSE)
}
all <- do.call(rbind,rows)
summary <- do.call(rbind,lapply(split(all,all$plan),function(z) {
  ok <- subset(z,status=="ok"); n <- nrow(ok); coverage <- mean(ok$covered)
  data.frame(plan=z$plan[1], attempted=nrow(z), failed=sum(z$status!="ok"), bias=mean(ok$error),
    bias_mcse=sd(ok$error)/sqrt(n), mean_width=mean(ok$width), coverage=coverage,
    coverage_mcse=sqrt(coverage*(1-coverage)/n))
}))
summary$mode <- if (cfg$smoke) "smoke_only" else "full"
write.csv(summary,file.path(cfg$out,"design-summary.csv"),row.names=FALSE)
writeLines(c("Fixed truth beta=.6; 90% intervals; normal random intercepts.",
 "Design summaries are conditional on successful diagnostics; report failures alongside them.",
 "MCSE at coverage 0 or 1 is unstable; use more replications and a binomial interval.",
 "50 repetitions are a teaching default, not an adequate precision guarantee.",
 "Smoke runs test execution only. SBC would draw parameters from the prior each repetition and assess ranks with autocorrelation accounted for.",
 "Good recovery here does not validate a real observation model."),file.path(cfg$out,"scope.txt"))
if (any(all$status != "ok")) stop("Some replications failed; inspect replications.csv; do not omit failures")
