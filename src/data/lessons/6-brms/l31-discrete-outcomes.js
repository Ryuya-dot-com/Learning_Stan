export default {
  id: "l31",
  title: "二値・順序・件数の応答を選ぶ",
  tag: "Bernoulli・順序logit・offset",
  pages: [
    {
      t: "応答が取り得る値から始める",
      b: [
        "このレッスンでは、二値・順序・件数の応答を支持範囲に合う尤度と予測へ対応付け、結果の尺度を選んで報告できるようになります。",
        "正答`correct`は0か1、疲労評定`rating`は1〜5の順序、注意逸脱`lapses`は0以上の整数です。どれも数値として保存できても、同じ正規分布から生まれた連続量とは限りません。応答がどう生じ、何を予測したいかを先に書きます。",
      ],
      code: "# 先にダウンロードしたstep5_data.RをProject直下から読み込む\nsource(\"step5_data.R\")\nlibrary(brms)\n\nlogit_priors <- c(\n  prior(normal(0, 1.5), class = Intercept),\n  prior(normal(0, 1), class = b),\n  prior(exponential(1), class = sd)\n)\n\nfit_acc <- brm(\n  correct ~ condition + (1 | participant),\n  data = trials, family = bernoulli(link = \"logit\"),\n  prior = logit_priors, seed = 2026\n)\n\nfit_rating <- brm(\n  rating ~ condition + (1 | participant),\n  data = ratings, family = cumulative(link = \"logit\"),\n  prior = logit_priors, seed = 2026\n)",
      a: ["二値のlogit係数は確率が常に同じだけ増える値ではありません。順序モデルはカテゴリの順序を使いますが、1から2と4から5の間隔が等しいとは仮定しません。どちらも条件ごとの予測確率へ戻して読みます。"],
    },
    {
      t: "件数は、見ていた長さも必要",
      b: ["10分で2回と40分で4回の注意逸脱は、同じ率ではありません。観察時間が異なる件数では、既知の曝露量をoffsetにして時間あたりの率を比べます。Poissonは平均と分散が同程度という出発点です。PPCでばらつきや零の数を再現できなければ、負の二項や未モデル化の構造を検討します。"],
      code: "count_priors <- c(\n  prior(normal(log(2), 1), class = Intercept),\n  prior(normal(0, 0.5), class = b)\n)\n\nfit_pois <- brm(\n  lapses ~ condition + offset(log(observation_minutes)),\n  data = counts, family = poisson(),\n  prior = count_priors, seed = 2026\n)\n\nfit_nb <- brm(\n  lapses ~ condition + offset(log(observation_minutes)),\n  data = counts, family = negbinomial(),\n  prior = c(count_priors, prior(exponential(1), class = shape)),\n  seed = 2026\n)\n\npp_check(fit_pois, type = \"stat\", stat = \"sd\")",
      a: ["offsetの係数は推定しません。観察時間が二倍なら、率が同じとき期待件数も二倍です。過分散が疑われても、zero-inflatedモデルを自動的に選ぶのではなく、観測過程とPPCを確かめます。"],
    },
    {
      t: "係数だけで止まらず、応答尺度へ戻る",
      b: ["研究で知りたいのが正答確率、評定カテゴリの割合、1時間あたりの件数なら、その尺度で予測を示します。二値を参加者平均にして正規回帰へ渡すと、試行数による情報量の違いと二値の生成過程を失いやすくなります。"],
      code: "conditional_effects(fit_acc)\nconditional_effects(fit_rating, categorical = TRUE)\n\n# 観察時間を明示した件数予測を作る\nnew_counts <- data.frame(\n  condition = c(\"A\", \"B\"),\n  observation_minutes = c(30, 30)\n)\nposterior_epred(fit_nb, newdata = new_counts)",
      a: ["同じ30分という曝露量にそろえた予測なら、条件間の率の違いを比較しやすくなります。尤度を選ぶだけで因果性、欠測、参加者差が解決するわけではありません。"],
    },
  ].map((page) => page.code ? {
    ...page,
    verify: page.verify ?? { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
  } : page),
  ex: [
    { k: "choice", q: "0/1の正答`correct`をBernoulliモデルで扱うとき、最も適切なデータ制約はどれですか。", opts: ["整数で0または1", "任意の実数", "整数で1〜5", "必ず平均0・分散1"], ans: 0, why: "Bernoulli観測の支持範囲は0と1です。fitの前に値域を確認します。", hint: "正答・誤答を何通りの値で記録しているか考えます。" },
    { k: "choice", q: "offset以外が同じで、観察時間が30分から60分へ二倍になりました。Poissonモデルの期待件数はどうなりますか。", opts: ["二倍になる", "半分になる", "変わらない", "必ず0になる"], ans: 0, why: "log offsetは既知の曝露量を表します。率が同じなら、観察時間が二倍で期待件数も二倍です。", hint: "件数は率と観察時間の積として考えます。" },
    { k: "reflect", q: "1〜5の疲労評定について、平均評定だけでなくカテゴリ確率も報告する理由を書いてください。", minLength: 70, rubric: ["順序は使えるがカテゴリ間隔が等しいとは限らないと述べている", "条件別の各カテゴリ確率が応答分布を示すと述べている", "平均だけでは異なる分布を隠し得ることに触れている"], example: "1〜5は順序を持つが、隣り合う数値の間隔が同じとは限らない。条件別のカテゴリ確率を示せば、平均が似ていても高い評定へ移るのか、両端が増えるのかを区別できる。" },
    { k: "reflect", q: "次の件数モデルをレビューしてください。実行前に止めるべき行と理由を説明してください。", code: "counts$observation_minutes <- c(10, 0, 30, -5)\nbrm(lapses ~ condition + offset(log(observation_minutes)),\n    data = counts, family = poisson())", lang: "R", minLength: 70, rubric: ["0または負の観察時間では`log()`が使えないと指摘している", "曝露量が正であることを検査する提案をしている", "削除だけでなく記録・原因確認に触れている"], example: "0と−5は`log(observation_minutes)`を計算できないのでfit前に止める。観察時間が正かを検査し、入力ミス、未観察、記録単位のどれかを問題として記録してから処理を決める。" },
    { k: "reflect", q: "条件Bの予測正答確率が条件Aより高いことを示すモデルが得られました。「Bは学習効果がある」と書けるか説明してください。", minLength: 70, rubric: ["予測確率がモデル上の関連または差であると述べている", "因果主張には割付け・交絡などの根拠が必要と述べている", "尤度の選択と因果識別を区別している"], example: "予測正答確率の差だけでは、Bが学習を生んだとは言えない。応答の尤度を適切にしたことと、条件割付けや交絡を扱って因果効果を識別することは別である。" },
  ].map((exercise) => exercise.code ? {
    ...exercise,
    verify: exercise.verify ?? { mode: "manual", reason: "レビュー用または環境依存のコードを確認するため" },
  } : exercise),
  practice: { title: "成果物チェック", intro: "応答の型、値域、予測する尺度を一組として残します。", items: [
    { id: "response-contract", label: "応答の契約", criterion: "二値・順序・件数のいずれかについて、取り得る値、1行の意味、除外前の検査を記録する" },
    { id: "family-candidate", label: "family候補の比較", criterion: "候補familyと、その候補が表す観測過程を一文ずつ書く" },
    { id: "response-scale-prediction", label: "応答尺度の予測", criterion: "確率、カテゴリ確率、または同じ曝露量での期待件数として予測を示す" },
  ] },
  practiceLadder: { title: "4段階の反復練習", intro: "今回くり返す技能は「取り得る値から尤度と予測尺度を選ぶこと」です。各段階は、実際にRで確かめてからチェックしてください。", steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "二値、順序、件数の三つのformulaを読み、応答の値域を確認します。", criterion: "各familyを応答の取り得る値と結び付けられたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "Poissonをnegative binomialへ一つだけ替え、offsetを残したままPPCを比べます。", criterion: "変えた分散仮定と変えなかった曝露量の扱いを説明できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "0/1列の値域を検査し、Bernoulli formulaと確率予測を書きます。", criterion: "fit前の値域検査とfit後の確率尺度をそろえられたら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "病欠日数と在籍日数のデータで、offsetの妥当性とPPC統計量を設計します。", criterion: "件数だけでなく曝露量と一定率の仮定を検討できたら完了です。" },
  ] },
  challenge: { title: "平均が同じ二つの順序分布", scenario: "二条件の平均疲労評定がどちらも3.0でした。", task: "平均は同じでも意味が異なる二つのカテゴリ分布を作り、積み上げ図と報告文を設計してください。", hints: ["片方は中間カテゴリに集中させます。", "もう片方は両端カテゴリを増やします。", "平均値だけで言えないことを書きます。"], rubric: ["二つの分布の違いが明確である", "カテゴリ確率を使う理由を説明している", "平均だけから過剰な結論を出していない"], example: "両条件の平均が3でも、片方は全員が3、もう片方は1と5に分かれるかもしれない。順序モデルのカテゴリ確率なら、この違いを条件ごとに示せる。" },
};
