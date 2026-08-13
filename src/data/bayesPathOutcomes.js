function practiceEvidence(itemId, dimensions, criterion) {
  return {
    kind: "practice",
    itemId,
    method: "self-attested-performance",
    strength: "direct",
    dimensions,
    criterion,
  };
}

export const BAYES_PATH_OUTCOMES = [
  {
    lessonId: "l21",
    goalId: "interpret-regression-components",
    statement: "連続応答の回帰で、係数・予測値・残差を区別し、因子と交互作用を研究質問に対応付けて説明できる",
    level: "analyze",
    dimensions: ["prediction-residual", "interaction", "interpretation-scope"],
    evidence: [
      practiceEvidence("prediction-table", ["prediction-residual"], "観測値・予測値・残差の関係を実データで確認する"),
      practiceEvidence("interaction-predictions", ["interaction"], "交互作用を条件別予測と差の差で説明する"),
      practiceEvidence("scope-note", ["interpretation-scope"], "係数の単位と因果解釈の境界を書く"),
    ],
  },
  {
    lessonId: "l22",
    goalId: "simulate-generative-process",
    statement: "確率・観測割合・生成過程を区別し、Rで条件を変えたシミュレーションを実行して標本変動を説明できる",
    level: "perform",
    dimensions: ["generative-process", "simulation", "assumptions"],
    evidence: [
      practiceEvidence("generative-contract", ["generative-process"], "確率と繰り返す単位を含む生成過程を書く"),
      practiceEvidence("simulation-comparison", ["simulation"], "一条件を変えた結果を予想と比較する"),
      practiceEvidence("assumption-note", ["assumptions"], "一定確率と条件付き独立を研究場面で点検する"),
    ],
  },
  {
    lessonId: "l23",
    goalId: "choose-response-likelihood",
    statement: "観測単位・値の範囲・記録過程から尤度候補を選び、尤度とパラメータの確率を区別して説明できる",
    level: "analyze",
    dimensions: ["response-contract", "likelihood", "family-choice"],
    evidence: [
      practiceEvidence("response-contract", ["response-contract"], "観測単位・値域・観測機会を明記する"),
      practiceEvidence("likelihood-plot", ["likelihood"], "固定データの下の相対的な整合性として尤度を説明する"),
      practiceEvidence("family-rationale", ["family-choice"], "応答の生成過程から候補分布を理由づける"),
    ],
  },
  {
    lessonId: "l24",
    goalId: "update-and-summarize-posterior",
    statement: "同じ未知の平均について、事前分布・尤度・事後分布を図で対応させ、事後分布に基づく限定付きの結論を書くことができる",
    level: "perform",
    dimensions: ["bayesian-update", "posterior-summary", "bounded-conclusion"],
    evidence: [
      practiceEvidence("updating-plot", ["bayesian-update"], "同じ未知量について更新の三要素を図示する"),
      practiceEvidence("posterior-summary", ["posterior-summary"], "研究質問に合う事後量を要約する"),
      practiceEvidence("bounded-conclusion", ["bounded-conclusion"], "条件づけと因果解釈の限界を書く"),
    ],
  },
  {
    lessonId: "l25",
    goalId: "check-priors-and-sensitivity",
    statement: "応答と予測子の単位に照らしてproperなpriorを指定し、事前予測と代替priorで結論の頑健さを点検・記録できる",
    level: "perform",
    dimensions: ["prior-rationale", "prior-predictive", "sensitivity"],
    evidence: [
      practiceEvidence("prior-rationale", ["prior-rationale"], "parameterの単位に沿ってpriorの根拠を書く"),
      practiceEvidence("prior-predictive-check", ["prior-predictive"], "データ前の複製値を応答尺度と比較する"),
      practiceEvidence("sensitivity-table", ["sensitivity"], "代替priorに対する結論の変化を比較する"),
    ],
  },
  {
    lessonId: "l26",
    goalId: "prepare-and-diagnose-mcmc",
    statement: "MCMCのwarmup・chain・drawの役割を区別し、brmsとStanを手元で実行する準備と、実行後に最初に確認する診断を説明できる",
    level: "perform",
    dimensions: ["mcmc-roles", "environment", "diagnostics"],
    evidence: [
      practiceEvidence("sampling-plan", ["mcmc-roles"], "sampling設定と残るdraw数を記録する"),
      practiceEvidence("environment-record", ["environment"], "brmsとCmdStanを実行できる環境情報を残す"),
      practiceEvidence("first-diagnostics", ["diagnostics"], "最初の計算診断と次の行動を分けて書く"),
    ],
  },
  {
    lessonId: "l27",
    goalId: "fit-and-predict-continuous-brms",
    statement: "連続応答の研究質問を`brms`の式・尤度・priorへ翻訳し、予測として報告できる",
    level: "perform",
    dimensions: ["model-specification", "prediction", "reporting"],
    evidence: [
      practiceEvidence("model-script", ["model-specification"], "式・尤度・prior・seedを再実行できる形で残す"),
      practiceEvidence("prediction-table", ["prediction"], "平均と個人の予測対象を区別する"),
      practiceEvidence("result-sentence", ["reporting"], "不確実性と解釈範囲を含む結果文を書く"),
    ],
  },
  {
    lessonId: "l28",
    goalId: "audit-brms-priors",
    statement: "応答と予測子の単位に照らしてproperなpriorを指定し、事前予測と感度分析で仮定を点検できる",
    level: "perform",
    dimensions: ["prior-rationale", "prior-predictive", "sensitivity"],
    evidence: [
      practiceEvidence("prior-rationale", ["prior-rationale"], "parameterの単位と許容範囲を記す"),
      practiceEvidence("prior-predictive-plot", ["prior-predictive"], "事前予測の現実性を図で点検する"),
      practiceEvidence("sensitivity-summary", ["sensitivity"], "複数priorで主要な結果を比較する"),
    ],
  },
  {
    lessonId: "l29",
    goalId: "separate-diagnostics-ppc-loo",
    statement: "計算診断、事後予測チェック、予測比較が答える問いを分け、根拠の範囲を限定して報告できる",
    level: "perform",
    dimensions: ["computation", "predictive-check", "model-comparison"],
    evidence: [
      practiceEvidence("diagnostic-note", ["computation"], "計算診断と問題時の行動を記録する"),
      practiceEvidence("ppc-plan", ["predictive-check"], "研究上重要な特徴を複製データと比較する"),
      practiceEvidence("comparison-note", ["model-comparison"], "予測課題と評価単位をそろえて比較する"),
    ],
  },
  {
    lessonId: "l30",
    goalId: "model-repeated-measures",
    statement: "参加者内試行の階層構造を式と`brms`のformulaに対応付け、部分プーリングが必要な理由を説明できる",
    level: "perform",
    dimensions: ["hierarchy", "partial-pooling", "prediction-target"],
    evidence: [
      practiceEvidence("hierarchical-formula", ["hierarchy", "partial-pooling"], "群構造と変動効果をformulaへ対応付ける"),
      practiceEvidence("participant-ppc", ["partial-pooling"], "参加者別の再現性を点検する"),
      practiceEvidence("prediction-target", ["prediction-target"], "既存参加者と新参加者の予測を区別する"),
    ],
  },
  {
    lessonId: "l31",
    goalId: "model-discrete-responses",
    statement: "二値・順序・件数の応答を支持範囲に合う尤度と予測へ対応付け、結果の尺度を選んで報告できる",
    level: "perform",
    dimensions: ["response-contract", "family-choice", "response-scale"],
    evidence: [
      practiceEvidence("response-contract", ["response-contract"], "応答の値域と観測単位を検査する"),
      practiceEvidence("family-candidate", ["family-choice"], "観測過程から候補familyを理由づける"),
      practiceEvidence("response-scale-prediction", ["response-scale"], "研究質問に合う応答尺度で予測する"),
    ],
  },
  {
    lessonId: "l32",
    goalId: "audit-rt-missing-measurement",
    statement: "反応時間の正の歪み、欠測、測定誤差を観測過程として点検し、値を削除する前に分析方針を立てることができる",
    level: "perform",
    dimensions: ["reaction-time", "missingness", "measurement-error"],
    evidence: [
      practiceEvidence("rt-contract", ["reaction-time"], "反応時間の値域と記録規則を明示する"),
      practiceEvidence("missingness-summary", ["missingness"], "欠測の場所と割合を条件別に確認する"),
      practiceEvidence("measurement-note", ["measurement-error"], "真値・観測値・誤差情報を分けて記す"),
    ],
  },
  {
    lessonId: "l33",
    goalId: "read-stancode-and-check-recovery",
    statement: "生成されたStanコードを観測過程の地図として読み、予測単位とシミュレーションによる回復確認を設計できる",
    level: "perform",
    dimensions: ["stan-map", "prediction-unit", "recovery"],
    evidence: [
      practiceEvidence("stan-map", ["stan-map"], "Stanの各blockを研究上の量へ対応付ける"),
      practiceEvidence("prediction-unit", ["prediction-unit"], "将来の利用場面から評価単位を宣言する"),
      practiceEvidence("recovery-record", ["recovery"], "既知の真値から回復確認を一周する"),
    ],
  },
];
