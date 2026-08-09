data {
  int<lower=1> N;
  vector[N] y;
}
transformed data {
  vector[N] y_copy = y;
}
