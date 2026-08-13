export default {
  id: "l28",
  title: "prior predictiveと感度分析",
  tag: "尺度・proper prior・頑健さ",
  pages: [
    {
      t: "priorは単位を持つ仮定",
      b: [
        "このレッスンでは、応答と予測子の単位に照らしてproperなpriorを指定し、事前予測と感度分析で仮定を点検できるようになります。",
        "睡眠時間`sleep_h`と注意得点`score`（0〜100点）を考えます。`sleep_c = sleep_h - 8`とすると、interceptは8時間睡眠の平均得点、傾きは睡眠1時間あたりの平均差です。`normal(0, 50)`という傾きのpriorは、1時間で50点差も許すという意味になります。数式の広さではなく、予測の現実性で考えます。",
      ],
      code: "# 先にダウンロードしたstep5_data.RをProject直下から読み込む\nsource(\"step5_data.R\")\nlibrary(brms)\n\ndat$sleep_c <- dat$sleep_h - 8\n\npriors <- c(\n  set_prior(\"normal(70, 15)\", class = \"Intercept\"),\n  set_prior(\"normal(0, 5)\", class = \"b\"),\n  set_prior(\"exponential(1 / 15)\", class = \"sigma\")\n)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["properなpriorは確率分布として正規化できるpriorです。事前予測を行うには、必要なparameterにproperなpriorを置きます。"],
    },
    {
      t: "データを見る前に、複製値を見る",
      b: [
        "事前予測では、priorからparameterを引き、そこから仮想データを作ります。観測値へ合わせ込むための操作ではありません。0〜100点の得点なのに負の値や150点が頻繁に出るなら、prior、尤度、尺度の扱いを見直すきっかけになります。",
      ],
      code: "prior_fit <- brm(\n  score ~ sleep_c, data = dat, family = gaussian(),\n  prior = priors, sample_prior = \"only\",\n  chains = 4, iter = 1000, seed = 2026\n)\n\npp_check(prior_fit, type = \"dens_overlay\")",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["`sample_prior = \"only\"`では尤度で更新せず、priorから複製データを作ります。このfitの`pp_check()`は、データ後の適合ではなく、事前の含意を確かめる図です。"],
    },
    {
      t: "代替priorでも問いに答える",
      b: ["感度分析では、研究上もっともらしい別のpriorを置き、主要な事後量と予測がどれほど変わるかを比べます。結論が変われば失敗ではありません。データだけでどこまで識別できるかが分かります。"],
      code: "wide_priors <- c(\n  set_prior(\"normal(70, 30)\", class = \"Intercept\"),\n  set_prior(\"normal(0, 10)\", class = \"b\"),\n  set_prior(\"exponential(1 / 30)\", class = \"sigma\")\n)\n\nfit_a <- update(prior_fit, sample_prior = \"no\", prior = priors)\nfit_b <- update(prior_fit, sample_prior = \"no\", prior = wide_priors)\nposterior_summary(fit_a, pars = \"b_sleep_c\")\nposterior_summary(fit_b, pars = \"b_sleep_c\")",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["「defaultを使ったから影響はない」とは言えません。`get_prior()`でparameter classを確認し、なぜその範囲を比較したか、予測と結論がどう変わったかを記録します。"],
    },
  ],
  ex: [
    { k: "choice", q: "`sample_prior = \"only\"`の主な目的はどれですか。", opts: ["priorから仮想の応答を生成して含意を確かめる", "観測値を二度使って係数を安定させる", "divergenceを必ず消す", "因果効果を識別する"], ans: 0, why: "事前予測では尤度による更新前に、priorと尤度の組合せがどんな値を作るかを調べます。", hint: "観測データで更新する前に何を見たいか考えます。" },
    { k: "choice", q: "傾きのpriorを`normal(0, 5)`から`normal(0, 1)`へ替え、ほかを同じにしました。事前予測の回帰線はどう変わりやすいですか。", opts: ["傾きが0付近へより集中し、極端な線が減る", "得点が必ず70点になる", "残差が必ず0になる", "観測値が増える"], ans: 0, why: "傾きのpriorだけを狭めると、許す傾きの範囲が0付近へ集中します。interceptや残差を直接固定するものではありません。", hint: "変更したのは傾き`b`のpriorだけです。" },
    { k: "reflect", q: "prior predictiveで−20点と120点の複製得点が多数出ました。次に調べることを二つ書いてください。", minLength: 70, rubric: ["intercept・傾き・sigmaのpriorの尺度を点検している", "正規尤度が得点の支持範囲を越えることを指摘している", "別の応答尺度または生成過程を候補として挙げている"], example: "まずinterceptとsigmaのpriorが得点尺度に対して広すぎないかを分けて確認する。正規尤度は0〜100の範囲を自動では守らないので、境界への張り付き方を調べ、正答数なら二項、順序評定なら順序モデルなどを候補にする。" },
    { k: "reflect", q: "次の分析計画をレビューしてください。何が不足していますか。", code: "fit <- brm(score ~ sleep_c, data = dat)\n# default priorなので、priorの影響は報告しない", lang: "R", verify: { mode: "manual", reason: "レビュー用の不十分な分析計画を含むため" }, minLength: 70, rubric: ["default priorでも尺度とparameter classの確認が必要と指摘している", "事前予測を提案している", "合理的な代替priorによる感度分析を提案している"], example: "default priorもデータ尺度とモデルに依存するので、影響がない根拠にはならない。`get_prior()`で対象を確認し、proper priorで事前予測を行い、少なくとも一つの合理的な代替priorで係数と予測を比べる。" },
    { k: "reflect", q: "代替priorでも`P(b_sleep_c > 0 | y) = 0.97`でした。「睡眠を1時間増やす介入は得点を改善する」と書けるか説明してください。", minLength: 70, rubric: ["事後確率が条件付き関連を表すと述べている", "交絡または逆因果の可能性に触れている", "介入効果には別の設計・仮定が必要と区別している"], example: "この値は指定した観察モデルで睡眠と得点が正に関連する確率である。睡眠を増やす介入の効果には、交絡や逆因果を扱う設計と仮定が別に必要なので、そのまま因果効果とは書けない。" },
  ].map((exercise) => exercise.code ? {
    ...exercise,
    verify: exercise.verify ?? { mode: "manual", reason: "レビュー用または環境依存のコードを確認するため" },
  } : exercise),
  practice: { title: "成果物チェック", intro: "priorの数値をただ並べず、予測と比較表として残します。", items: [
    { id: "prior-rationale", label: "priorの根拠メモ", criterion: "各priorについて、parameterの単位と許す範囲を一文で書く" },
    { id: "prior-predictive-plot", label: "事前予測図", criterion: "予測の範囲と、現実的でない値があるかを記録する" },
    { id: "sensitivity-summary", label: "感度分析の要約", criterion: "二つ以上のpriorで主要な係数または予測を比較し、結論の変化を記す" },
  ] },
  practiceLadder: { title: "4段階の反復練習", intro: "今回くり返す技能は「単位からpriorを考え、予測で点検すること」です。各段階は、実際にRで確かめてからチェックしてください。", steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "上のprior fitを実行し、複製得点の範囲を確認します。", criterion: "予測図がデータ後のPPCではなく事前の含意を示すと説明できたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "傾きのpriorだけを`normal(0, 2)`へ替えて事前予測を比べます。", criterion: "変えなかったinterceptとsigmaの役割を区別できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "別の連続応答で、中心化、`get_prior()`、proper prior、prior fitを書きます。", criterion: "観測値へ合わせる前に予測を作れるなら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "1〜5の順序評定について、何をprior predictiveで見てどのfamilyを候補にするか設計します。", criterion: "数値ラベルを連続量と自動的にみなさず、支持範囲から考えられたら完了です。" },
  ] },
  challenge: { title: "現実的の基準を書く", scenario: "睡眠時間が4〜12時間の人に対する得点モデルを使います。", task: "priorから100本の平均線を作る計画を立て、どの範囲を現実的と判断するかを領域知識とともに文章化してください。", hints: ["平均線と、一人の複製得点を区別します。", "境界を守るためだけに根拠なくpriorを狭めません。", "判定基準はデータを見る前に書きます。"], rubric: ["時間と得点の単位が明記されている", "平均と個人の揺れを分けている", "priorを選ぶ根拠と限界が書かれている"], example: "睡眠4〜12時間で平均線を描き、極端な平均差と個人得点の範囲を別に調べる。許容範囲は先行研究や測定尺度の意味から定め、観測値に合うよう後から都合よく狭めない。" },
};
