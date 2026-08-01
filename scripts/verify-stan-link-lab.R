source(file.path("content", "stan", "examples", "simulate-link-functions.R"), local = TRUE)

source_file <- file.path("content", "stan", "examples", "simulate-link-functions.R")
source_md5_before <- tools::md5sum(source_file)
verification_dir <- tempfile("learning-stan-link-lab-")
dir.create(verification_dir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(verification_dir, recursive = TRUE, force = TRUE), add = TRUE)

result <- run_link_function_lab(verification_dir)
expected_files <- c(
  "link-function-summary.csv",
  "logit-baseline-effects.csv",
  "01-binary-inverse-links.png",
  "02-logit-coefficient-baseline.png",
  "03-poisson-log-exposure.png"
)
expected_paths <- file.path(verification_dir, expected_files)
if (!all(file.exists(expected_paths))) {
  stop("The link-function lab did not generate the complete five-file artifact contract")
}
if (any(file.info(expected_paths[grepl("[.]png$", expected_paths)])$size < 8000)) {
  stop("A link-function visualization is unexpectedly small")
}

summary <- read.csv(file.path(verification_dir, "link-function-summary.csv"))
lookup <- function(eta, link) {
  row <- summary[summary$eta == eta & summary$link == link, ]
  if (nrow(row) != 1L) stop("A benchmark eta/link pair is missing")
  row$inverse_link[[1]]
}
if (
  abs(lookup(0, "logit") - 0.5) > 1e-12 ||
  abs(lookup(0, "probit") - 0.5) > 1e-12 ||
  abs(lookup(0, "cloglog") - (1 - exp(-1))) > 1e-12
) {
  stop("The inverse-link benchmark values do not match their definitions")
}
for (link in c("logit", "probit", "cloglog")) {
  values <- summary$inverse_link[summary$link == link]
  if (!all(diff(values) > 0) || any(values <= 0 | values >= 1)) {
    stop("An inverse link is not strictly increasing inside the probability interval")
  }
}

baseline <- read.csv(file.path(verification_dir, "logit-baseline-effects.csv"))
if (
  length(unique(round(baseline$probability_change, 10))) != 3L ||
  baseline$probability_change[baseline$alpha == 0] <=
    max(baseline$probability_change[baseline$alpha != 0])
) {
  stop("The logit coefficient example does not demonstrate baseline-dependent probability changes")
}

source_md5_after <- tools::md5sum(source_file)
if (!identical(unname(source_md5_before), unname(source_md5_after))) {
  stop("The link-function lab modified its source file")
}

message(
  "Stan link-function lab: PASS (5 artifacts, logit/probit/cloglog benchmarks, ",
  "baseline-dependent probability effects, source unchanged)"
)
