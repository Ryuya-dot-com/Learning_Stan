export default {
  id: "l30",
  title: "反復測定と部分プーリング",
  tag: "階層モデル・参加者差・予測対象",
  pages: [
    {
      t: "同じ人の試行は独立ではない",
      b: [
        "このレッスンでは、参加者内試行の階層構造を式と`brms`のformulaに対応付け、部分プーリングが必要な理由を説明できるようになります。",
        "各参加者が条件A・Bを20試行ずつ行ったとします。1行は1試行でも、同じ参加者の試行は似ています。参加者ごとに基準反応時間と条件差が異なる可能性を、全参加者の分布と一緒に表します。",
      ],
      code: "# 先にダウンロードしたstep5_data.RをProject直下から読み込む\nsource(\"step5_data.R\")\nlibrary(brms)\n\n# y_ij ~ Normal(alpha + a_j + (beta + b_j) * condition_ij, sigma)\n# a_j, b_j は参加者ごとのずれ\n\nrt_priors <- c(\n  prior(normal(550, 150), class = Intercept),\n  prior(normal(0, 75), class = b),\n  prior(exponential(1.0 / 100), class = sigma),\n  prior(exponential(1.0 / 100), class = sd),\n  prior(lkj(2), class = cor)\n)\n\nfit <- brm(\n  rt_ms ~ condition + (1 + condition | participant),\n  data = trials, family = gaussian(), prior = rt_priors,\n  backend = \"cmdstanr\", chains = 4, seed = 2026\n)",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["`(1 + condition | participant)`は、参加者ごとの切片と条件効果を許します。個人の推定は、その人の試行だけでなく全体の参加者分布からも情報を借ります。ここでは階層構造に焦点を絞り、反応時間に合う分布はあとであらためて検討します。"],
    },
    {
      t: "縮小は個人差を消すことではない",
      b: ["試行が少ない人の推定ほど、たまたまの極端な値に引かれやすくなります。階層モデルでは、その不確実な推定を全体分布へ適度に近づけます。これを部分プーリングと呼びます。全員を同じにするcomplete poolingとも、各人を完全に別々に推定するno poolingとも異なります。"],
      code: "ranef(fit)$participant\nconditional_effects(fit, effects = \"condition\")\npp_check(fit, type = \"stat_grouped\", group = \"participant\", stat = \"mean\")",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["`ranef()`は全体効果からの参加者別のずれを確認します。参加者ごとの平均を使ったPPCは、全体の図だけでは隠れる個人レベルの失敗を見つける助けになります。"],
    },
    {
      t: "誰を予測するかで使う情報が変わる",
      b: ["既に測定した参加者の次の試行を予測するなら、その人の観測済み情報を使えます。まだ会っていない参加者を予測するなら、その人固有の効果は分からないので、参加者分布から新たに生成します。予測図や交差検証の単位は、この違いに合わせます。"],
      code: "# 既存参加者: その人の参加者効果を使える\nexisting_trials <- trials[1:2, ]\nposterior_predict(fit, newdata = existing_trials)\n\n# 新参加者: 同じIDの行には同じ参加者効果を使う\nnew_trials <- existing_trials\nnew_trials$participant <- \"new-person\"\nposterior_predict(fit, newdata = new_trials,\n  allow_new_levels = TRUE, sample_new_levels = \"gaussian\")",
      verify: { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
      a: ["random interceptを入れても、順序効果、刺激差、欠測、因果性が自動で解決するわけではありません。必要なら、それぞれの観測過程を式へ加えるか、設計で扱います。"],
    },
  ],
  ex: [
    { id: "l30-q01", revision: 1, k: "choice", q: "`rt_ms ~ condition + (1 + condition | participant)`で、参加者jの条件効果を表すのに最も近いものはどれですか。", opts: ["全体の条件効果と参加者jのずれの和", "残差`sigma`だけ", "参加者jの切片だけ", "R-hat"], ans: 0, why: "varying slopeを含むので、参加者jの条件効果は全体の傾きにその人の傾きのずれを加えたものです。", hint: "`1 + condition`のうち、conditionがどの効果に対応するか考えます。" },
    { id: "l30-q02", revision: 2, k: "choice", q: "各条件に少数の試行がある参加者の条件効果を、no poolingと階層モデルで推定しました。階層モデルの推定は一般にどこへ近づきやすいですか。", opts: ["全参加者の条件効果の分布", "必ず0", "その参加者の観測値だけ", "最も試行数の多い参加者の値そのもの"], ans: 0, why: "情報が少ない参加者ほど全体分布から強く情報を借ります。ただし全員が同じ推定値になるわけではありません。1試行だけでは個人の切片と条件差を分けて学習できず、事後分布を得られても群分布と事前分布への依存が強くなります。", hint: "部分プーリングでは、少ない情報をどこから補うか考えます。" },
    { id: "l30-q03", revision: 1, k: "reflect", q: "新参加者の次の試行を予測するとき、既存参加者の参加者別drawをそのまま使えない理由を説明してください。", minLength: 70, rubric: ["新参加者には観測済みの個人効果がないと述べている", "群レベルの分布から新しい効果を生成する必要に触れている", "既存参加者の予測とは別の予測課題だと区別している"], example: "新参加者には、その人の過去試行から推定した切片や条件効果がない。したがって既存参加者の個人効果を流用せず、参加者全体の分布から新しいずれを生成する。これは既存参加者の次試行を予測する問いとは異なる。" },
    { id: "l30-q04", revision: 1, k: "reflect", q: "次のformulaをレビューしてください。参加者内の条件差を参加者ごとに推定したい場合、何が足りませんか。", code: "brm(rt_ms ~ condition + (1 | participant),\n    data = trials, family = gaussian())", lang: "R", minLength: 70, rubric: ["participantごとの切片だけが入っていると指摘している", "参加者ごとの条件効果にはvarying slopeが必要と述べている", "`(1 + condition | participant)`または同等の式を提案している"], example: "この式は参加者ごとの基準反応時間は許すが、条件効果は全員で同じと仮定する。参加者別の条件差を扱うなら`(1 + condition | participant)`のようにconditionのvarying slopeを加える。" },
    { id: "l30-q05", revision: 1, k: "reflect", q: "反復測定の階層モデルで条件差の事後分布が得られました。「条件が反応時間を因果的に変えた」と書けるか説明してください。", minLength: 70, rubric: ["階層モデルが依存構造を扱うことを述べている", "因果性は割付けや交絡などの設計・仮定に依存すると述べている", "モデル構造だけで因果識別にならないと区別している"], example: "階層モデルは同じ参加者の試行が似る構造を表すが、それだけで因果効果を識別しない。条件の無作為化、順序効果、交絡の扱いなど設計と仮定が別に必要である。" },
  ].map((exercise) => exercise.code ? {
    ...exercise,
    verify: exercise.verify ?? { mode: "manual", reason: "レビュー用または環境依存のコードを確認するため" },
  } : exercise),
  practice: { title: "成果物チェック", intro: "参加者という階層を、式・図・予測対象で一貫して扱います。", items: [
    { id: "hierarchical-formula", label: "階層formula", criterion: "1行の意味、群変数、切片・傾きのどちらを変動させるかをコメントとともに書く" },
    { id: "participant-ppc", label: "参加者別PPC", criterion: "全体ではなく参加者ごとの特徴を一つ選んで観測値と複製値を比べる" },
    { id: "prediction-target", label: "予測対象メモ", criterion: "既存参加者か新参加者かを明記し、使える情報がなぜ異なるかを書く" },
  ] },
  practiceLadder: { title: "4段階の反復練習", intro: "今回くり返す技能は「反復測定の単位を式と予測対象へつなぐこと」です。各段階は、実際にRで確かめてからチェックしてください。", steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "varying interceptとvarying slopeを含むfitを実行し、参加者別の出力を見ます。", criterion: "各項が全体効果か参加者別のずれかを説明できたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "`(1 | participant)`を`(1 + condition | participant)`へ替えます。", criterion: "増えたparameterと、追加した研究上の仮定を説明できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "別の反復測定データで、群変数を含むformulaと参加者別PPCを書きます。", criterion: "1行の意味とgrouping variableを取り違えなければ完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "参加者と刺激が交差する課題で、二つの群構造と新しい参加者・新しい刺激の予測を設計します。", criterion: "二つの階層と予測対象を別々に書けたら完了です。" },
  ] },
  challenge: { title: "三つのプーリングを比べる", scenario: "各参加者が両条件を経験し、各条件の試行数が2〜20と異なる反応時間データがあります。", task: "complete pooling、no pooling、部分プーリングの予測を同じ図に置く計画を作り、どの参加者で縮小が大きいと予想するかを説明してください。", hints: ["横軸は試行数、縦軸は参加者別の条件差にします。", "極端な値が必ず誤りとは限りません。", "縮小の大きさと不確実性を区別します。"], rubric: ["三つのモデルの情報共有の違いを説明している", "試行数と縮小の関係を述べている", "個人差を消す処理と誤解していない"], example: "試行数が少ない参加者ほどno poolingの推定が不安定で、階層モデルでは全体分布へ近づきやすい。これは個人差を0にするのではなく、限られた情報の不確実性を反映することだ。" },
};
