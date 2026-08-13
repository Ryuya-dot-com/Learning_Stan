# 12 反応時間モデル

## この回のゴール

正で右に歪み得る反応時間と時間制限による未反応を区別し、分布選択をPPCと記録過程で説明できる。

## 前提

回帰、正の連続量、PPCの基礎。

## 研究場面

反応時間は0より大きく、遅い反応の裾が長い。1,500 msで画面が切り替わり、未反応はtimeoutとして記録される。

## 解説

RTを単に「外れ値」と呼ぶ前に、何が観測されたかを確認します。正の連続RTをlognormalとするなら、対数RTが正規分布の周りにばらつきます。

\[
\log(\mathrm{RT}_{ij})\sim\mathrm{normal}(\alpha+a_j+\beta c_{ij},\sigma)
\]

```r
library(brms)

priors <- c(
  prior(normal(log(600), 0.5), class = "Intercept"),
  prior(normal(0, 0.2), class = "b"),
  prior(exponential(1), class = "sigma"),
  prior(exponential(2), class = "sd"),
  prior(lkj(2), class = "cor")
)
fit_log <- brm(
  rt_ms ~ condition + (1 + condition | participant),
  data = completed_trials, family = lognormal(), prior = priors, seed = 2026
)
pp_check(fit_log, type = "stat_grouped", group = "condition", stat = "q90")
```

`family = lognormal()`の係数は元のms尺度ではなく対数尺度にあるため、条件別の予測RTへ戻して読む。timeoutは「RTが存在しない」とは限りません。上限までに反応しなかったという打ち切り情報なら、完了RTだけを普通の連続値としてfitするモデルとは異なる尤度が必要です。観測範囲に入らなかった人だけがデータにいない切断とも区別します。

## 典型的誤解

- RTの正規性検定が有意なら、ログ変換だけで解決する。
- `real<lower=0>`をStanに書けば切断尤度になる。
- timeoutを削除すれば、速い反応だけを分析しても同じ問いに答えられる。

## 理解問題

1. **選択**：上限1,500 msで「未反応」と記録されるのは何か。A. 切断 B. 打ち切り C. 四捨五入。  
   **解答：B。** 値が上限を超えた事実は分かるが正確なRTは分からない。
2. **出力予測**：lognormalの条件係数が正なら、元尺度の中央値RTはどう変わりやすいか。  
   **解答：増加する。** 正確なms差は基準値にも依存する。
3. **記述**：平均だけでなく上位分位点のPPCを見る理由を書く。  
   **rubric：右裾の遅い反応が研究上重要で、平均が合っても尾部を外し得ると述べる。**
4. **レビュー**：上限超過を1500と入力して通常のlognormalをfitする問題は何か。  
   **解答：1500という正確な観測値だったかのように扱う。** 打ち切り尤度を表していない。
5. **主張境界**：lognormalのPPCが良いので、注意の個人差を測定したと言えるか。  
   **解答：言えない。** 分布適合は構成概念妥当性を保証しない。

## 4段階練習

1. **まねる**：RTのhistogramとlog(RT)のhistogramを描き、どの特徴を確認するか書く。
2. **一つ変える**：PPC統計量を中央値から90%分位点へ変える。
3. **見ずに作る＋デバッグ**：0または負のRTを検出し、`lognormal()`へ渡す前に原因別に記録する。
4. **未見転移**：最低RTで除外された実験について、除外規則、切断、誤反応のどれが観測過程に合うかを設計する。

## 歯応えある任意課題

lognormal、shifted lognormal、ex-Gaussianを、同じ条件別の中央値・q90・timeout数への予測という観点で比較し、候補外の説明も書く。

## 一次資料

- [brms: Lognormal family](https://paulbuerkner.com/brms/reference/brmsfamily.html)
- [Stan User’s Guide: Truncation and Censoring](https://mc-stan.org/docs/stan-users-guide/truncation-censoring.html)
