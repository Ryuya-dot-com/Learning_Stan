data {
  int<lower=1> N;
  vector[N] x;
  array[N] int<lower=0,upper=1> y;
  int<lower=1> K;
  vector[K] x_new;
}
parameters {
  real alpha;
  real beta;
}
model {
  alpha ~ normal(0, 1.5);
  beta ~ normal(0, 1);
  y ~ bernoulli_logit(alpha + beta * x);
}
generated quantities {
  vector[K] p;
  array[K] int y_rep;
  for (k in 1:K) {
    p[k] = inv_logit(alpha + beta * x_new[k]);
    y_rep[k] = bernoulli_rng(p[k]);
  }
}
