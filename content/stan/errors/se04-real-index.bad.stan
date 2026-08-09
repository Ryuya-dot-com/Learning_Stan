data {
  int<lower=1> N;
  vector[N] y;
  real chosen_index;
}
transformed data {
  real chosen = y[chosen_index];
}
