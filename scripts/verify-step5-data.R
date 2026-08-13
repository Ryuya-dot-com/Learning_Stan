# STEP 5 共通データが、各レッスンの最小限の列契約を満たすことを検証する。
project_root <- normalizePath(".", winslash = "/", mustWork = TRUE)
data_file <- file.path(project_root, "public", "scripts", "step5", "step5_data.R")

load_step5_data <- function() {
  data_environment <- new.env(parent = baseenv())
  source(data_file, local = data_environment, encoding = "UTF-8")
  data_environment
}

first <- load_step5_data()
second <- load_step5_data()

required_objects <- c(
  "dat", "people", "trials", "correct_trials", "existing_trials", "ratings", "counts"
)
stopifnot(all(required_objects %in% ls(first)))

stopifnot(
  nrow(first$dat) == 45,
  all(c("practice_h", "baseline", "memory", "score", "sleep_h") %in% names(first$dat)),
  all(c("mean_rt_ms", "condition", "baseline_z", "baseline_se") %in% names(first$people)),
  all(c("participant", "condition", "trial", "rt_ms", "correct") %in% names(first$trials)),
  nrow(first$trials) == 12 * 2 * 20,
  is.factor(first$trials$participant),
  identical(levels(first$trials$condition), c("A", "B")),
  all(first$trials$correct %in% c(0L, 1L)),
  all(is.finite(first$trials$rt_ms[!is.na(first$trials$rt_ms)])),
  sum(is.na(first$trials$rt_ms)) == 2,
  all(tapply(is.na(first$trials$rt_ms), first$trials$condition, sum) == 1),
  nrow(first$correct_trials) > 0,
  all(first$correct_trials$correct == 1L),
  all(first$correct_trials$rt_ms > 0),
  nrow(first$existing_trials) > 0,
  all(first$existing_trials$rt_ms > 0),
  all(c("participant", "condition", "rating") %in% names(first$ratings)),
  is.ordered(first$ratings$rating),
  all(as.integer(first$ratings$rating) %in% 1:5),
  all(c("participant", "condition", "lapses", "observation_minutes") %in% names(first$counts)),
  all(first$counts$lapses >= 0),
  all(first$counts$observation_minutes > 0),
  identical(first$dat, second$dat),
  identical(first$trials, second$trials),
  identical(first$ratings, second$ratings),
  identical(first$counts, second$counts)
)

cat("STEP 5 data contract: PASS (fixed seed, 7 objects, continuous/repeated/discrete/RT columns)\n")
