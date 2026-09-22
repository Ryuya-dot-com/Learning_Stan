# Shared by observation.R and the detailed sensitivity experiment.
measurement_data <- function() {
  set.seed(20260923)
  x <- rnorm(160)
  data.frame(y = rnorm(160, .8*x, .6), xobs = x + rnorm(160, 0, .7), se = .7)
}

measurement_parameters <- c("alpha", "beta", "mu_x", "sigma_x", "sigma_y")

fit_measurement <- function(model, data, cfg, name, beta_prior_sd=1,
                            sigma_y_prior_rate=1, seed=20260922) {
  input <- list(N=nrow(data), y=data$y, xobs=data$xobs, se=data$se,
    beta_prior_sd=beta_prior_sd, sigma_y_prior_rate=sigma_y_prior_rate)
  stopifnot(!anyNA(data), all(data$se > 0), beta_prior_sd > 0, sigma_y_prior_rate > 0)
  cmdstanr::write_stan_json(input, file.path(cfg$out, paste0(name, "-data.json")))
  fit <- model$sample(data=input, chains=cfg$chains, parallel_chains=min(2L, cfg$chains),
    iter_warmup=if(cfg$smoke) 200L else 2000L,
    iter_sampling=if(cfg$smoke) 200L else 4000L,
    seed=seed, adapt_delta=.99, max_treedepth=12, refresh=if(cfg$smoke) 0L else 1000L,
    sig_figs=16,
    output_dir=cfg$out, output_basename=name)
  fit$save_object(file=file.path(cfg$out, paste0(name, ".rds")))
  diagnostics <- fit$summary(c("lp__", measurement_parameters, "log_lik_sum"))
  sampler <- fit$diagnostic_summary()
  write.csv(diagnostics, file.path(cfg$out, paste0(name, "-diagnostics.csv")), row.names=FALSE)
  write.csv(sampler, file.path(cfg$out, paste0(name, "-sampler.csv")), row.names=FALSE)
  ok <- all(is.finite(diagnostics$rhat) & diagnostics$rhat < 1.01 &
    diagnostics$ess_bulk >= 400 & diagnostics$ess_tail >= 400) &&
    all(sampler$num_divergent == 0 & sampler$num_max_treedepth == 0 & sampler$ebfmi >= .3)
  ok <- isTRUE(ok)
  writeLines(if(cfg$smoke) "SMOKE_ONLY" else if(ok) "PASS" else "STOP: diagnose before interpreting",
    file.path(cfg$out, paste0(name, "-status.txt")))
  if(!cfg$smoke && !isTRUE(ok)) stop(structure(list(
    message=paste0(name, ": diagnostic stopping rule triggered; artifacts preserved"), call=NULL),
    class=c("stan_diagnostic_stop", "error", "condition")))
  fit
}

# Independent check: numerical integration of the original latent-variable likelihood.
# The Stan generated quantity calls the SAME density function used in its model block.
verify_measurement_likelihood <- function(model, out) {
  cases <- data.frame(alpha=c(.2,-.3,0), beta=c(.8,-1.2,0), mu_x=c(-.1,.2,.3),
    sigma_x=c(1,.7,1.3), sigma_y=c(.6,.08,.4))
  dat <- list(N=3L, y=c(-.4,.1,.7), xobs=c(-.8,.2,1.1), se=c(.35,.7,.875),
    beta_prior_sd=1, sigma_y_prior_rate=1)
  results <- lapply(seq_len(nrow(cases)), function(j) {
    p <- as.list(cases[j,])
    fit <- model$sample(data=dat, chains=1, parallel_chains=1,
      iter_warmup=0, iter_sampling=1, fixed_param=TRUE, init=list(p),
      seed=20260922, sig_figs=16, refresh=0, output_dir=out,
      output_basename=paste0("likelihood-check-",j))
    expected <- sum(vapply(seq_len(dat$N), function(i) {
      integral <- integrate(function(x) dnorm(x,p$mu_x,p$sigma_x) *
        dnorm(dat$xobs[i],x,dat$se[i]) * dnorm(dat$y[i],p$alpha+p$beta*x,p$sigma_y),
        -Inf, Inf, rel.tol=1e-10, abs.tol=1e-12)
      log(integral$value)
    }, numeric(1)))
    actual <- as.numeric(fit$draws("log_lik_sum",format="matrix"))
    data.frame(case=j, integrated_log_lik=expected, stan_log_lik=actual,
      absolute_error=abs(expected-actual))
  })
  results <- do.call(rbind,results)
  write.csv(results,file.path(out,"likelihood-equivalence.csv"),row.names=FALSE)
  stopifnot(all(is.finite(results$absolute_error)), all(results$absolute_error < 1e-8))
  invisible(results)
}

plot_measurement_sensitivity <- function(results,out,smoke=FALSE) {
  png(file.path(out,"measurement-sensitivity.png"),width=1400,height=850,res=140)
  par(mfrow=c(1,2),mar=c(4.5,4.5,3,1))
  primary <- subset(results,kind=="sd")
  plot(primary$scale,primary$mean,type="b",ylim=range(results$low,results$high,.8),
    xlab="Assumed measurement SD / 0.7",ylab="Latent predictor slope (90% interval)",
    main=if(smoke) "SD assumptions (SMOKE ONLY)" else "SD assumptions")
  arrows(primary$scale,primary$low,primary$scale,primary$high,angle=90,code=3,length=.05)
  abline(h=.8,lty=2,col="gray40")
  par(mar=c(4.5,7,3,1))
  z <- subset(results,scale==1.25)
  labels <- paste0("N(0,",z$beta_prior_sd,"); Exp(",z$sigma_y_prior_rate,")")
  plot(z$mean,seq_len(nrow(z)),yaxt="n",xlim=range(z$low,z$high,.8),
    ylim=c(.5,nrow(z)+.5),xlab="Slope (90% interval)",ylab="",
    main=if(smoke) "Priors (SMOKE ONLY)" else "Priors at SD x 1.25")
  arrows(z$low,seq_len(nrow(z)),z$high,seq_len(nrow(z)),angle=90,code=3,length=.05)
  axis(2,at=seq_len(nrow(z)),labels=labels,las=1,cex.axis=.8)
  abline(v=.8,lty=2,col="gray40")
  mtext("beta prior; sigma_y prior (rate)",side=1,line=3.4,cex=.7)
  dev.off()
}
