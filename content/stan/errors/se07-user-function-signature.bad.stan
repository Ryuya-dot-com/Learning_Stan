functions {
  real add_shift(real x, real shift) {
    return x + shift;
  }
}
data {
  vector[2] x;
}
transformed data {
  vector[2] shifted = add_shift(x, 1.0);
}
