data {
  int<lower=1> N;
  vector[N] y;
}
parameters {
  real mu;
  real log_sigma;
}
transformed parameters {
  real<lower=0> sigma = exp(log_sigma);
  jacobian += log_sigma;
}
model {
  mu ~ normal(0, 2);
  target += lognormal_lpdf(sigma | 0, 1);
  y ~ normal(mu, sigma);
}
