required <- c(
  dplyr = "1.2.1",
  readr = "2.2.0",
  readxl = "1.5.0",
  tidyr = "1.3.2",
  tibble = "3.3.1",
  purrr = "1.2.2",
  ggplot2 = "4.0.3",
  knitr = "1.51",
  rmarkdown = "2.31",
  loo = "2.10.1"
)

rspm_repo <- Sys.getenv("RSPM", unset = "")
configured_repos <- getOption("repos")
configured_cran <- unname(configured_repos["CRAN"])

if (nzchar(rspm_repo)) {
  repositories <- c(CRAN = rspm_repo)
} else if (
  length(configured_cran) == 1L &&
    !is.na(configured_cran) &&
    nzchar(configured_cran) &&
    configured_cran != "@CRAN@"
) {
  repositories <- configured_repos
} else {
  repositories <- c(CRAN = "https://cloud.r-project.org")
}

message("Using R package repository: ", repositories[["CRAN"]])

needs_install <- vapply(
  names(required),
  function(package) {
    !requireNamespace(package, quietly = TRUE) ||
      packageVersion(package) < package_version(required[[package]])
  },
  logical(1)
)

if (any(needs_install)) {
  install.packages(
    names(required)[needs_install],
    repos = repositories
  )
}

versions <- vapply(
  names(required),
  function(package) as.character(packageVersion(package)),
  character(1)
)

if (any(package_version(versions) < package_version(required))) {
  stop("必要なRパッケージのバージョンを満たしていません")
}

writeLines(paste(names(versions), versions, sep = "="))
