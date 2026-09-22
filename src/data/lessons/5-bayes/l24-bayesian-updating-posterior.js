// STEP 4: ベイズ更新と事後分布
const ladder = {
  title: "4段階の反復練習",
  intro: "今回くり返す技能は「prior・尤度・事後分布を同じ未知量について対応付けること」です。各段階は、実際にRで確かめてからチェックしてください。",
  steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "格子近似を実行し、priorとposteriorを同じ図に描きます。", criterion: "標本平均、priorの中心、事後平均を別の量として説明できたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "priorの標準偏差だけを1、4、10へ変え、事後の中心と広がりを比べます。", criterion: "priorの尺度と、事後が変わった理由を結び付けられたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "12人分の差データについて、格子、対数尤度、正規化、90%区間を自力で書きます。", criterion: "重みの合計が1になることを確認し、NaNなら正規化前の値を調べられたら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "正答数/20のデータで、平均差の正規モデルが不自然な点と候補の生成過程を述べます。", criterion: "応答の支持範囲と分析単位から、二項モデルを候補にする理由を説明できたら完了です。" },
  ],
};

export default {
  id: "l24",
  title: "データで見通しを更新する",
  tag: "prior・likelihood・posterior",
  practiceLadder: ladder,
  pages: [
    {
      t: "事前の見通しを、データで更新する",
      b: [
        "休憩なし条件と10分休憩条件を24人が行ったとします。ここでは1行を参加者とし、`diff = 休憩あり − なし`の得点差を分析します。正なら、休憩あり条件の方が高得点です。試行を何行も持つデータなら、先に研究質問に合う分析単位を決めます。",
        "ベイズ推定では、データを見る前の見通しを事前分布（prior）、各候補が観測データとどれほど整合するかを尤度（likelihood）、両方を合わせたデータ後の分布を事後分布（posterior）と呼びます。",
        "このレッスンでは、同じ未知の平均について、事前分布・尤度・事後分布を図で対応させ、事後分布に基づく限定付きの結論を書くことができるようになります。",
      ],
      code: `diff <- c(3, -1, 5, 2, 4, 0, 1, 6, 2, 3, -2, 4,
          1, 5, 0, 2, 3, 1, 4, -1, 2, 5, 0, 3)
mean(diff)
length(diff)`,
      out: "[1] 2.166667\n[1] 24",
      verify: { mode: "numeric", absoluteTolerance: 1e-6, relativeTolerance: 1e-8 },
      a: ["標本平均は24人における記述値です。これだけで母平均が確定するわけではありません。以下では母平均を`mu`、参加者間の散らばりを`sigma`と書きます。"],
    },
    {
      t: "生成過程とベイズ更新を分けて読む",
      b: [
        "一人ひとりの差が母平均の周りで揺れるなら、`diff[i] ~ Normal(mu, sigma)`と表せます。説明を見通しよくするため、ここでは`sigma = 4`点を既知と仮定します。本来は通常、sigmaも未知量として推定します。",
        "データ前に平均差は0点付近で、極端な差は少なそうだと考えたなら、たとえば`mu ~ Normal(0, 4)`と置けます。これは答えを0に固定するのでなく、データ前にどの値をどの程度許すかを明示することです。",
        "各muについてpriorの重みと尤度の重みを掛け、全体が確率分布になるよう正規化すると事後分布になります。図では三つの形を比べるため、尤度だけ縦方向の大きさを調整します。これは尤度をparameterの確率に変える操作ではありません。",
      ],
      code: `mu_grid <- seq(-8, 8, length.out = 2001)
prior_density <- dnorm(mu_grid, mean = 0, sd = 4)
log_lik <- sapply(mu_grid, function(mu) {
  sum(dnorm(diff, mean = mu, sd = 4, log = TRUE))
})
likelihood_shape <- exp(log_lik - max(log_lik))
posterior_raw <- prior_density * likelihood_shape

grid_width <- mu_grid[2] - mu_grid[1]
posterior_density <- posterior_raw /
  sum(posterior_raw * grid_width)
posterior_weight <- posterior_density * grid_width

likelihood_for_plot <- likelihood_shape /
  sum(likelihood_shape * grid_width)
matplot(
  mu_grid,
  cbind(prior_density, likelihood_for_plot, posterior_density),
  type = "l", lty = 1, lwd = 2,
  col = c("grey40", "steelblue", "firebrick"),
  xlab = "母平均差 mu（点）", ylab = "密度"
)
legend(
  "topright", c("muのprior", "likelihood（表示用）", "muのposterior"),
  col = c("grey40", "steelblue", "firebrick"), lty = 1, lwd = 2
)

sum(posterior_weight)
weighted.mean(mu_grid, posterior_weight)`,
      verify: { mode: "manual", reason: "格子近似の表示値はRの版と丸め方でわずかに異なり得るため" },
      a: ["対数尤度から最大値を引いてから指数に戻すと、極小値の丸め落ちを避けやすくなります。`posterior_density`は図の高さ、`posterior_weight`は格子点をdrawするときの確率です。尤度の線は形を比べるためだけに拡大・縮小しており、muの確率ではありません。"],
    },
    {
      t: "事後drawで不確実性を要約する",
      b: [
        "格子上の重みから値を繰り返し取り出すと、事後分布を表すdrawを作れます。ここでのdrawは母平均差`mu`というparameterのdrawであり、一人ひとりの得点差を再生成した値ではありません。",
        "90%信用区間は「このモデル・prior・データに条件づけると、muの事後確率の90%が入る範囲」と読みます。頻度論の信頼区間と同じ説明として使いません。",
      ],
      code: `set.seed(2026)
draws <- sample(mu_grid, size = 100000, replace = TRUE,
                prob = posterior_weight)
interval_90 <- quantile(draws, c(.05, .5, .95))
interval_90
mean(draws > 2)

hist(draws, breaks = 40, probability = TRUE,
     col = "grey90", border = "white",
     xlab = "母平均差 mu（点）", main = "muの事後分布")
abline(v = interval_90[c(1, 3)], lty = 2)
abline(v = 2, col = "firebrick", lwd = 2)
legend("topright", c("90%区間", "実用上の基準: 2点"),
       col = c("black", "firebrick"), lty = c(2, 1), lwd = c(1, 2))`,
      verify: { mode: "manual", reason: "乱数による事後drawの要約であり、実行環境で末尾の値が異なり得るため" },
      a: ["破線は事後分布の中央90%区間、赤線は研究上あらかじめ決めた2点の基準です。区間と`P(mu > 2)`は異なる問いへの要約です。どちらも指定した生成過程、prior、24人のデータに条件づく結果であり、休憩の因果効果を自動的に示しません。"],
    },
  ],
  ex: [
    { id: "imitate-q01", revision: 1, k: "choice", q: "標本平均が2.1点、priorがNormal(0, 4)で、データが多くばらつきも小さいときの事後平均として最も妥当なのはどれですか?", opts: ["必ず0点", "必ず2.1点", "通常は0点と2.1点の間で、2.1点に近い", "必ず4点"], ans: 2, why: "尤度が鋭いほどデータの重みが大きくなります。priorを無視して必ず標本平均になるわけでも、prior平均や標準偏差そのものになるわけでもありません。", hint: "事後分布はpriorと尤度の両方を反映します。" },
    { id: "imitate-q02", revision: 1, k: "choice", q: "`dnorm(mu_grid, 0, 4)`を`dnorm(mu_grid, 3, 1)`へ変え、同じデータで更新すると、事後分布はどう変わりやすいですか?", opts: ["必ず3点になる", "3点側へ動き、より狭いpriorの影響を受ける", "標本平均だけで決まるので変わらない"], ans: 1, why: "priorの中心と広がりが変われば事後にも影響します。ただし尤度が非常に鋭ければ、変化は小さいことがあります。", hint: "データ後もpriorを完全に捨てるわけではありません。" },
    { id: "imitate-q03", revision: 1, k: "reflect", q: "休憩あり−なしの母平均差について、モデルに条件づく不確実性を含む結果文を1〜2文で書いてください。", minLength: 55, rubric: ["muが休憩あり−なしの母平均差であることを示している", "モデルとデータに条件づく表現を含めている", "信用区間または実用上の閾値を超える確率を含めている"], example: "参加者内差を正規分布で表したこのモデルでは、休憩あり−なしの母平均差muの事後中央値と90%信用区間を報告する。これは指定したpriorとこの24人のデータに条件づく要約である。" },
    { id: "imitate-q04", revision: 1, k: "reflect", q: "得点尺度が0〜20点なのに`mu ~ Normal(0, 100)`を「無情報prior」と呼んだ研究者へ、短いレビューコメントを書いてください。", minLength: 55, rubric: ["priorの尺度を得点尺度と結び付けている", "広いpriorが中立性を保証しないと説明している", "事前予測または根拠の提示を求めている"], example: "0〜20点の尺度で100点規模の差を許す根拠と、そのpriorが作る複製得点を示してください。広いpriorであることは、現実的または中立である証拠ではありません。" },
    { id: "imitate-q05", revision: 1, k: "choice", q: "休憩を自分で選んだ人ほど高得点だったとき、事後分布から「休憩を強制すれば全員の得点が上がる」と言えますか?", opts: ["言える。事後分布が不確実性をすべて扱うから", "言えない。自己選択などの交絡はベイズ更新だけでは消えない", "言える。90%信用区間が正なら因果である"], ans: 1, why: "ベイズ更新は指定した観測モデル内の不確実性を表します。自己選択、疲労、課題難易度などの交絡を消すには、設計や追加の因果仮定が必要です。", hint: "関連を推定することと、介入の因果効果を識別することを分けます。" },
  ],
  practice: {
    title: "成果物チェック",
    intro: "計算結果だけでなく、更新前・データ・更新後の対応と解釈範囲を残します。",
    items: [
      { id: "updating-plot", label: "ベイズ更新の図", criterion: "同じ未知量についてprior・尤度・posteriorを区別して示す" },
      { id: "posterior-summary", label: "事後分布の要約", criterion: "中心、区間、研究上の閾値を超える確率のうち必要な量を示す" },
      { id: "bounded-conclusion", label: "限定つきの結論", criterion: "モデル・prior・データへの条件づけと、因果として言えない範囲を書く" },
    ],
  },
  challenge: {
    title: "二つのデータを順番に更新する",
    scenario: "同じ成功確率について、午前に10回中7回、午後に10回中9回の成功を観測しました。",
    task: "格子近似で午前のposteriorを求め、それを午後のpriorとして更新してください。20回中16回を一度に使う更新とも比較し、結果が一致する条件を説明してください。",
    hints: ["更新後の重みを次の更新前の重みに使います。", "二つのデータが同じparameterへ条件付き独立に寄与するかを確認します。"],
    rubric: ["午前のposteriorを午後のpriorとして使っている", "一括更新との一致を数値または図で確かめている", "同じparameterと条件付き独立の仮定を述べている"],
    example: "同じpと条件付き独立を仮定すれば、prior×午前尤度×午後尤度なので更新順によらず20回中16回の一括更新と一致する。午前と午後でpが変わるなら、このまとめ方自体を見直す。",
  },
};
