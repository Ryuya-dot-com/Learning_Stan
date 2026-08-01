run_link_function_lab <- function(output_dir, seed = 20260802L) {
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  set.seed(seed)

  eta <- seq(-4, 4, length.out = 401L)
  link_curves <- data.frame(
    eta = eta,
    logit = plogis(eta),
    probit = pnorm(eta),
    cloglog = -expm1(-exp(eta)),
    stringsAsFactors = FALSE
  )

  benchmark_eta <- c(-2, 0, 2)
  link_summary <- data.frame(
    eta = rep(benchmark_eta, each = 3L),
    link = rep(c("logit", "probit", "cloglog"), times = length(benchmark_eta)),
    inverse_link = c(
      plogis(-2), pnorm(-2), -expm1(-exp(-2)),
      plogis(0), pnorm(0), -expm1(-exp(0)),
      plogis(2), pnorm(2), -expm1(-exp(2))
    ),
    stringsAsFactors = FALSE
  )
  write.csv(
    link_summary,
    file.path(output_dir, "link-function-summary.csv"),
    row.names = FALSE
  )

  colors <- c(logit = "#2563eb", probit = "#7c3aed", cloglog = "#dc2626")
  png(file.path(output_dir, "01-binary-inverse-links.png"), width = 1200, height = 760, res = 120)
  matplot(
    link_curves$eta,
    as.matrix(link_curves[c("logit", "probit", "cloglog")]),
    type = "l",
    lty = 1,
    lwd = 3,
    col = unname(colors),
    xlab = expression(eta == alpha + x^T * beta),
    ylab = "Pr(y = 1)",
    main = "Inverse links map the real line to probability"
  )
  abline(h = 0.5, v = 0, lty = 3, col = "#64748b")
  legend("topleft", legend = names(colors), col = unname(colors), lwd = 3, bty = "n")
  dev.off()

  baseline <- data.frame(alpha = c(-2, 0, 2), stringsAsFactors = FALSE)
  baseline$p_x0 <- plogis(baseline$alpha)
  baseline$p_x1 <- plogis(baseline$alpha + 1)
  baseline$probability_change <- baseline$p_x1 - baseline$p_x0
  write.csv(
    baseline,
    file.path(output_dir, "logit-baseline-effects.csv"),
    row.names = FALSE
  )

  png(file.path(output_dir, "02-logit-coefficient-baseline.png"), width = 1200, height = 760, res = 120)
  plot(
    c(0, 1),
    c(0, 1),
    type = "n",
    xaxt = "n",
    xlab = "predictor change",
    ylab = "Pr(y = 1)",
    main = "The same log-odds coefficient gives different probability changes"
  )
  axis(1, at = c(0, 1), labels = c("x = 0", "x = 1"))
  segments(
    0,
    baseline$p_x0,
    1,
    baseline$p_x1,
    lwd = 4,
    col = c("#16a34a", "#2563eb", "#dc2626")
  )
  points(rep(0, 3), baseline$p_x0, pch = 19, cex = 1.4, col = c("#16a34a", "#2563eb", "#dc2626"))
  points(rep(1, 3), baseline$p_x1, pch = 19, cex = 1.4, col = c("#16a34a", "#2563eb", "#dc2626"))
  legend(
    "topleft",
    legend = paste("alpha =", baseline$alpha),
    col = c("#16a34a", "#2563eb", "#dc2626"),
    lwd = 4,
    bty = "o",
    bg = "white"
  )
  dev.off()

  count_x <- seq(-2, 2, length.out = 201L)
  exposures <- c(0.5, 1, 2)
  expected_count <- outer(
    count_x,
    exposures,
    function(value, exposure) exposure * exp(0.2 + 0.6 * value)
  )
  colnames(expected_count) <- paste0("exposure_", exposures)

  png(file.path(output_dir, "03-poisson-log-exposure.png"), width = 1200, height = 760, res = 120)
  matplot(
    count_x,
    expected_count,
    type = "l",
    lty = 1,
    lwd = 3,
    col = c("#16a34a", "#2563eb", "#dc2626"),
    xlab = "x",
    ylab = "expected count",
    main = "Poisson log link with a log(exposure) offset"
  )
  legend(
    "topleft",
    legend = paste("exposure =", exposures),
    col = c("#16a34a", "#2563eb", "#dc2626"),
    lwd = 3,
    bty = "n"
  )
  dev.off()

  invisible(list(
    summary = link_summary,
    baseline = baseline,
    generated = c(
      "link-function-summary.csv",
      "logit-baseline-effects.csv",
      "01-binary-inverse-links.png",
      "02-logit-coefficient-baseline.png",
      "03-poisson-log-exposure.png"
    )
  ))
}

if (sys.nframe() == 0L) {
  args <- commandArgs(trailingOnly = TRUE)
  output_dir <- if (length(args) >= 1L) args[[1]] else file.path("outputs", "stan-link-lab")
  result <- run_link_function_lab(output_dir)
  message("Link-function lab: PASS (", length(result$generated), " artifacts in ", output_dir, ")")
}
