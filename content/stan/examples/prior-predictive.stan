data {
  int<lower=1> N;
  real prior_location;
  real<lower=0> prior_scale;
  real<lower=0> sigma_rate;
}
generated quantities {
  real mu_sim = normal_rng(prior_location, prior_scale);
  real<lower=0> sigma_sim = exponential_rng(sigma_rate);
  array[N] real y_sim;
  for (n in 1:N) {
    y_sim[n] = normal_rng(mu_sim, sigma_sim);
  }
}
