# 進行役用の準備・採点キー

参加者へ事前に見せません。これは完全一致のコードを要求する採点表ではなく、観察条件と期待するデータ契約を固定するものです。

## DQ01・DQ02の扱い

- DQ01では `read_csv()` が成功した事実だけを伝える。
- 「問題が入っています」「検査してください」と補足しない。
- 最初の判断を回答後に消さず、記録票へそのまま残す。
- DQ02では参加者が自発的に挙げた検査だけを基準値として数える。

期待する概念は、「エラーなく読めても、重複・値域・カテゴリ・ID対応・欠損は別途確認が必要」です。関数名を言えないことだけで未完了にしません。

## DQ03のデータ契約

`rt_data_dirty.csv`には次の既知問題が各1行あります。

| issue | 件数 |
|---|---:|
| `duplicate` | 1 |
| `invalid_cond` | 1 |
| `missing_correct` | 1 |
| `rt_out_of_range` | 1 |
| `unknown_participant` | 1 |

問題行を除いたcheckedデータは12行で、配布 `rt_data.csv` と一致します。rawファイルの作業前後MD5が一致することも確認します。除外の是非ではなく、教材で既知の5行を、明示した仮ルールに従って追跡できるかを見ます。

## DQ04の準備

DQ03終了後、参加者が画面を見ていない状態で次を実行します。新しいCSVは作りません。

```r
transfer_raw <- readr::read_csv(
  "data/rt_data.csv",
  show_col_types = FALSE
)
transfer_raw$cond[2] <- "practice"
transfer_raw$rt[4] <- 90
transfer_raw$id[6] <- "P04"
transfer_raw$correct[8] <- NA
transfer_raw <- dplyr::bind_rows(
  transfer_raw,
  transfer_raw[1, ]
)
transfer_fingerprint <- serialize(transfer_raw, NULL)
```

参加者には `transfer_raw` が用意されていることだけを伝えます。変更行の位置や種類は伝えません。

期待する結果:

- 13入力行
- 5問題行
- `duplicate`、`invalid_cond`、`missing_correct`、`rt_out_of_range`、`unknown_participant`が各1件
- 8採用行
- `identical(serialize(transfer_raw, NULL), transfer_fingerprint)` がTRUE

参加者が `transfer_issues` と `transfer_checked` を作った後、進行役は次を実行します。

```r
expected_issue_types <- c(
  "duplicate",
  "invalid_cond",
  "missing_correct",
  "rt_out_of_range",
  "unknown_participant"
)

stopifnot(
  nrow(transfer_issues) == 5,
  setequal(transfer_issues$issue, expected_issue_types),
  nrow(transfer_checked) == 8,
  identical(
    serialize(transfer_raw, NULL),
    transfer_fingerprint
  )
)
```

## 判定時の注意

- dplyr以外の書き方でも、同じ契約を満たし説明できれば受理する。
- 大文字小文字、空白、オブジェクト名の軽微な誤りは、概念誤りと分ける。
- `transfer_raw`を上書きしたが `transfer_fingerprint` と一致する場合も、上書きしようとした事実は記録する。
- 進行役の準備ミス、パッケージ不足、保存権限は`B`として教材理解と分ける。
- 正答後の自信や満足度を、転移の証拠として代用しない。
