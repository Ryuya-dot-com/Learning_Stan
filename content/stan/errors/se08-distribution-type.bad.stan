data {
  int<lower=1> N;
  vector<lower=0, upper=1>[N] y;
}
parameters {
  real<lower=0, upper=1> p;
}
model {
  p ~ beta(2, 2);
  y ~ bernoulli(p);
}
