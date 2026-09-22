# 実行環境

基準：R 4.6.1、brms 2.23.0、CmdStanR 0.9.0、CmdStan 2.39.0。ZIPにはRパッケージの`renv.lock`を含めます。復元する場合は専用Projectで次を実行します。

```r
install.packages("renv")
dir.create("r-library", showWarnings = FALSE)
renv::restore(lockfile = "renv.lock", library = "r-library", prompt = FALSE)
.libPaths(c(normalizePath("r-library"), .libPaths()))
# CmdStanをまだ用意していない場合だけ
cmdstanr::install_cmdstan(version = "2.39.0")
```

`--vanilla`は起動設定を読みません。復元したライブラリを新しいプロセスへ渡して実行します。

```r
Sys.setenv(R_LIBS_USER = normalizePath("r-library"))
system2(file.path(R.home("bin"), "Rscript"), c("--vanilla", "run.R"))
```

R、OS、コンパイラ、CmdStanそのものはrenv.lockだけでは固定できません。各実行の`environment.txt`に実際の版が残ります。最低バージョンを満たすことと基準環境を復元することを区別してください。新しい版でも動くかは別に検査します。

`--smoke`は短いコード実行確認用です。通常実行の診断を通過したこと、実際の受講者が説明・転移できたこと、別OSで再現できたことは、それぞれ別の確認です。
