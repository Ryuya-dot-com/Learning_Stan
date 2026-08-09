data {
  int<lower=1> N;
  vector[N] y;
  int<lower=1, upper=N> chosen_index;
}
transformed data {
  real chosen = y[chosen_index];
}
