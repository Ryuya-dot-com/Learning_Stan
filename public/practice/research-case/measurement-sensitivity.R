source("common.R")
source("measurement.R")
library(brms)
cfg <- setup_run("measurement-sensitivity")
d <- measurement_data()
write.csv(d,file.path(cfg$out,"measurement-data.csv"),row.names=FALSE)
model <- cmdstanr::cmdstan_model("models/measurement-error-marginal.stan",dir=cfg$out)
verify_measurement_likelihood(model,cfg$out)

# Predeclared SD grid; additional priors vary ONE factor at a time at 1 and 1.25.
plan <- data.frame(scale=c(.5,.75,1,1.1,1.25,1.5), beta_prior_sd=1,
  sigma_y_prior_rate=1, kind="sd")
for(scale in c(1,1.25)) {
  plan <- rbind(plan,
    data.frame(scale=scale,beta_prior_sd=c(.5,2),sigma_y_prior_rate=1,kind="beta_prior"),
    data.frame(scale=scale,beta_prior_sd=1,sigma_y_prior_rate=c(.5,2),kind="sigma_prior"))
}
plan$id <- sprintf("case%02d",seq_len(nrow(plan)))
write.csv(plan,file.path(cfg$out,"sensitivity-plan.csv"),row.names=FALSE)
observed <- c(mean(d$xobs),mean(d$y),sd(d$xobs),sd(d$y),cov(d$xobs,d$y))
stat_names <- c("mean_xobs","mean_y","sd_xobs","sd_y","cov_xobs_y")
moment_bound <- sqrt(var(d$xobs)-cov(d$xobs,d$y)^2/var(d$y))
write.csv(data.frame(statistic=c(stat_names,"moment_error_sd_boundary"),value=c(observed,moment_bound)),
  file.path(cfg$out,"observed-moments.csv"),row.names=FALSE)

fits <- list(); rows <- list(); ppcs <- list()
for(i in seq_len(nrow(plan))) {
  spec <- plan[i,]; dat <- d; dat$se <- .7*spec$scale
  row <- tryCatch({
    fit <- fit_measurement(model,dat,cfg,spec$id,spec$beta_prior_sd,spec$sigma_y_prior_rate)
    fits[[spec$id]] <- fit
    draws <- posterior::as_draws_matrix(fit$draws(measurement_parameters))
    b <- draws[,"beta"]; ci <- quantile(b,c(.05,.95))
    diag <- fit$summary(c("lp__",measurement_parameters,"log_lik_sum"))
    sampler <- fit$diagnostic_summary()
    replicated <- posterior::as_draws_matrix(fit$draws("ppc"))
    ppci <- intervals(replicated)
    ppcs[[spec$id]] <- data.frame(id=spec$id,statistic=stat_names,observed=observed,
      low=ppci[,1],median=ppci[,2],high=ppci[,3],
      upper_tail=colMeans(sweep(replicated,2,observed,">=")))
    data.frame(status=if(cfg$smoke) "SMOKE_ONLY" else "PASS",mean=mean(b),low=ci[1],high=ci[2],
      prob_positive=mean(b>0),mcse=fit$summary("beta","mcse_mean")$mcse_mean,
      sigma_y_median=median(draws[,"sigma_y"]),prob_sigma_y_below_0_1=mean(draws[,"sigma_y"]<.1),
      max_rhat=max(diag$rhat),min_ess_bulk=min(diag$ess_bulk),min_ess_tail=min(diag$ess_tail),
      divergences=sum(sampler$num_divergent),treedepth=sum(sampler$num_max_treedepth),
      min_ebfmi=min(sampler$ebfmi),reason="")
  },stan_diagnostic_stop=function(e) data.frame(status="STOP",mean=NA,low=NA,high=NA,
    prob_positive=NA,mcse=NA,sigma_y_median=NA,prob_sigma_y_below_0_1=NA,
    max_rhat=NA,min_ess_bulk=NA,min_ess_tail=NA,divergences=NA,treedepth=NA,min_ebfmi=NA,
    reason=conditionMessage(e)))
  rows[[spec$id]] <- cbind(spec,assumed_sd=.7*spec$scale,row)
  write.csv(do.call(rbind,rows),file.path(cfg$out,"sensitivity-results.csv"),row.names=FALSE)
  write.csv(do.call(rbind,ppcs),file.path(cfg$out,"ppc-summary.csv"),row.names=FALSE)
}
results <- do.call(rbind,rows)
if(any(results$status=="STOP")) {
  writeLines("INCOMPLETE_SENSITIVITY",file.path(cfg$out,"sensitivity-status.txt"))
  stop("Some sensitivity fits failed; results withheld. Inspect preserved diagnostics.")
}

# Fresh brms reference, unchanged likelihood and priors, with explicit latent x.
ref_cfg <- cfg
if(!cfg$smoke) { ref_cfg$iter <- 6000L; ref_cfg$warmup <- 2000L }
form <- bf(y ~ mi(xobs)) + bf(xobs | mi(se) ~ 1) + set_rescor(FALSE)
pr <- c(set_prior("normal(0,1)",class="b",resp="y"),
  set_prior("normal(0,1)",class="Intercept",resp="y"),
  set_prior("normal(0,1)",class="Intercept",resp="xobs"),
  set_prior("exponential(1)",class="sigma",resp="y"),
  set_prior("exponential(1)",class="sigma",resp="xobs"))
reference <- fit_case(form,d,pr,ref_cfg,"brms-reference",gaussian())
ref_vars <- c("b_y_Intercept","bsp_y_mixobs","b_xobs_Intercept","sigma_xobs","sigma_y")
br <- posterior::summarise_draws(posterior::as_draws_array(reference)[,,ref_vars,drop=FALSE],"mean","mcse_mean")
br <- br[match(ref_vars,br$variable),]
integrated <- fits[[plan$id[plan$scale==1 & plan$kind=="sd"]]]
sm <- integrated$summary(measurement_parameters,"mean","mcse_mean")
sm <- sm[match(measurement_parameters,sm$variable),]
equivalence <- data.frame(parameter=measurement_parameters,brms_mean=br$mean,
  marginal_mean=sm$mean,combined_mcse=sqrt(br$mcse_mean^2+sm$mcse_mean^2))
equivalence$difference <- equivalence$brms_mean-equivalence$marginal_mean
equivalence$within_mc_error <- abs(equivalence$difference) <= 4*equivalence$combined_mcse
write.csv(equivalence,file.path(cfg$out,"brms-equivalence.csv"),row.names=FALSE)

# Independent seed at the formerly failing SD, retaining all attempts.
repeat_data <- d; repeat_data$se <- .875
repeated <- fit_measurement(model,repeat_data,cfg,"sd1.25-independent-seed",seed=20261001)
first <- fits[[plan$id[plan$scale==1.25 & plan$kind=="sd"]]]
a <- first$summary(measurement_parameters,"mean","mcse_mean")
b <- repeated$summary(measurement_parameters,"mean","mcse_mean")
b <- b[match(a$variable,b$variable),]
repeat_check <- data.frame(parameter=a$variable,first_mean=a$mean,repeat_mean=b$mean,
  combined_mcse=sqrt(a$mcse_mean^2+b$mcse_mean^2))
repeat_check$within_mc_error <- abs(repeat_check$first_mean-repeat_check$repeat_mean) <= 4*repeat_check$combined_mcse
write.csv(repeat_check,file.path(cfg$out,"independent-seed-check.csv"),row.names=FALSE)

plot_measurement_sensitivity(results,cfg$out,cfg$smoke)
numerical_ok <- all(equivalence$within_mc_error) && all(repeat_check$within_mc_error)
status <- if(cfg$smoke) "SMOKE_ONLY" else if(numerical_ok) "PASS" else "STOP: numerical comparison failed"
writeLines(status,file.path(cfg$out,"sensitivity-status.txt"))
writeLines(c("Same synthetic observations for every sensitivity fit; generating beta=.8, error SD=.7.",
  "Only the assumed observation-error SD changes across the primary grid; priors are unchanged.",
  "Marginalization removes latent x from sampling, not from the scientific model.",
  "Additional prior fits vary beta prior SD or residual-SD prior rate, one at a time.",
  "Positive direction and magnitude sensitivity must be reported separately.",
  "A passed numerical check is not proof of identification, model adequacy or real-world validity.",
  "The sample-moment SD boundary ignores sampling uncertainty; it is a diagnostic clue, not a hard model constraint.",
  "PPC uses joint replicated xobs,y and checks means, SDs and covariance; it is not an exhaustive model check.",
  "This is not repeated-data bias/coverage analysis and not sensitivity to every latent distribution or error mechanism.",
  paste("Mode/status:",status)),file.path(cfg$out,"sensitivity-record.txt"))
if(!cfg$smoke && !numerical_ok) stop("Numerical cross-check failed; inspect both comparison CSV files")
