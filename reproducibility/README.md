# 基準環境と互換性検査

`renv.lock`は今回のR実行検証に使用したRパッケージ一式の記録です。最低バージョン検査を行う`install-r-dependencies.R`とは役割が異なります。自動の`.Rprofile`は追加しません。

R 4.6.1、CmdStanR 0.9.0、CmdStan 2.39.0を基準とします。Rパッケージを復元する場合は、専用Projectで次を実行します。

```r
install.packages("renv")  # 初回の導入
dir.create("r-library", showWarnings = FALSE)
renv::restore(lockfile = "reproducibility/renv.lock", library = "r-library", prompt = FALSE)
.libPaths(c(normalizePath("r-library"), .libPaths()))
cmdstanr::install_cmdstan(version = "2.39.0")  # まだない場合だけ
```

同梱ZIPではlockfileを`renv.lock`と指定します。`--vanilla`は起動設定を読まないため、別のRプロセスにもこのライブラリを明示します。Rから起動する例は次のとおりです（Windowsでも同じ考え方です）。

```r
Sys.setenv(R_LIBS_USER = normalizePath("r-library"))
system2(file.path(R.home("bin"), "Rscript"), c("--vanilla", "run.R"))
```

Project本体でNB5を検証する場合は`run.R`を`scripts/verify-brms-notebook.R`に置き換えます。復元処理の実行はネット接続とパッケージ配布元の可用性を必要とします。ロックを取得した環境での実行検証と、別OSの空ライブラリへのrestore成功は別の証拠です。今回、後者の全OS検証まで完了したとは主張しません。

- `renv.lock`：Rパッケージ版と配布元。R本体、OS、コンパイラは導入しない。
- `scripts/install-stan-ci.R`：CmdStanRとCmdStanの基準版。別OSではそのOSでコンパイルする。
- `.node-version`・`package-lock.json`：Webアプリ側のNodeと依存。
- Quarto：ノートをHTML化する場合に別途必要。Rチャンクの検証は`knitr::purl`で行うため、HTMLレンダリング検証と区別する。
- `environment.txt`・`source-manifest.csv`：実際の実行環境と実行対象ファイルの識別。

基準CIはロック環境、手動の互換性jobは新しい依存の環境で実行します。後者が成功しても基準版を黙って置き換えず、内容確認と実行検証後に`Rscript --vanilla scripts/snapshot-r-environment.R`で更新します。失敗ログと未確認範囲を残します。
