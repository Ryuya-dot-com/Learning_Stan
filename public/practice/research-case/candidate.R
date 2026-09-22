# INTENTIONALLY FLAWED review candidate; not the reference analysis.
# It compiles/runs when given a brmsfit, but its interpretation is wrong.
candidate_predict <- function(fit, newdata) {
  p <- brms::posterior_epred(fit, newdata = newdata, re_formula = NA)
  # Review: is this actually a new participant's response distribution?
  data.frame(newdata, lower = apply(p, 2, quantile, .05), upper = apply(p, 2, quantile, .95))
}
# Claims to review:
# 1. Setting the group effect to zero accounts for unknown people/items.
# 2. An expected-probability interval is an individual 0/1 predictive interval.
# 3. A high score on randomly withheld trials establishes new-person accuracy.
# For each: explain the wrong assumption, correct it, and state what changes in the report.
