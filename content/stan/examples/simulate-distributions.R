run_distribution_grammar_lab <- function(output_dir, seed = 20260802L) {
  stopifnot(length(output_dir) == 1L, nzchar(output_dir), length(seed) == 1L)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  set.seed(seed)

  normal_file <- file.path(output_dir, "01-normal-parameters.png")
  png(normal_file, width = 1200, height = 760, res = 120)
  x_normal <- seq(-7, 7, length.out = 800)
  normal_settings <- data.frame(
    mu = c(0, 2, 0, 0),
    sigma = c(1, 1, 0.5, 2),
    color = c("#2563eb", "#dc2626", "#16a34a", "#9333ea")
  )
  plot(
    x_normal,
    dnorm(x_normal, normal_settings$mu[1], normal_settings$sigma[1]),
    type = "l", lwd = 3, col = normal_settings$color[1],
    xlab = "y", ylab = "density", ylim = c(0, 0.82),
    main = "Normal(mu, sigma): location and scale"
  )
  for (index in 2:nrow(normal_settings)) {
    lines(
      x_normal,
      dnorm(x_normal, normal_settings$mu[index], normal_settings$sigma[index]),
      lwd = 3,
      col = normal_settings$color[index]
    )
  }
  legend(
    "topright",
    legend = sprintf("mu = %g, sigma = %g", normal_settings$mu, normal_settings$sigma),
    col = normal_settings$color,
    lwd = 3,
    bty = "n"
  )
  dev.off()

  beta_file <- file.path(output_dir, "02-beta-shapes.png")
  png(beta_file, width = 1200, height = 760, res = 120)
  x_beta <- seq(0.001, 0.999, length.out = 800)
  beta_settings <- data.frame(
    alpha = c(1, 2, 2, 8),
    beta = c(1, 2, 8, 2),
    color = c("#475569", "#2563eb", "#dc2626", "#16a34a")
  )
  plot(
    x_beta,
    dbeta(x_beta, beta_settings$alpha[1], beta_settings$beta[1]),
    type = "l", lwd = 3, col = beta_settings$color[1],
    xlab = "p", ylab = "density", ylim = c(0, 5.6),
    main = "Beta(alpha, beta): shape parameters"
  )
  for (index in 2:nrow(beta_settings)) {
    lines(
      x_beta,
      dbeta(x_beta, beta_settings$alpha[index], beta_settings$beta[index]),
      lwd = 3,
      col = beta_settings$color[index]
    )
  }
  legend(
    "topright",
    legend = sprintf("alpha = %g, beta = %g", beta_settings$alpha, beta_settings$beta),
    col = beta_settings$color,
    lwd = 3,
    bty = "n"
  )
  dev.off()

  prior_file <- file.path(output_dir, "03-prior-predictive.png")
  png(prior_file, width = 1200, height = 760, res = 120)
  prior_settings <- data.frame(
    label = c("narrow", "baseline", "wide"),
    tau = c(0.5, 2, 4),
    lambda = c(2, 1, 0.5),
    color = c("#16a34a", "#2563eb", "#dc2626")
  )
  prior_draws <- vector("list", nrow(prior_settings))
  for (index in seq_len(nrow(prior_settings))) {
    mu_sim <- rnorm(12000, mean = 0, sd = prior_settings$tau[index])
    sigma_sim <- rexp(12000, rate = prior_settings$lambda[index])
    prior_draws[[index]] <- rnorm(12000, mean = mu_sim, sd = sigma_sim)
  }
  prior_densities <- lapply(prior_draws, density, from = -15, to = 15, n = 800)
  plot(
    prior_densities[[1]],
    type = "l", lwd = 3, col = prior_settings$color[1],
    xlab = "prior predictive y_sim", ylab = "density", xlim = c(-15, 15),
    ylim = c(0, max(vapply(prior_densities, function(value) max(value$y), numeric(1))) * 1.05),
    main = "Prior predictive sensitivity"
  )
  for (index in 2:length(prior_densities)) {
    lines(prior_densities[[index]], lwd = 3, col = prior_settings$color[index])
  }
  legend(
    "topright",
    legend = sprintf(
      "%s: tau = %g, lambda = %g",
      prior_settings$label,
      prior_settings$tau,
      prior_settings$lambda
    ),
    col = prior_settings$color,
    lwd = 3,
    bty = "n"
  )
  dev.off()

  truncation_file <- file.path(output_dir, "04-truncation-vs-clamping.png")
  png(truncation_file, width = 1400, height = 760, res = 120)
  old_par <- par(mfrow = c(1, 2), mar = c(4.5, 4.5, 3.5, 1))
  lower_bound <- -0.5
  upper_bound <- 2
  raw_draws <- rnorm(30000)
  truncated_u <- runif(
    30000,
    min = pnorm(lower_bound),
    max = pnorm(upper_bound)
  )
  truncated_draws <- qnorm(truncated_u)
  clamped_draws <- pmin(pmax(raw_draws, lower_bound), upper_bound)
  histogram_breaks <- seq(lower_bound, upper_bound, length.out = 51)
  hist(
    truncated_draws,
    breaks = histogram_breaks,
    probability = TRUE,
    col = "#93c5fd", border = "white",
    xlab = "y", main = "Correctly truncated draws"
  )
  x_truncated <- seq(lower_bound, upper_bound, length.out = 500)
  normalizer <- pnorm(upper_bound) - pnorm(lower_bound)
  lines(x_truncated, dnorm(x_truncated) / normalizer, col = "#1d4ed8", lwd = 3)
  hist(
    clamped_draws,
    breaks = histogram_breaks,
    probability = TRUE,
    col = "#fca5a5", border = "white",
    xlab = "y", main = "Incorrect clamping at the bounds"
  )
  par(old_par)
  dev.off()

  normal_draws <- rnorm(50000, mean = 2, sd = 1.5)
  beta_draws <- rbeta(50000, shape1 = 2, shape2 = 8)
  truncated_mean_theory <- (
    dnorm(lower_bound) - dnorm(upper_bound)
  ) / normalizer
  truncated_variance_theory <- 1 + (
    lower_bound * dnorm(lower_bound) - upper_bound * dnorm(upper_bound)
  ) / normalizer - truncated_mean_theory^2

  summary_table <- data.frame(
    quantity = c(
      "normal_mean", "normal_sd", "beta_mean", "beta_variance",
      "truncated_mean", "truncated_sd"
    ),
    theoretical = c(
      2,
      1.5,
      2 / (2 + 8),
      (2 * 8) / (((2 + 8)^2) * (2 + 8 + 1)),
      truncated_mean_theory,
      sqrt(truncated_variance_theory)
    ),
    simulated = c(
      mean(normal_draws),
      sd(normal_draws),
      mean(beta_draws),
      var(beta_draws),
      mean(truncated_draws),
      sd(truncated_draws)
    )
  )
  summary_table$absolute_error <- abs(summary_table$simulated - summary_table$theoretical)
  write.csv(
    summary_table,
    file.path(output_dir, "simulation-summary.csv"),
    row.names = FALSE,
    fileEncoding = "UTF-8"
  )

  invisible(list(
    output_dir = normalizePath(output_dir, winslash = "/", mustWork = TRUE),
    summary = summary_table,
    files = c(normal_file, beta_file, prior_file, truncation_file)
  ))
}

if (sys.nframe() == 0L) {
  arguments <- commandArgs(trailingOnly = TRUE)
  output_dir <- if (length(arguments) >= 1L) {
    arguments[[1]]
  } else {
    file.path(tempdir(), "learning-stan-distribution-lab")
  }
  result <- run_distribution_grammar_lab(output_dir)
  print(result$summary, row.names = FALSE)
  message("Generated files: ", result$output_dir)
}
