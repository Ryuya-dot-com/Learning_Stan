// INTENTIONALLY WRONG FOR THIS SCENARIO.
// The bounds validate the input, but this likelihood omits the
// parameter-dependent truncation normalizer. Compare it with
// truncated-normal.stan; do not use this as the recommended model.
data {
  int<lower=1> N;
  real lower_bound;
  real upper_bound;
  vector<lower=lower_bound, upper=upper_bound>[N] y;
}
transformed data {
  if (lower_bound >= upper_bound) {
    reject("lower_bound must be smaller than upper_bound");
  }
}
parameters {
  real mu;
  real<lower=0> sigma;
}
model {
  mu ~ normal(0, 2);
  sigma ~ exponential(1);
  y ~ normal(mu, sigma);
}
