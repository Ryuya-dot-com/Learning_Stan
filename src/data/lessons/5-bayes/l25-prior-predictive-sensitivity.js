// STEP 4: 事前予測と感度分析
const ladder = {
  title: "4段階の反復練習",
  intro: "今回くり返す技能は「尺度に合うpriorを置き、予測と感度分析で確かめること」です。各段階は、実際にRで確かめてからチェックしてください。",
  steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "`prior_fit`を実行し、複製得点に0〜100外の値があるか記録します。", criterion: "データ前の予測であり、観測値に合わせる図ではないと説明できたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "betaのpriorだけを`normal(0, 2)`と`normal(0, 10)`へ替え、事前予測の線の広がりを比べます。", criterion: "変えていないintercept、sigma、観測モデルを明記できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "別の連続応答について、中心化、`get_prior()`、三つのproper prior、`sample_prior = " + '"only"' + "`を書きます。", criterion: "エラー時にparameter class名と全parameterにproper priorがあるかを確認できたら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "0〜10のLikert尺度を正規尤度で分析する案について、事前予測で見る点と別の生成過程を設計します。", criterion: "支持範囲、カテゴリの順序、複製値を結び付けて説明できたら完了です。" },
  ],
};

export default {
  id: "l25",
  title: "priorを予測で確かめる",
  tag: "prior predictive・sensitivity",
  practiceLadder: ladder,
  pages: [
    {
      t: "priorは尺度と予測で考える",
      b: [
        "60人について、前夜の睡眠時間`sleep_h`と翌日の注意得点`score`（0〜100点）を測ったとします。8時間を引いた`sleep_c`を使うと、interceptは8時間睡眠時の平均得点になります。",
        "連続応答の出発点として、`score[i] ~ Normal(alpha + beta * sleep_c[i], sigma)`を考えます。alphaは8時間時の平均、betaは睡眠1時間あたりの平均差、sigmaは同じ睡眠時間でも残る個人差・測定差です。",
        "このレッスンでは、応答と予測子の単位に照らしてproperなpriorを指定し、事前予測と代替priorで結論の頑健さを点検・記録できるようになります。",
      ],
      code: `dat <- data.frame(
  sleep_h = c(6.5, 8, 9, 7, 8.5),
  score = c(63, 72, 76, 66, 74)
)
dat$sleep_c <- dat$sleep_h - 8
dat`,
      out: `  sleep_h score sleep_c
1     6.5    63    -1.5
2     8.0    72     0.0
3     9.0    76     1.0
4     7.0    66    -1.0
5     8.5    74     0.5`,
      a: ["中心化はデータの因果性を変えませんが、interceptを研究上意味のある値にし、priorの尺度を考えやすくします。"],
    },
    {
      t: "データを見る前に平均の線を描く",
      b: [
        "たとえばalphaをNormal(70, 15)、betaをNormal(0, 5)、sigmaをExponential(1/15)と置きます。betaの5は「睡眠1時間あたり数点の差は許すが、20点差は強い根拠なしには中心から遠い」という尺度上の宣言です。",
        "まずpriorからparameterを描き、睡眠時間ごとの平均得点を線にします。この段階では観測したscoreへ合わせません。線は平均の候補であり、一人ひとりの得点の散らばりはまだ含みません。",
      ],
      code: `library(brms)

priors <- c(
  set_prior("normal(70, 15)", class = "Intercept"),
  set_prior("normal(0, 5)", class = "b"),
  set_prior("exponential(1/15)", class = "sigma")
)
prior_fit <- brm(
  score ~ sleep_c, data = dat, family = gaussian(), prior = priors,
  sample_prior = "only", chains = 4, iter = 1000, seed = 123
)

new_dat <- data.frame(sleep_h = seq(4, 12, length.out = 50))
new_dat$sleep_c <- new_dat$sleep_h - 8
prior_means <- posterior_epred(
  prior_fit, newdata = new_dat, ndraws = 50
)
matplot(
  new_dat$sleep_h, t(prior_means), type = "l", lty = 1,
  col = adjustcolor("steelblue", alpha.f = 0.15),
  xlab = "睡眠時間", ylab = "平均得点"
)
abline(h = c(0, 100), lty = 2)`,
      verify: { mode: "manual", reason: "brms・Stan環境と乱数を使う事前予測の例のため" },
      a: ["50本の線は、priorが許す平均関係です。0〜100点から大きく外れる線が多ければ、どのparameterのpriorが原因かを調べます。ただし平均の線だけでは、sigmaが作る個々の得点の散らばりは点検できません。"],
    },
    {
      t: "個々の複製得点が尺度に合うかを見る",
      b: [
        "次に、平均の周りの散らばりも含む複製得点を作ります。`pp_check()`の複数の細い線は、priorと観測モデルから生成した仮想データです。強調された線は参考として表示される観測データであり、priorの更新には使われていません。",
        "平均の線が妥当でも複製得点が広すぎるなら、傾きよりsigmaのpriorが原因かもしれません。図が不自然だという事実と、どの仮定を変えるかを分けて考えます。",
      ],
      code: `pp_check(prior_fit, type = "dens_overlay", ndraws = 50)`,
      verify: { mode: "manual", reason: "brms・Stan環境と乱数を使う事前予測の例のため" },
      a: ["この図はparameterそのものではなく、priorから描いたparameterと観測モデルで生成した複製得点を示します。`sample_prior = \"only\"`では観測データによる更新を行いません。0点未満や100点超が頻繁なら、prior、正規の観測モデル、得点尺度を見直します。"],
    },
    {
      t: "代替priorで結論の依存性を調べる",
      b: [
        "感度分析は、妥当と考える別の仮定へ一度に一つずつ替え、主要な事後量がどの程度変わるかを調べることです。結果が変わっても失敗ではありません。データだけで識別しにくいことや、仮定が結論に重要であることが分かります。",
        "最初に`get_prior()`で、どのparameter classにpriorを置けるかを確認します。default priorがあることは、priorの影響がないという意味ではありません。",
      ],
      code: `wide_priors <- c(
  set_prior("normal(70, 30)", class = "Intercept"),
  set_prior("normal(0, 10)", class = "b"),
  set_prior("exponential(1/30)", class = "sigma")
)
fit_a <- update(prior_fit, sample_prior = "no", prior = priors)
fit_b <- update(prior_fit, sample_prior = "no", prior = wide_priors)
posterior_summary(fit_a, pars = "b_sleep_c")
posterior_summary(fit_b, pars = "b_sleep_c")`,
      verify: { mode: "manual", reason: "MCMCによる感度分析であり、出力は乱数と実行環境に依存するため" },
      a: ["二つのfitで近いなら、この範囲の合理的なprior変更には頑健と限定して書けます。違うなら、どのpriorをどの根拠で採用するか、または結論の不確実性をどう報告するかを検討します。"],
    },
  ],
  ex: [
    { k: "choice", q: "得点が0〜100点、睡眠時間が通常4〜12時間のとき、betaへ`normal(0, 50)`を置く前に最もよい行動はどれですか?", opts: ["とにかくfitしてR-hatだけを見る", "betaの単位を確認し、prior predictiveで得点と傾きを描く", "betaを必ず0へ固定する", "標本平均をprior平均にする"], ans: 1, why: "50は睡眠1時間あたり50点の差を意味します。許容する含意を、応答の単位と事前予測で確認します。", hint: "数値の大きさだけでなく、係数が持つ単位を考えます。" },
    { k: "choice", q: "`normal(0, 5)`から`normal(0, 1)`へbetaのpriorだけを替えると、事前予測の回帰線はどう変わりやすいですか?", opts: ["傾きが0付近へ集中し、極端な傾きが減る", "得点が必ず70点になる", "sigmaが必ず小さくなる"], ans: 0, why: "変更したのは傾きbetaのpriorだけです。interceptやsigmaを直接変える設定ではありません。", hint: "どのparameter classを変更したかに注目します。" },
    { k: "reflect", q: "prior predictiveで120点の複製得点が少数、−20点が多数出ました。次に調べることを二つ書いてください。", minLength: 55, rubric: ["priorの尺度を調べる提案がある", "正規尤度と得点の支持範囲の関係を検討している", "別familyや別の生成過程を具体的に候補にしている"], example: "interceptとsigmaのpriorが複製得点をどの程度広げているかを分けて調べる。得点が上下限に張り付く観測過程なら、正規尤度以外の生成過程も候補にする。" },
    { k: "reflect", q: "「default priorを使ったのでpriorの影響はない」と書いた報告へ、短いレビューコメントを書いてください。", minLength: 55, rubric: ["defaultが影響ゼロの証拠でないと述べている", "parameter classまたはpriorの尺度の確認を求めている", "事前予測または代替priorとの比較を求めている"], example: "default priorについても、データ尺度での意味、properかどうか、事前予測を示してください。少なくとも一つの合理的な代替priorで、主要な事後量がどう変わるかも確認してください。" },
    { k: "choice", q: "二つの合理的なpriorでP(beta > 0 | data)がともに0.97でした。ここから「睡眠を1時間増やす介入は得点を改善する」と書けますか?", opts: ["書ける。prior感度が低いから", "書けない。これは観測された睡眠と得点の条件付き関連であり、因果には別の仮定が要る", "書ける。0.97は95%より大きいから"], ans: 1, why: "priorへの頑健性は重要ですが、交絡や逆因果を解決しません。介入効果には研究設計と因果仮定が必要です。", hint: "関連の推定と、介入の効果の推定を分けます。" },
  ],
  practice: {
    title: "成果物チェック",
    intro: "priorの数値を並べるだけでなく、単位・予測・比較結果を一組で残します。",
    items: [
      { id: "prior-rationale", label: "priorの根拠メモ", criterion: "intercept・傾き・sigmaの単位と、許す範囲を書く" },
      { id: "prior-predictive-check", label: "事前予測の点検", criterion: "複製値の範囲を応答尺度と比べ、見直す仮定を記録する" },
      { id: "sensitivity-table", label: "感度分析の比較表", criterion: "一度に一つのpriorを変え、主要な事後量と結論の変化を比べる" },
    ],
  },
  challenge: {
    title: "結論が変わるpriorの範囲を探す",
    scenario: "主要な結論を`P(beta < 0 | data) > 0.95`と定めました。弱いpriorでは0.97、やや強い0中心priorでは0.91でした。",
    task: "priorの標準偏差を一度に一つずつ変える感度分析を設計し、どの結果を表に残せば『頑健／依存的』を判断できるか説明してください。",
    hints: ["prior、事前予測、主要事後量、診断を同じ行にします。", "0.95を超えた設定だけを選んで報告しません。"],
    rubric: ["変更するparameterを一つに固定している", "事前予測と主要事後量を両方比較している", "閾値をまたぐ結果を隠さずprior依存として報告している"],
    example: "傾きpriorの中心を0に保ち、標準偏差だけを段階的に変える。各設定で事前予測の範囲、P(beta < 0 | data)、区間、診断を並べる。0.95をまたぐなら、方向の結論はpriorに依存すると報告する。",
  },
};
