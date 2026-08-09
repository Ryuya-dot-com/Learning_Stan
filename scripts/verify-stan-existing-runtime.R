source(
  file.path("content", "stan", "examples", "run-existing-runtime-revalidation.R"),
  local = TRUE
)

source_files <- file.path(find_revalidation_project_root(), runtime_source_files())
source_md5_before <- tools::md5sum(source_files)

verification_dir <- tempfile("learning-stan-existing-runtime-")
dir.create(verification_dir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(verification_dir, recursive = TRUE, force = TRUE), add = TRUE)

fresh_report <- run_existing_runtime_revalidation(verification_dir)
fresh_report_path <- file.path(verification_dir, "runtime-revalidation-report.json")
if (!file.exists(fresh_report_path)) {
  stop("The existing-runtime runner did not write its machine-readable report")
}
roundtrip_report <- jsonlite::read_json(fresh_report_path, simplifyVector = TRUE)
roundtrip_errors <- validate_existing_runtime_report(roundtrip_report, verification_dir)
if (length(roundtrip_errors) > 0L || !identical(roundtrip_report$status, "PASS")) {
  stop(paste(c("The fresh existing-runtime report is invalid", roundtrip_errors), collapse = "\n"))
}

evidence_path <- file.path("content", "stan", "runtime-revalidation.json")
if (!file.exists(evidence_path)) {
  stop("The saved existing-runtime revalidation evidence is missing")
}
saved_report <- jsonlite::read_json(evidence_path, simplifyVector = TRUE)
saved_errors <- validate_existing_runtime_report(saved_report)
if (length(saved_errors) > 0L || !identical(saved_report$status, "PASS")) {
  stop(paste(c("The saved existing-runtime report is invalid", saved_errors), collapse = "\n"))
}
if (!identical(saved_report$sourceHashes, fresh_report$sourceHashes)) {
  stop("The saved existing-runtime source hashes do not match the revalidated sources")
}
if (!all(unlist(saved_report$checks) == "PASS")) {
  stop("The saved existing-runtime report contains an incomplete check")
}

source_md5_after <- tools::md5sum(source_files)
if (!identical(unname(source_md5_before), unname(source_md5_after))) {
  stop("The isolated existing-runtime verification modified a teaching source file")
}

linear <- fresh_report$scenarios$linearRegression$parameterSummary
truncation <- fresh_report$scenarios$truncation$parameterSummary
comparison <- fresh_report$scenarios$linkLoo$modelComparison
message(sprintf(
  paste0(
    "Existing Stan runtime verification: PASS ",
    "(22 artifacts, linear max R-hat %.4f, truncation max R-hat %.4f, ",
    "linear-vs-quadratic ELPD %.3f +/- %.3f, source unchanged)"
  ),
  max(linear$rhat),
  max(truncation$rhat),
  comparison$elpd_diff[comparison$model == "linear"],
  comparison$se_diff[comparison$model == "linear"]
))
