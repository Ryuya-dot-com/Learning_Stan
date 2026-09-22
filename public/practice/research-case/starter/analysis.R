# Work from the project root. Complete the protocol before removing these stops.
source("common.R")
source("data.R")
dat <- split_trials(simulate_trials())
stop("TODO: inspect raw data, declare estimand and prediction target; do not mark completed from this scaffold")
# TODO: preserve raw data; select training rows without using held-out outcomes.
# TODO: define likelihood, priors, grouping effects and prior predictive checks.
# TODO: fit and save diagnostics; follow stopping rules.
# TODO: predict the declared target, check leakage and summarize uncertainty.
# TODO: compare one assumption at a time; complete report.md with numeric evidence.
