lesson_dir <- file.path("content", "bayes-methods", "lessons")

if (!dir.exists(lesson_dir)) {
  stop("Run this script from the repository root.")
}

extract_r_blocks <- function(lines) {
  blocks <- list()
  current <- character()
  closing_fence <- NULL

  for (line in lines) {
    if (is.null(closing_fence)) {
      if (grepl("^```r\\s*$", line)) {
        closing_fence <- "```"
      } else if (grepl("^~~~r\\s*$", line)) {
        closing_fence <- "~~~"
      }
    } else if (identical(line, closing_fence)) {
      blocks[[length(blocks) + 1]] <- paste(current, collapse = "\n")
      current <- character()
      closing_fence <- NULL
    } else {
      current <- c(current, line)
    }
  }

  if (!is.null(closing_fence)) {
    stop("Unclosed R code fence")
  }

  blocks
}

lesson_files <- sort(list.files(lesson_dir, pattern = "\\.md$", full.names = TRUE))
block_count <- 0L

for (lesson_file in lesson_files) {
  blocks <- extract_r_blocks(readLines(lesson_file, warn = FALSE))

  for (block_index in seq_along(blocks)) {
    tryCatch(
      parse(text = blocks[[block_index]], keep.source = TRUE),
      error = function(error) {
        stop(
          sprintf(
            "%s のRコードブロック%dを構文解析できません: %s",
            basename(lesson_file),
            block_index,
            conditionMessage(error)
          ),
          call. = FALSE
        )
      }
    )
  }

  block_count <- block_count + length(blocks)
}

cat(sprintf("OK: %d lessons, %d R code blocks parsed.\n", length(lesson_files), block_count))
