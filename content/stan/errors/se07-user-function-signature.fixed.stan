functions {
  vector add_shift(vector x, real shift) {
    return x + rep_vector(shift, rows(x));
  }
}
data {
  vector[2] x;
}
transformed data {
  vector[2] shifted = add_shift(x, 1.0);
}
