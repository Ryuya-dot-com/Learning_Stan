export default {
  id: "l33",
  title: "生成Stanコード・予測単位・回復を確かめる",
  tag: "stancode・新しい人・SBC",
  pages: [
    {
      t: "生成されたStanコードを地図として読む",
      b: [
        "このレッスンでは、生成されたStanコードを観測過程の地図として読み、予測単位とシミュレーションによる回復確認を設計できるようになります。",
        "`brms`はformulaからStanコードを生成します。最初から全行を暗記する必要はありません。dataには観測値・予測子・群index、parametersには推定する量、modelにはpriorと尤度があります。`generated quantities`はdrawごとに追加の量を計算する場所です。予測や観測ごとの対数尤度をここで作る設定もありますが、`brms`の設定によってはR側で必要なときに計算します。役割から対応を読みます。",
      ],
      code: "# 先にダウンロードしたstep5_data.RをProject直下から読み込む\nsource(\"step5_data.R\")\nlibrary(brms)\n\nstan_priors <- c(\n  prior(normal(log(600), 0.5), class = Intercept),\n  prior(normal(0, 0.3), class = b),\n  prior(exponential(1), class = sigma),\n  prior(exponential(1), class = sd),\n  prior(lkj(2), class = cor)\n)\nstan_code <- stancode(\n  rt_ms ~ condition + (1 + condition | participant),\n  data = trials, family = lognormal(), prior = stan_priors\n)\ncat(stan_code)",
      a: ["同じformulaでも`brms`やStanの版によって補助的な行は変わり得ます。変数名の位置ではなく、応答・線形予測子・prior・尤度・予測がどこへ対応するかを確認します。"],
    },
    {
      t: "予測の単位を先に決める",
      b: ["「新しいデータを予測する」と言うだけでは不足です。既存参加者の次試行、新しい参加者の試行、既存の刺激に対する反応、新しい刺激への反応では、使える群レベル情報が異なります。交差検証でも、どの単位を外すかは将来の使い方に合わせます。"],
      code: "# 予測前に文章で決める\n# 対象: まだ測っていない参加者\n# 条件: 不一致条件、既知の刺激\n# 出力: 一人の反応時間の予測分布\n\n# その後にnewdataと新しい群水準の扱いを設定する",
      a: ["同じ参加者の別試行を当てる課題で高い精度でも、新しい参加者を当てる課題で同じ精度とは限りません。モデル比較の単位を変えると、良いモデルの意味も変わります。"],
    },
    {
      t: "回復とSBCで、推定手続きを試す",
      b: ["parameter recoveryでは、既知のparameterで仮想データを作り、fitしたときに事後分布がその値を含むか、予測がデータの特徴を再現するかを調べます。一回の成功は保証ではありません。SBCではpriorからparameterとデータを何度も生成し、真値の事後順位が一様になるかを調べ、実装や計算の偏りを検査します。"],
      code: "# 一回の回復確認の骨組み\ntrue_beta <- 0.4\nx <- rnorm(80)\ny <- rnorm(80, mean = true_beta * x, sd = 1)\n\n# 同じ生成過程をfitし、true_betaと事後drawを比べる\n# SBCではこの手順をpriorから何度も繰り返す",
      a: ["回復確認は、現実のモデルが正しい証明ではありません。コード、parameterization、要約、予測の計算が、想定した生成過程で一貫して動くかを確かめる検査です。"],
    },
  ].map((page) => page.code ? {
    ...page,
    verify: page.verify ?? { mode: "manual", reason: "brmsとCmdStan環境で実行する例のため" },
  } : page),
  ex: [
    { id: "l33-q01", revision: 1, k: "choice", q: "生成Stanコードの`generated quantities`を読むとき、最も適切な見方はどれですか。", opts: ["drawごとに追加の量を計算する場所として読む", "観測データを受け取る場所として読む", "priorだけを書く場所として読む", "R-hatの値を手で入力する場所として読む"], ans: 0, why: "`generated quantities`では、parameterを新たに推定せず、drawごとに追加の量を計算できます。予測や観測別log likelihoodがここにある設定もありますが、`brms`では設定によりR側で必要なときに計算することもあります。", hint: "data・parameters・model・generated quantitiesの役割を分けます。" },
    { id: "l33-q02", revision: 1, k: "choice", q: "既存参加者の次試行を当てる課題から、新参加者の試行を当てる課題へ変えたとき、最も直接変わるものはどれですか。", opts: ["使える参加者別情報と、交差検証で外す単位", "応答の単位だけ", "観測済みデータの行数だけ", "因果効果の定義だけ"], ans: 0, why: "新参加者には観測済みの参加者別効果がないため、予測時の情報と評価単位を変える必要があります。", hint: "誰のどのデータをまだ見ていない状態にするか考えます。" },
    { id: "l33-q03", revision: 1, k: "reflect", q: "parameter recoveryとSBCの違いを、生成するparameterの出所と繰り返し回数に触れて説明してください。", minLength: 90, rubric: ["recoveryでは既知の値を自分で固定して仮想データを作ると述べている", "SBCではpriorからparameterとデータを繰り返し生成すると述べている", "一回の回復成功だけでは手続きの校正を保証しないと述べている"], example: "parameter recoveryでは、例えば`true_beta = 0.4`を固定して仮想データを作り、fitがその値を回復するかを見る。SBCではparameterもpriorから引き、同じ流れを多数回繰り返して真値の事後順位を調べる。一回の成功だけでは系統的な偏りを見つけられない。" },
    { id: "l33-q04", revision: 1, k: "reflect", q: "次のStanコードをレビューしてください。`log_lik[n]`として観測ごとの寄与を保存したいとき、何を直しますか。", code: "for (n in 1:N) {\n  log_lik[n] = normal_lpdf(y | mu, sigma);\n}", lang: "Stan", minLength: 70, rubric: ["ループ内なのに全ベクトル`y`と`mu`を毎回使っていると指摘している", "`y[n]`と`mu[n]`を使う修正を示している", "観測ごとの寄与を保存する目的に触れている"], example: "このままでは同じ全データの対数尤度をN回複製してしまう。`log_lik[n] = normal_lpdf(y[n] | mu[n], sigma);`とし、各列が観測nの寄与になるようにする。" },
    { id: "l33-q05", revision: 1, k: "reflect", q: "SBCの順位が一様に近く、recoveryも良好でした。「現実の研究モデルは正しい」と結論してよいか説明してください。", minLength: 80, rubric: ["SBCとrecoveryが想定した生成過程での手続き検査であると述べている", "現実の観測過程・prior・モデル仕様が正しいこととは別と述べている", "PPCや感度分析、研究設計など追加の点検に触れている"], example: "結論してよいとは限らない。SBCとrecoveryは、自分が想定した生成過程のもとで実装と推定手続きが整合的かを試す検査である。現実の尤度、prior、欠測、因果設計が妥当かはPPC、感度分析、研究設計でも別に点検する。" },
  ].map((exercise) => exercise.code ? {
    ...exercise,
    verify: exercise.verify ?? { mode: "manual", reason: "レビュー用または環境依存のコードを確認するため" },
  } : exercise),
  practice: { title: "成果物チェック", intro: "コードを眺めるだけでなく、予測対象とシミュレーションの検査を文章と図で残します。", items: [
    { id: "stan-map", label: "Stanコードの対応表", criterion: "data・parameters・model・generated quantitiesの各一項目を、研究上の意味へ対応付ける" },
    { id: "prediction-unit", label: "予測単位の宣言", criterion: "誰または何が新しいのか、何を既知として使うのか、評価で外す単位を書く" },
    { id: "recovery-record", label: "回復確認の記録", criterion: "真のparameter、データ生成、fit、比較結果、残る限界を一組として記録する" },
  ] },
  practiceLadder: { title: "4段階の反復練習", intro: "今回くり返す技能は「モデルの式、生成コード、予測課題を対応付けること」です。各段階は、実際にRで確かめてからチェックしてください。", steps: [
    { id: "imitate", label: "1. まねる", support: "例を見ながら、そのまま動かします。", task: "一つの`stancode()`出力でdata、parameters、model、generated quantitiesに印を付けます。", criterion: "各部分を研究上の量へ一つずつ対応付けられたら完了です。" },
    { id: "change", label: "2. ひとつ変える", support: "結果を先に予想してから、1か所だけ変えます。", task: "formulaから予測子を一つ外し、生成コードのどの役割が変わるか比べます。", criterion: "変数名ではなく、線形予測子とprior・尤度の関係で説明できたら完了です。" },
    { id: "recall", label: "3. 見ずに作る", support: "例を閉じ、空のスクリプトから短いコードを作ります。", task: "真の傾きを決め、仮想データ生成、fit、真値とdrawの比較までを書きます。", criterion: "真値を推定結果と混同せず、回復確認として記録できたら完了です。" },
    { id: "transfer", label: "4. 別の場面で使う", support: "名前や値を変えた別の場面で、同じ考え方を使います。", task: "新しい病院を予測する階層モデルで、患者、病院、測定日のどれを外す評価にするか設計します。", criterion: "将来の利用場面から予測単位を選べたら完了です。" },
  ] },
  challenge: { title: "小さなSBC計画を書く", scenario: "二値の正答モデルについて、自分のコードがpriorと尤度の組合せで偏らずに動くか確かめたいとします。", task: "一回分の生成・fit・順位計算を文章と疑似コードで設計し、何回繰り返すか、順位図で何を探すかを書いてください。", hints: ["真のparameterは観測データからではなくpriorから引きます。", "各繰り返しで新しいデータも生成します。", "一様からの系統的なずれを探します。"], rubric: ["priorからparameterとデータを生成する流れがある", "fit後に真値の順位を取る流れがある", "SBCの限界とほかの点検の必要性に触れている"], example: "毎回、priorから傾きとinterceptを引き、二値データを生成して同じbrmsモデルをfitする。真の傾きが事後drawの何番目かを記録し、多数回の順位分布が偏っていないかを見る。これは実装の検査であり、現実の研究モデルの正しさを証明しない。" },
};
