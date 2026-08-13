# STEP 5 の各レッスンで共通して使う合成データ
#
# このファイルを Project 直下へ置き、各レッスンの最初に
# source("step5_data.R")
# を実行します。固定した乱数の種を使うので、同じデータから
# 何度でも練習を始められます。実在の参加者から集めたデータではありません。

set.seed(2026)

# 連続応答、prior、測定誤差の例に使う45人分の表。
n_people <- 45
people <- data.frame(
  id = sprintf("p%02d", seq_len(n_people)),
  practice_h = round(stats::runif(n_people, 1, 8), 1),
  sleep_h = round(stats::rnorm(n_people, mean = 7, sd = 0.9), 1),
  baseline = round(stats::rnorm(n_people, mean = 60, sd = 10), 1),
  baseline_se = round(stats::runif(n_people, 2, 5), 1),
  condition = factor(rep(c("A", "B"), length.out = n_people))
)

# 記憶得点、睡眠と得点、平均反応時間を、説明用にゆるく関連させる。
people$memory <- round(
  40 + 3 * people$practice_h + 0.35 * people$baseline + stats::rnorm(n_people, 0, 6),
  1
)
people$score <- round(
  55 + 2.5 * (people$sleep_h - 7) + stats::rnorm(n_people, 0, 7),
  1
)
people$baseline_z <- as.numeric(scale(people$baseline))
people$mean_rt_ms <- round(
  540 + 45 * (people$condition == "B") - 18 * people$baseline_z + stats::rnorm(n_people, 0, 55),
  1
)

# 連続応答の例では、短い名前でこの表を使う。
dat <- people

# 反復測定、二値応答、反応時間の例に使う12人×2条件×20試行の表。
participant_ids <- sprintf("p%02d", seq_len(12))
trials <- expand.grid(
  participant = participant_ids,
  condition = c("A", "B"),
  trial = seq_len(20),
  KEEP.OUT.ATTRS = FALSE,
  stringsAsFactors = FALSE
)
trials$participant <- factor(trials$participant, levels = participant_ids)
trials$condition <- factor(trials$condition, levels = c("A", "B"))

# 条件Bを少し遅く、参加者ごとに少し異なる反応時間として生成する。
person_offset <- stats::rnorm(length(participant_ids), mean = 0, sd = 45)
trial_offset <- person_offset[match(trials$participant, participant_ids)]
trials$rt_ms <- round(exp(stats::rnorm(
  nrow(trials),
  mean = log(580 + 40 * (trials$condition == "B") + trial_offset),
  sd = 0.18
)))
trials$correct <- stats::rbinom(
  nrow(trials),
  size = 1,
  prob = ifelse(trials$condition == "A", 0.9, 0.8)
)

# 欠測を点検する練習のため、両条件に一つずつ未記録を入れる。
trials$rt_ms[c(5, 17)] <- NA_integer_
correct_trials <- trials[trials$correct == 1 & !is.na(trials$rt_ms), ]
existing_trials <- correct_trials[seq_len(min(8, nrow(correct_trials))), ]

# 順序評定の例。ratingは1〜5の順序を持つカテゴリである。
ratings <- expand.grid(
  participant = participant_ids,
  condition = c("A", "B"),
  KEEP.OUT.ATTRS = FALSE,
  stringsAsFactors = FALSE
)
ratings$participant <- factor(ratings$participant, levels = participant_ids)
ratings$condition <- factor(ratings$condition, levels = c("A", "B"))
rating_value <- pmin(
  5,
  pmax(1, round(3 + 0.5 * (ratings$condition == "B") + stats::rnorm(nrow(ratings), 0, 1)))
)
ratings$rating <- ordered(rating_value, levels = 1:5)

# 件数の例。観察時間は必ず正にして、offsetの意味を確かめられるようにする。
counts <- expand.grid(
  participant = participant_ids,
  condition = c("A", "B"),
  KEEP.OUT.ATTRS = FALSE,
  stringsAsFactors = FALSE
)
counts$participant <- factor(counts$participant, levels = participant_ids)
counts$condition <- factor(counts$condition, levels = c("A", "B"))
counts$observation_minutes <- rep(c(20, 30, 40), length.out = nrow(counts))
expected_lapses <- counts$observation_minutes / 30 * ifelse(counts$condition == "A", 1.5, 2.2)
counts$lapses <- stats::rpois(nrow(counts), lambda = expected_lapses)
