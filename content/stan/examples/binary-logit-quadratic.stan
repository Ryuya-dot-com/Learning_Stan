data {
  int<lower=1> N;
  vector[N] x;
  array[N] int<lower=0, upper=1> y;
}

parameters {
  real alpha;
  real beta_linear;
  real beta_square;
}

transformed parameters {
  vector[N] eta = alpha + beta_linear * x + beta_square * square(x);
}

model {
  alpha ~ normal(0, 1.5);
  beta_linear ~ normal(0, 1);
  beta_square ~ normal(0, 1);
  y ~ bernoulli_logit(eta);
}

generated quantities {
  vector[N] log_lik;
  array[N] int y_rep;

  for (n in 1:N) {
    log_lik[n] = bernoulli_logit_lpmf(y[n] | eta[n]);
    y_rep[n] = bernoulli_logit_rng(eta[n]);
  }
}
