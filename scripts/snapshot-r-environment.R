# Maintainer command: refresh only after successful runtime verification.
# Does not create .Rprofile or alter the learner's library.
lock <- normalizePath("reproducibility", mustWork=TRUE)
project <- tempfile("snapshot-")
dir.create(project)
renv::snapshot(project=project, library=.libPaths(),
  lockfile=file.path(lock,"renv.lock"),
  packages=c("brms","cmdstanr","posterior","ggplot2","knitr","rmarkdown",
    "dplyr","readr","readxl","tidyr","tibble","purrr","loo","openssl","renv"),
  prompt=FALSE, force=TRUE)
# Keep restoration metadata and dependency edges, not package authors' contact details.
record <- renv::lockfile_read(file.path(lock,"renv.lock"))
fields <- c("Package","Version","Source","Repository","Hash","Requirements","Depends","Imports","LinkingTo")
record$Packages <- lapply(record$Packages, function(package) {
  package[intersect(names(package), c(fields, grep("^Remote", names(package), value=TRUE)))]
})
renv::lockfile_write(record, file.path(lock,"renv.lock"))
