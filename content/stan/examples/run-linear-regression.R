library(cmdstanr)

study <- data.frame(
  x = 1:8,
  y = c(-0.7, 0.1, 0.4, 1.4, 2.1, 2.5, 3.4, 3.7)
)

stan_data <- list(
  N = nrow(study),
  x = study$x,
  y = study$y
)

source_file <- file.path("content", "stan", "examples", "linear-regression.stan")
temporary_stan_file <- file.path(tempdir(), "learning-stan-linear-regression.stan")
file.copy(source_file, temporary_stan_file, overwrite = TRUE)

model <- cmdstan_model(temporary_stan_file, compile = FALSE)
model$check_syntax()
model$compile()

physical_cores <- parallel::detectCores(logical = FALSE)
parallel_chains <- if (is.na(physical_cores)) 1L else max(1L, min(4L, physical_cores))

fit <- model$sample(
  data = stan_data,
  seed = 20260801,
  chains = 4,
  parallel_chains = parallel_chains,
  iter_warmup = 1000,
  iter_sampling = 1000,
  refresh = 500
)

print(fit$summary(c("alpha", "beta", "sigma")))
print(fit$diagnostic_summary())

y_rep <- fit$draws("y_rep", format = "matrix")
print(rbind(observed = study$y, predicted_mean = colMeans(y_rep)))
