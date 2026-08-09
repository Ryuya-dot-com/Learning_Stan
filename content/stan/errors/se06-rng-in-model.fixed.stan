parameters {
  real mu;
}
model {
  mu ~ normal(0, 1);
}
generated quantities {
  real simulated = normal_rng(mu, 1);
}
