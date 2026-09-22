source("data.R")
out <- Sys.getenv("LEARNING_STAN_OUTPUT", "outputs/transfer-data")
if (dir.exists(out) && length(list.files(out))) stop("Choose an empty output directory")
dir.create(out, recursive=TRUE, showWarnings=FALSE)
d <- simulate_trials(participants=30, items=18, beta=.35, seed=20261001)
# No true probabilities/group effects are supplied to the fitting task.
d <- d[c("row_id","participant","item","visit","x","correct")]
set.seed(20261002)
d$correct[runif(nrow(d)) < plogis(-2 + d$x)] <- NA_integer_
write.csv(d,file.path(out,"transfer-trials.csv"),row.names=FALSE,na="")
