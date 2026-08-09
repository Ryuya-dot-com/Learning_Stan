required_exact <- c(
  cmdstanr = "0.9.0",
  loo = "2.10.1"
)
required_minimum <- c(
  openssl = "2.3.4"
)

stan_repository <- "https://stan-dev.r-universe.dev"
cran_repository <- Sys.getenv("RSPM", unset = "")
if (!nzchar(cran_repository)) {
  configured_cran <- unname(getOption("repos")["CRAN"])
  cran_repository <- if (
    length(configured_cran) == 1L && !is.na(configured_cran) &&
      nzchar(configured_cran) && configured_cran != "@CRAN@"
  ) configured_cran else "https://cloud.r-project.org"
}
repositories <- c(STAN = stan_repository, CRAN = cran_repository)

needs_exact_install <- vapply(names(required_exact), function(package) {
  !requireNamespace(package, quietly = TRUE) ||
    packageVersion(package) != package_version(required_exact[[package]])
}, logical(1))
needs_minimum_install <- vapply(names(required_minimum), function(package) {
  !requireNamespace(package, quietly = TRUE) ||
    packageVersion(package) < package_version(required_minimum[[package]])
}, logical(1))

if (any(needs_exact_install)) {
  install.packages(names(required_exact)[needs_exact_install], repos = repositories)
}
if (any(needs_minimum_install)) {
  install.packages(names(required_minimum)[needs_minimum_install], repos = repositories)
}

exact_versions <- vapply(
  names(required_exact),
  function(package) as.character(packageVersion(package)),
  character(1)
)
if (!identical(unname(exact_versions), unname(required_exact))) {
  stop(
    "Stan CI package versions do not match the fixed contract: ",
    paste(names(exact_versions), exact_versions, sep = "=", collapse = ", ")
  )
}
minimum_versions <- vapply(
  names(required_minimum),
  function(package) as.character(packageVersion(package)),
  character(1)
)
if (any(package_version(minimum_versions) < package_version(required_minimum))) {
  stop(
    "Stan CI package versions do not meet the minimum contract: ",
    paste(names(minimum_versions), minimum_versions, sep = "=", collapse = ", ")
  )
}

cmdstan_root <- Sys.getenv("CMDSTAN", unset = "")
if (!nzchar(cmdstan_root)) stop("CMDSTAN must name the CI installation root")
cmdstan_root <- normalizePath(cmdstan_root, winslash = "/", mustWork = FALSE)
cmdstan_target <- file.path(cmdstan_root, "cmdstan-2.39.0")

if (!dir.exists(cmdstan_target)) {
  dir.create(cmdstan_root, recursive = TRUE, showWarnings = FALSE)
  cmdstanr::install_cmdstan(
    dir = cmdstan_root,
    cores = 2,
    quiet = FALSE,
    timeout = 1200,
    version = "2.39.0"
  )
}

cmdstanr::set_cmdstan_path(cmdstan_target)
if (!identical(as.character(cmdstanr::cmdstan_version()), "2.39.0")) {
  stop("CmdStan 2.39.0 was not installed correctly")
}
cmdstanr::check_cmdstan_toolchain(quiet = FALSE)

writeLines(c(
  paste(names(exact_versions), exact_versions, sep = "="),
  paste(names(minimum_versions), minimum_versions, sep = "="),
  paste0("cmdstan=", cmdstanr::cmdstan_version()),
  paste0("cmdstan_path=", cmdstanr::cmdstan_path())
))
