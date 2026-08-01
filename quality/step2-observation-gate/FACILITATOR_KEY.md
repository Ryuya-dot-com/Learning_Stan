# STEP 2初心者観察 — 進行役用の準備・採点キー

参加者へ初回提出前に見せません。特定のdplyrコードを正解とする文書ではなく、入力・成果物・観察条件・原因切り分けの契約です。

## 配布前検査

`participant-pack.zip`には次の2ファイルだけが入ります。

```text
Learning_Stan_STEP2_Observation/
├── PARTICIPANT_TASK.md
└── data/
    └── device_load_trials.csv
```

配布前に次を実行します。

```bash
npm run test:step2-observation-pack
npm run test:step2-observation-rehearsal
```

参加者へL17〜L20の完成版Rコード、L20理解問題の解答例、この採点キー、`step2_transfer_check.R`を見せません。

## 入力契約

- SHA-256: `60ec20716259cb01eb2faf9e6f6de4d601a740042f312765db6f834445c56289`
- MD5: `f5f13b38a895f8f18be69afbe09a1dcb`
- 384行、16デバイス、2条件、各デバイス・条件12測定
- `valid == TRUE`: 352行。各デバイス・条件11測定
- 列: `device_id`, `load_condition`, `reading`, `latency_ms`, `valid`

## 期待するCSV

- `device_condition_summary.csv`: 32行、指定5列、1行はデバイス×条件
- `descriptive_statistics.csv`: 2行、指定6列、1行は条件
- `device_differences.csv`: 16行、指定4列、差は`high_load - baseline`

主要な記述値:

| 指標 | baseline | high_load |
|---|---:|---:|
| デバイス平均の中央値 | 144.00 ms | 188.73 ms |
| Q1 | 129.48 ms | 166.16 ms |
| Q3 | 158.52 ms | 211.77 ms |
| IQR | 29.05 ms | 45.61 ms |

16台すべての差が正で、差の中央値は44.73 ms、範囲は28.45〜59.55 msです。これは合成標本内の記述であり、有意差、製品母集団、因果効果の結論ではありません。

## 図と報告の手動確認

自己チェッカーはPNG寸法とファイル実体を確認しますが、図の意味は画像を開いて確認します。

- 条件別分布図: 2条件、32点、箱ひげなどの分布要約、latencyのms単位、点の意味、合成データ注記
- デバイス内対応図: 16本の線、32点、`group = device_id`相当、線の意味、合成データ注記
- 2図とも7×5 inch、300 dpi、2100×1500px、白背景
- 色だけに依存せず、軸位置、点、線、文字でも条件と対応を読める

探索メモは7接頭辞を満たし、分析対象、2図の役割、標本内の観察、非主張、再生成手順を分離します。完全一致の日本語は要求しません。

## 初回提出とチェッカー

参加者が完了を宣言したら、次を先に固定します。

1. 6成果物の存在・行数・列名・PNG寸法
2. 入力MD5
3. `step2_transfer.R`を空のRセッションから実行できたか
4. 2図を開いて参加者が説明した内容
5. S201〜S204の最大支援水準と完了時刻

その後だけ`step2_transfer_check.R`をProject直下へコピーします。初回FAILは`PATH / INPUT / SUMMARY / PAIRING / FIGURE / NOTE / RAW / ENV`へ分類し、期待値を口頭で教えず1回の自己修正を許可します。

## 判定上の注意

- base R、tidyverse、別の関数構成でも、同じ成果物契約なら受理する
- 自発的な公式文書利用は支援なしの`I`。進行役が場所を示すとH2以上
- 32行や16本を予測できても、実際の対応キーや保存plotが誤っていれば独立完遂にしない
- 最終PASSを初回の独立完遂へ読み替えない
- 全試行を独立単位とする、`group = load_condition`で線を結ぶ、手作業だけで保存する、合成データから因果効果を結論する行動はP1候補として独立レビューする
- パッケージ、権限、作業ディレクトリ、Dropboxロックは`B`または`ENV`として理解失敗と分ける
