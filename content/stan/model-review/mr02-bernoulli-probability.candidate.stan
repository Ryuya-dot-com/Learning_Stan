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
  y ~ bernoulli(inv_logit(eta));
}
