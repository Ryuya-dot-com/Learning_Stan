data {
  int<lower=1> N;
  vector[N] centered_load;
  vector<lower=0>[N] duration_seconds;
}
parameters {
  real alpha;
  real beta;
  real<lower=0> sigma;
}
transformed parameters {
  vector[N] mu_log = alpha + beta * centered_load;
}
model {
  alpha ~ normal(0, 1);
  beta ~ normal(0, 0.5);
  sigma ~ exponential(1);
  duration_seconds ~ lognormal(mu_log, sigma);
}
generated quantities {
  array[N] real log_lik;
  vector[N] y_rep;
  for (n in 1:N) {
    log_lik[n] = lognormal_lpdf(duration_seconds[n] | mu_log[n], sigma);
    y_rep[n] = lognormal_rng(mu_log[n], sigma);
  }
}
