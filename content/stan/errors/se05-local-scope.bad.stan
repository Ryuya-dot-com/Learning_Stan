data {
  real y;
  real shift;
}
parameters {
  real mu;
}
model {
  {
    real shifted_y = y + shift;
  }
  mu ~ normal(0, 1);
  shifted_y ~ normal(mu, 1);
}
