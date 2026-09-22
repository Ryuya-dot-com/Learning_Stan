# Fast contract tests: neither fitting nor external services are needed.
source("public/practice/research-case/data.R")
d <- split_trials(simulate_trials())
stopifnot(identical(d, split_trials(simulate_trials())), !anyNA(d), !anyDuplicated(d$row_id))
train <- subset(d, split=="train")
expected <- c("existing_existing", "new_existing", "existing_new", "new_new")
stopifnot(setequal(unique(d$split),c("train",expected)))
for (target in expected) {
  test <- subset(d,split==target)
  stopifnot(!any(test$row_id %in% train$row_id))
  existing <- strsplit(target,"_",fixed=TRUE)[[1]] == "existing"
  stopifnot(all((test$participant %in% train$participant) == existing[1]),
            all((test$item %in% train$item) == existing[2]))
}
# Same pair can have multiple rows; rejecting row overlap alone does not prove group holdout.
stopifnot(any(duplicated(paste(train$participant,train$item))))
for (path in list.files("public/practice/research-case",pattern="\\.R$",recursive=TRUE,full.names=TRUE)) parse(path)
cat("Research case data contracts, four holdout targets and R syntax PASS\n")
