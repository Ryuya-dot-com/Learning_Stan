functions {
  // Integrate x_true out of xobs ~ N(x_true,se), y ~ N(alpha+beta*x_true,sigma_y),
  // x_true ~ N(mu_x,sigma_x). The five parameter priors are unchanged from brms.
  real measurement_lpdf(real y, real xobs, real se, real alpha, real beta,
                        real mu_x, real sigma_x, real sigma_y) {
    real vx = square(sigma_x) + square(se);
    real conditional_x = mu_x + square(sigma_x) / vx * (xobs - mu_x);
    real conditional_y_sd = sqrt(square(sigma_y)
      + square(beta) * square(sigma_x) * square(se) / vx);
    return normal_lpdf(xobs | mu_x, sqrt(vx))
      + normal_lpdf(y | alpha + beta * conditional_x, conditional_y_sd);
  }
}
data {
  int<lower=2> N;
  vector[N] y;
  vector[N] xobs;
  vector<lower=0>[N] se;
  real<lower=0> beta_prior_sd;
  real<lower=0> sigma_y_prior_rate;
}
parameters {
  real alpha;
  real beta;
  real mu_x;
  real<lower=0> sigma_x;
  real<lower=0> sigma_y;
}
model {
  alpha ~ normal(0, 1);
  beta ~ normal(0, beta_prior_sd);
  mu_x ~ normal(0, 1);
  sigma_x ~ exponential(1);
  sigma_y ~ exponential(sigma_y_prior_rate);
  for (n in 1:N)
    target += measurement_lpdf(y[n] | xobs[n], se[n], alpha, beta, mu_x, sigma_x, sigma_y);
}
generated quantities {
  real log_lik_sum = 0;
  vector[5] ppc; // mean(xobs), mean(y), SD(xobs), SD(y), covariance(xobs,y)
  {
    vector[N] xr;
    vector[N] yr;
    for (n in 1:N) {
      real latent = normal_rng(mu_x, sigma_x);
      xr[n] = normal_rng(latent, se[n]);
      yr[n] = normal_rng(alpha + beta * latent, sigma_y);
      log_lik_sum += measurement_lpdf(y[n] | xobs[n], se[n], alpha, beta, mu_x, sigma_x, sigma_y);
    }
    ppc[1] = mean(xr);
    ppc[2] = mean(yr);
    ppc[3] = sd(xr);
    ppc[4] = sd(yr);
    ppc[5] = dot_product(xr - mean(xr), yr - mean(yr)) / (N - 1);
  }
}
