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
  y ~ normal(mu, sigma) T[lower_bound, upper_bound];
}
generated quantities {
  real truncation_log_normalizer = log_diff_exp(
    normal_lcdf(upper_bound | mu, sigma),
    normal_lcdf(lower_bound | mu, sigma)
  );
  real lower_probability = normal_cdf(lower_bound | mu, sigma);
  real upper_probability = normal_cdf(upper_bound | mu, sigma);
  vector[N] y_rep;
  for (n in 1:N) {
    real probability = uniform_rng(lower_probability, upper_probability);
    y_rep[n] = mu + sigma * inv_Phi(
      fmin(1 - 1e-12, fmax(1e-12, probability))
    );
  }
}
