export default {
  id: "l27",
  title: "brmsで連続応答を一周する",
  tag: "formula・事後draw・予測",
  pages: [
    {
      t: "研究質問を式へ翻訳する",
      b: [
        "このレッスンでは、連続応答の研究質問を`brms`の式・尤度・priorへ翻訳し、予測として報告できるようになります。",
        "45人について、練習時間`practice_h`、基礎得点`baseline`、翌日の記憶得点`memory`を記録したとします。問いは「基礎得点が同じ人どうしで、練習時間が1時間違うと平均得点はどれだけ違うか」です。自分で練習時間を選んだ観察データなら、ここで答えるのは関連であって介入の効果ではありません。",
        "予測子を中心化すると、interceptは平均的な練習時間・基礎得点における平均得点になります。小さな前処理でも、係数を人に説明しやすくします。",
      ],
      code: "# 先にダウンロードしたstep5_data.RをProject直下から読み込む\nsource(\"step5_data.R\")\nlibrary(brms)\n\ndat$practice_c <- dat$practice_h - mean(dat$practice_h)\ndat$baseline_c <- dat$baseline - mean(dat$baseline)\n\n# memory_i ~ Normal(mu_i, sigma)\n# mu_i = alpha + beta_p * practice_c_i + beta_b * baseline_c_i",
      out: "practice_c = 平均からの練習時間のずれ\nbaseline_c = 平均からの基礎得点のずれ",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: [
        "`beta_p`は、`baseline_c`を同じにしたときの練習1時間あたりの平均得点差です。`sigma`は説明変数を入れても残る個人差や測定の揺れを表します。0〜100点の境界近くへ予測が多く出るなら、正規尤度が適切かを予測チェックで確かめます。",
      ],
    },
    {
      t: "fitして、drawから予測する",
      b: [
        "`brm()`には、何を説明するか、データ、応答の分布、priorを明示します。`get_prior()`で置けるparameterを確認してからpriorを書きます。priorの数値は、得点と時間の単位で意味を考えます。",
      ],
      code: "priors <- c(\n  set_prior(\"normal(70, 15)\", class = \"Intercept\"),\n  set_prior(\"normal(0, 8)\", class = \"b\"),\n  set_prior(\"exponential(1 / 15)\", class = \"sigma\")\n)\n\nfit <- brm(\n  memory ~ practice_c + baseline_c,\n  data = dat, family = gaussian(), prior = priors,\n  chains = 4, iter = 2000, warmup = 1000, seed = 2026\n)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: [
        "推定の出力は一つの正解ではなく、事後分布を表すdrawです。係数表だけで終えず、研究質問に近い`newdata`を作って予測します。",
      ],
    },
    {
      t: "平均の予測と、一人の予測を一図で分ける",
      b: [
        "指定した条件での平均応答と、次に来る一人の得点は同じ問いではありません。前者には`posterior_epred()`、後者には残差の揺れも含む`posterior_predict()`を使います。後者の区間は通常より広くなります。",
        "下の一枚の図では、同じ三つの練習時間を二種類の記号で重ねます。塗りつぶした丸と実線は平均応答、白丸と破線は次に来る一人の得点です。横に少しだけずらすのは、同じ予測点の二本の区間を見分けるためです。",
      ],
      code: "new_dat <- data.frame(\n  practice_c = c(-1, 0, 1),\n  baseline_c = 0\n)\n\nmean_draws <- posterior_epred(fit, newdata = new_dat)\nperson_draws <- posterior_predict(fit, newdata = new_dat)\n\ninterval_90 <- function(draws) {\n  t(apply(draws, 2, quantile, probs = c(.05, .5, .95)))\n}\nmean_90 <- interval_90(mean_draws)\nperson_90 <- interval_90(person_draws)\npractice_h <- new_dat$practice_c + mean(dat$practice_h)\n\ny_lim <- range(mean_90[, c(1, 3)], person_90[, c(1, 3)])\nplot(practice_h, mean_90[, 2], type = \"n\", ylim = y_lim,\n  xlab = \"練習時間（時間）\", ylab = \"予測される記憶得点\"\n)\nsegments(\n  practice_h - 0.04, mean_90[, 1],\n  practice_h - 0.04, mean_90[, 3], lwd = 3\n)\npoints(practice_h - 0.04, mean_90[, 2], pch = 16)\nsegments(\n  practice_h + 0.04, person_90[, 1],\n  practice_h + 0.04, person_90[, 3], lty = 2\n)\npoints(practice_h + 0.04, person_90[, 2], pch = 1, cex = 1.2)\nlegend(\"topleft\",\n  legend = c(\"平均応答\", \"次に来る一人\"),\n  pch = c(16, 1), lty = c(1, 2), bty = \"n\"\n)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: [
        "`baseline_c = 0`は、この標本の平均的な基礎得点を表します。図で破線の区間が広いのは、計算の失敗ではなく、個人ごとの揺れも含めているからです。`newdata`の列名と中心化の基準は、fitした式とそろえます。推定前に事前予測、推定後に計算診断と事後予測チェックを行う流れは、次のレッスン以降で詳しく扱います。",
      ],
    },
  ],
  ex: [
    {
      k: "choice",
      q: "`memory ~ practice_c + baseline_c`で、基礎得点が同じ人の練習1時間あたりの平均差に最も直接対応するparameterはどれですか。",
      opts: ["`b_practice_c`", "`sigma`", "`Intercept`", "`R-hat`"],
      ans: 0,
      why: "`b_practice_c`は練習時間の傾きです。`sigma`は残る揺れ、`Intercept`は両予測子が0のときの平均、R-hatは計算診断です。",
      hint: "式でpractice_cに掛かっている係数を探します。",
    },
    {
      k: "choice",
      q: "同じ`new_dat`に対し、平均予測の90%区間が[68, 76]、一人の予測の90%区間が[48, 94]でした。一人の予測が広い主な理由はどれですか。",
      opts: ["平均の不確実性に加え、個人ごとの残差も含むから", "chain数が4本だから", "中心化すると必ず区間が広がるから", "R-hatが1に近いから"],
      ans: 0,
      why: "`posterior_predict()`は新しい観測値を再生成するため、平均`mu`だけでなく残差の揺れも含みます。",
      hint: "平均そのものと、次の一人の値のどちらに残差が入るか考えます。",
    },
    {
      k: "reflect",
      q: "`b_practice_c`の事後中央値が3.2、90%信用区間が[0.8, 5.7]でした。単位、条件づけ、区間を含む結果文を一文で書いてください。",
      minLength: 70,
      rubric: ["基礎得点を同じにする条件を明記している", "練習1時間と得点の単位を明記している", "事後中央値と90%信用区間を、モデルに条件づく不確実性として示している"],
      example: "この正規回帰モデルでは、基礎得点が同じ参加者で練習時間が1時間長いことに対応する翌日得点差の事後中央値は3.2点、90%信用区間は[0.8, 5.7]点だった。",
    },
    {
      k: "reflect",
      q: "次の予測コードをレビューしてください。何が足りず、どの列を入れるべきですか。",
      code: "new_dat <- data.frame(practice_h = c(1, 2, 3))\nposterior_epred(fit, newdata = new_dat)",
      lang: "R",
      verify: { mode: "manual", reason: "レビュー用の未完成コードを含むため" },
      minLength: 70,
      rubric: ["fitした式が`practice_c`と`baseline_c`を使うことを指摘している", "中心化済みの`practice_c`を作る必要を述べている", "比較したい基礎得点に対応する`baseline_c`を指定している"],
      example: "fitした式は`practice_c`と`baseline_c`を使うので、この`new_dat`だけでは不足する。元の平均を使って`practice_h`から`practice_c`を作り、平均的な基礎得点を比べるなら`baseline_c = 0`も入れる。",
    },
    {
      k: "reflect",
      q: "自主的に長く練習した人ほど高得点で、prior・計算診断・PPCも良好でした。「練習時間を増やす介入が得点を上げる」と結論してよいか説明してください。",
      minLength: 70,
      rubric: ["観察データから得たのは条件付き関連であると述べている", "意欲や事前能力などの交絡候補を一つ以上挙げている", "モデル診断と因果識別は別の根拠を要すると区別している"],
      example: "そのままでは因果効果とは書けない。意欲や事前能力が練習時間と得点の両方に関係するかもしれない。診断とPPCは与えた関連モデルを点検する証拠であり、無作為化などの因果設計を代わりに満たすものではない。",
    },
  ],
  practice: {
    title: "成果物チェック",
    intro: "理解問題とは別に、手元のRで小さなモデルを動かし、問いに沿う出力を残します。",
    items: [
      { id: "model-script", label: "連続応答モデルのスクリプト", criterion: "中心化、formula、family、prior、seedを一つのRスクリプトに記録する" },
      { id: "prediction-table", label: "二種類の予測区間の図", criterion: "同じ予測点で平均応答と一人の予測を区別して示し、どちらがどの問いに答えるかを書く" },
      { id: "result-sentence", label: "限定つきの結果文", criterion: "単位、条件づけ、不確実性、因果として言えない範囲を含める" },
    ],
  },
  practiceLadder: {
    title: "4段階の反復練習",
    intro: "今回くり返す技能は「研究質問を連続応答のformulaと予測へ翻訳すること」です。各段階は、実際にRで確かめてからチェックしてください。",
    steps: [
      { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "中心化、prior、`brm()`、二種類の予測を順に実行します。", criterion: "formulaで使った列と`new_dat`の列を対応付けられたら完了です。" },
      { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "`baseline_c`をformulaから外し、練習時間の傾きと予測を比べます。", criterion: "係数の変化を因果効果の変化と呼ばず、条件づけの違いを説明できたら完了です。" },
      { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "別の連続応答で、中心化から平均予測までを書きます。", criterion: "応答、予測子、family、prior、`newdata`を見ずにそろえられたら完了です。" },
      { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "20問中の正答数を応答にする場合の候補familyと予測を設計します。", criterion: "連続正規モデルを自動的に流用せず、応答の取り得る値から選べたら完了です。" },
    ],
  },
  challenge: {
    title: "誰への予測かを設計する",
    scenario: "学習支援の担当者は、平均的な受講者への施策説明と、次に相談に来る一人への助言を分けて知りたいと考えています。",
    task: "練習時間0〜3時間、基礎得点が平均と平均+1 SDの組合せについて予測表を設計し、どの場面で平均予測と一人の予測を使うかを説明してください。",
    hints: ["`newdata`の各行が誰を表すかを先に文章で決めます。", "中心化の基準はfitしたデータの平均に固定します。", "予測区間の広さを、対象が平均か個人かと結び付けます。"],
    rubric: ["予測する対象と条件が表の行ごとに明確である", "二種類の予測を混同していない", "観察データからの因果主張を避けている"],
    example: "集団プログラムの平均的な見通しには平均予測を、個人への助言には一人の予測を併記する。どちらも観察された関連に条件づくため、練習を増やせば必ず得点が上がるとは述べない。",
  },
};
