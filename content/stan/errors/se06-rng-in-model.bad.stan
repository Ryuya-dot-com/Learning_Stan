parameters {
  real mu;
}
model {
  real simulated;
  mu ~ normal(0, 1);
  simulated = normal_rng(mu, 1);
}
