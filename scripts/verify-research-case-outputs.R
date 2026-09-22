args <- commandArgs(trailingOnly=TRUE)
stopifnot(length(args)==1)
out <- args[1]
raw <- read.csv(file.path(out,"raw-trials.csv"))
train <- read.csv(file.path(out,"analysis.csv"))
stopifnot(identical(train$row_id,subset(raw,split=="train")$row_id))
scores <- read.csv(file.path(out,"holdout-scores.csv"))
stopifnot(nrow(scores)==12, all(is.finite(scores$brier)), all(scores$brier>=0 & scores$brier<=1),
 all(is.finite(scores$marginal_log_score)), all(scores$marginal_log_score<=0))
for (target in unique(scores$target)) {
 test <- subset(raw,split==target)
 stopifnot(all(subset(scores,target==test$split[1])$n == nrow(test)),!any(test$row_id %in% train$row_id))
 for (model in unique(scores$model)) {
  p <- read.csv(file.path(out,paste(model,target,"probabilities.csv",sep="-")))
  stopifnot(identical(p$row_id,test$row_id), all(p$probability>=0 & p$probability<=1))
  score <- scores[scores$target==target & scores$model==model, ]
  stopifnot(abs(mean((p$probability-test$correct)^2)-score$brier)<1e-10)
 }
}
intervals <- read.csv(file.path(out,"predictive-intervals.csv"))
stopifnot(nrow(intervals)==24, all(is.finite(as.matrix(intervals[,4:6]))),
 all(intervals[,4]<=intervals[,5] & intervals[,5]<=intervals[,6]))
cat("Crossed-case output contracts and score recomputation PASS\n")
