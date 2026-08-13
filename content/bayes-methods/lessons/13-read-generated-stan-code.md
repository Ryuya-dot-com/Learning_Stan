# 13 brmsが生成したStanコードを読む

## この回のゴール

brmsのformula、生成過程、生成Stanコードのdata・parameters・model・generated quantitiesを対応付けて説明できる。

## 前提

brmsの正規または二値回帰、Stanの基本ブロック。

## 研究場面

条件効果のbrmsモデルを再現可能に保存し、どの事前分布と尤度が実際に使われたか確認したい。

## 解説

brmsはブラックボックスではありません。formula、family、prior、dataからStanプログラムを作ります。まずモデルを言葉と式で固定してからコードを読みます。

```r
pri <- c(prior(normal(0, 200), class = "Intercept"),
         prior(normal(0, 100), class = "b"),
         prior(exponential(1/200), class = "sigma"))
fit <- brm(rt_ms ~ condition, data = trials, prior = pri,
           family = gaussian(), seed = 2026)
stancode(fit)
```

生成コードではdata blockが`N`、応答、設計行列を受け取る。parameters blockは切片、傾き、残差尺度など未知量を宣言する。model blockはpriorと`normal_id_glm_lpdf`等の尤度を`target`へ加える。generated quantitiesに何を作るかは設定により異なり、予測や`log_lik`がR側で必要時に計算されることもあります。関数名や生成位置を暗記せず、生成過程が同じかを読むことが重要です。

## 典型的誤解

- formulaを書けばpriorも自動で研究上妥当になる。
- `stancode()`の長い最適化コードはすべて統計仮定である。
- Stanの`~`は毎iterationで観測データを再生成する。

## 理解問題

1. **選択**：R data frameの`condition`が生成Stanで主に現れる場所はどれか。A. data/design matrix B. parameters C. RNGだけ。  
   **解答：A。** 既知の説明変数として渡される。
2. **出力予測**：`prior(..., class = "b")`を広げると直接変わるものは何か。  
   **解答：傾きparameterの事前分布。** データ行数や尤度の支持範囲は変わらない。
3. **記述**：最適化された尤度関数を、元の正規回帰の生成過程へ言い換える。  
   **rubric：各観測が線形予測子を平均、sigmaを尺度とする正規分布から来ると書く。**
4. **レビュー**：`stancode()`がコンパイルするので、R側の列名と型を確認しなくてよいか。  
   **解答：よくない。** 実行時data contractは別に満たす必要がある。
5. **主張境界**：生成Stanに`log_lik`があるならLOO比較は自動的に妥当か。  
   **解答：不適切。** pointwise単位と予測課題、Pareto kを確認する。

## 4段階練習

1. **まねる**：`stancode()`の各blockに「既知／未知／密度／予測」の注釈を付ける。
2. **一つ変える**：傾きpriorだけを変更し、変わったStan行を探す。
3. **見ずに作る＋デバッグ**：`brm()`からdata contract表を作り、conditionの水準不足を検出する。
4. **未見転移**：Bernoulli階層formulaの生成Stanについて、participant index、線形予測子、尤度を対応付ける。

## 歯応えある任意課題

brms版と手書きStan版を同じ合成データ・同じpriorでfitし、比較可能なparameterと比較してはいけない内部parameterを分ける。

## 一次資料

- [brms: stancode](https://paulbuerkner.com/brms/reference/stancode.html)
- [Stan Reference Manual: Program Blocks](https://mc-stan.org/docs/reference-manual/blocks.html)
