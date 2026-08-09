data {
  int<lower=1> N;
  int<lower=1> J;
  array[N] int<lower=1, upper=J> group;
  vector[N] y;
}
parameters {
  real mu;
  real<lower=0> tau;
  vector[J] theta;
}
model {
  mu ~ normal(0, 2);
  tau ~ normal(0, 1);
  theta ~ normal(mu, tau);
  y ~ normal(theta[group], 1);
}
