data {
  matrix[2, 2] design;
  vector[2] coefficient;
}
transformed data {
  vector[2] prediction = design * coefficient;
}
