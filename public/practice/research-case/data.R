simulate_trials <- function(participants = 24L, items = 16L, repeats = 2L,
                            beta = .6, seed = 20260922) {
  stopifnot(participants >= 8, items >= 8, repeats >= 2)
  set.seed(seed)
  d <- expand.grid(p = seq_len(participants), i = seq_len(items), visit = seq_len(repeats))
  d$x <- ifelse((d$p + d$i + d$visit) %% 2 == 0, -.5, .5)
  a <- rnorm(participants, 0, .7); b <- rnorm(items, 0, .5)
  d$participant <- sprintf("p%03d", d$p); d$item <- sprintf("i%03d", d$i)
  d$correct <- rbinom(nrow(d), 1, plogis(.4 + beta * d$x + a[d$p] + b[d$i]))
  d$row_id <- seq_len(nrow(d))
  d
}

split_trials <- function(d) {
  # All reactions from held-out people/items are excluded from training.
  new_p <- d$p > floor(.8 * max(d$p)); new_i <- d$i > floor(.8 * max(d$i))
  d$split <- ifelse(new_p & new_i, "new_new", ifelse(new_p, "new_existing",
    ifelse(new_i, "existing_new", ifelse(d$visit == 2 & (d$p + d$i) %% 3 == 0,
      "existing_existing", "train"))))
  d
}
