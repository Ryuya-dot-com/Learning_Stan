data {
  int<lower=1> N;
  vector[N] x;
  vector<lower=0>[N] exposure;
  array[N] int<lower=0> y;
}

parameters {
  real alpha;
  real beta;
}

transformed parameters {
  vector[N] log_rate = log(exposure) + alpha + beta * x;
}

model {
  alpha ~ normal(0, 1.5);
  beta ~ normal(0, 1);
  y ~ poisson_log(log_rate);
}

generated quantities {
  vector[N] log_lik;
  array[N] int y_rep;

  for (n in 1:N) {
    log_lik[n] = poisson_log_lpmf(y[n] | log_rate[n]);
    y_rep[n] = poisson_log_rng(log_rate[n]);
  }
}
