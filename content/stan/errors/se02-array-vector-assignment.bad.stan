data {
  int<lower=1> N;
  vector[N] y;
}
transformed data {
  array[N] real y_copy = y;
}
