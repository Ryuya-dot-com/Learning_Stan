# Closed-form Gaussian example: no MCMC needed to demonstrate nonidentification.
out <- Sys.getenv("LEARNING_STAN_OUTPUT", "outputs/identifiability")
if (dir.exists(out) && length(list.files(out))) stop("Choose an empty output directory")
dir.create(out, recursive = TRUE, showWarnings = FALSE)
set.seed(20260922)
y <- rnorm(100, 2, 1)
# Only alpha + beta occurs in the likelihood; separate values are not identified.
X <- matrix(1, nrow = length(y), ncol = 2)
results <- do.call(rbind, lapply(c(.2, 1, 5), function(tau) {
  V <- solve(crossprod(X) + diag(c(1 / tau^2, 1)))
  m <- V %*% crossprod(X, y)
  data.frame(prior_sd_alpha = tau, alpha = m[1], beta = m[2], sum = sum(m),
    sd_alpha = sqrt(V[1,1]), sd_beta = sqrt(V[2,2]), sd_sum = sqrt(sum(V)))
}))
write.csv(results, file.path(out, "prior-sensitivity.csv"), row.names = FALSE)
d <- expand.grid(person = factor(1:8), item = factor(1:8), condition = c(-.5, .5))
rank_row <- function(name, z) {
  design <- model.matrix(~ condition + person + item, z)
  data.frame(design = name, n = nrow(z), rank = qr(design)$rank, columns = ncol(design))
}
by_person <- subset(d, condition == ifelse(as.integer(person) %% 2 == 0, .5, -.5))
by_item <- subset(d, condition == ifelse(as.integer(item) %% 2 == 0, .5, -.5))
write.csv(rbind(rank_row("crossed", d), rank_row("condition_fixed_by_person", by_person),
  rank_row("condition_fixed_by_item", by_item)), file.path(out, "design-rank.csv"), row.names = FALSE)
writeLines(c("In the Gaussian example only alpha+beta is learned from the likelihood.",
  "Changing the prior allocation changes individual parameters even with an exactly calculated posterior.",
  "Rank deficiency here concerns unrestricted fixed person/item intercepts.",
  "A randomized between-person experiment can identify a population condition effect under its design and exchangeability assumptions; it cannot identify each person's within-person contrast from one condition.",
  "Many trials in a few groups do not replace independent groups for estimating a population variance.",
  "Good R-hat, small posterior intervals and proper priors do not establish likelihood identification."),
  file.path(out, "interpretation.txt"))
