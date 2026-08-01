required <- c(
  dplyr = "1.2.1",
  readr = "2.2.0",
  readxl = "1.5.0",
  tidyr = "1.3.2",
  tibble = "3.3.1",
  purrr = "1.2.2",
  knitr = "1.51",
  rmarkdown = "2.31"
)

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
    repos = "https://cloud.r-project.org"
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
