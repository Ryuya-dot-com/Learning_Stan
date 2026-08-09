data {
  int<lower=1> N;
  vector[N] x;
  array[N] int<lower=0, upper=1> y;
}
parameters {
  real alpha;
  real beta;
}
transformed parameters {
  vector[N] eta = alpha + beta * x;
}
model {
  alpha ~ normal(0, 2);
  beta ~ normal(0, 1);
  y ~ bernoulli_logit(eta);
}
generated quantities {
  array[N] real log_lik;
  for (n in 1:N) {
    log_lik[n] = bernoulli_logit_lpmf(y | eta);
  }
}
