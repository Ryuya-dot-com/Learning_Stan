import { describe, expect, it } from "vitest";
import {
  loadStanContent,
  validateCmdStanRunner,
  validateCurriculum,
  validateDistributionGrammarLab,
  validateFoundationLessons,
  validateGrammarDrills,
  validateLinkComparisonEvidence,
  validateLinkComparisonLab,
  validateManuscript,
  validateModelReviewCorpus,
  validateReparameterizationEvidence,
  validateReparameterizationRunner,
  validateRuntimeEvidence,
  validateScenarioEvidence,
  validateScenarioManuscript,
  validateScenarioRunner,
  validateStanContent,
  validateStanProgram,
  validateSyntaxErrorCorpus,
  validateSyntaxRetention,
  validateWrongNaiveProgram,
} from "./stan-content-verifier.mjs";

const content = loadStanContent();

describe("Stan教材パック", () => {
  it("現行ドラフトの構造・コード・原稿が同期している", () => {
    expect(validateStanContent(content)).toEqual([]);
  });

  it("パラメータの事前分布欠落を検出する", () => {
    const broken = content.stanSource.replace("  beta ~ normal(0, 1);\n", "");
    expect(validateStanProgram(broken)).toContain("betaの事前分布がありません");
  });

  it("生成量を欠いたモデルを検出する", () => {
    const broken = content.stanSource.replace("    y_rep[n] = normal_rng(mu[n], sigma);\n", "");
    expect(validateStanProgram(broken)).toContain("事後予測y_repを生成していません");
  });

  it("実行スクリプトのseed欠落を検出する", () => {
    const broken = content.runnerSource.replace("  seed = 20260801,\n", "");
    expect(validateCmdStanRunner(broken)).toContain("再現用seedがありません");
  });

  it("カリキュラムの後続レッスンへの逆依存を検出する", () => {
    const broken = structuredClone(content.curriculum);
    broken.lessons[0].prerequisites = ["l40"];
    expect(validateCurriculum(broken)).toContain("l34: 後続レッスンl40へ逆依存しています");
  });

  it("L34原稿からデータ契約の説明を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l34 = manuscripts.l34.replaceAll("データ契約", "入力対応");
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l34: 必須説明「データ契約」がありません");
  });

  it("L35の理解問題を5問未満にすると検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    assessments.lessons.find((lesson) => lesson.lessonId === "l35").questions.pop();
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l35: カリキュラムと5問の理解問題IDが一致しません");
  });

  it("理解問題の自己回答を実技証拠へ格上げすると検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    assessments.designRules.learnerAnswersAreNotPerformanceEvidence = false;
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("L34–L41理解問題が5問・4形式・初回保存・実技証拠分離の設計を満たしていません");
  });

  it("L36原稿から非正規化密度の説明を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l36 = manuscripts.l36.replaceAll("normal_lupdf", "normal_density");
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l36: 必須説明「normal_lupdf」がありません");
  });

  it("L36のリンク尺度を評価対象から外すと検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    const questions = assessments.lessons.find((lesson) => lesson.lessonId === "l36").questions;
    questions.find((question) => question.id === "stan-l36-q5-transfer-logit").targetDimensions = [
      "generative-translation",
      "transfer",
    ];
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l36: 到達目標次元link-scaleを測る理解問題がありません");
  });

  it("L37原稿から一時出力の永続化手順を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l37 = manuscripts.l37.replaceAll("save_output_files", "persist_csv_files");
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l37: 必須説明「save_output_files」がありません");
  });

  it("L37の出力永続性を評価対象から外すと検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    const questions = assessments.lessons.find((lesson) => lesson.lessonId === "l37").questions;
    for (const question of questions) {
      question.targetDimensions = question.targetDimensions.filter(
        (dimension) => dimension !== "output-persistence"
      );
    }
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l37: 到達目標次元output-persistenceを測る理解問題がありません");
  });

  it("L38原稿から分位点MCSEの確認を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l38 = manuscripts.l38.replaceAll("mcse_quantile", "quantile_precision");
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l38: 必須説明「mcse_quantile」がありません");
  });

  it("L38のMonte Carlo精度を評価対象から外すと検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    const questions = assessments.lessons.find((lesson) => lesson.lessonId === "l38").questions;
    for (const question of questions) {
      question.targetDimensions = question.targetDimensions.filter(
        (dimension) => dimension !== "monte-carlo-precision"
      );
    }
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l38: 到達目標次元monte-carlo-precisionを測る理解問題がありません");
  });

  it("L39原稿からPSIS前のPareto k判断順序を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l39 = manuscripts.l39.replaceAll(
      "Pareto kをELPDより先に読む",
      "予測比較の診断を読む"
    );
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l39: 必須説明「Pareto kをELPDより先に読む」がありません");
  });

  it("L39の予測単位を評価対象から外すと検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    const questions = assessments.lessons.find((lesson) => lesson.lessonId === "l39").questions;
    for (const question of questions) {
      question.targetDimensions = question.targetDimensions.filter(
        (dimension) => dimension !== "prediction-unit"
      );
    }
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l39: 到達目標次元prediction-unitを測る理解問題がありません");
  });

  it("L40原稿からcenteredの条件依存性を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l40 = manuscripts.l40.replaceAll(
      "centeredを常に誤り",
      "centeredを誤り"
    );
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l40: 必須説明「centeredを常に誤り」がありません");
  });

  it("L40のparameterization同値性を評価対象から外すと検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    const questions = assessments.lessons.find((lesson) => lesson.lessonId === "l40").questions;
    for (const question of questions) {
      question.targetDimensions = question.targetDimensions.filter(
        (dimension) => dimension !== "parameterization-equivalence"
      );
    }
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l40: 到達目標次元parameterization-equivalenceを測る理解問題がありません");
  });

  it("L41原稿からclaim・証拠・限界の対応を削ると検出する", () => {
    const manuscripts = structuredClone(content.lessonManuscripts);
    manuscripts.l41 = manuscripts.l41.replaceAll(
      "claim–evidence–limit",
      "結果要約"
    );
    expect(
      validateFoundationLessons(content.curriculum, content.foundationAssessments, manuscripts)
    ).toContain("l41: 必須説明「claim–evidence–limit」がありません");
  });

  it("L41の成果物追跡性を評価対象から外すと検出する", () => {
    const assessments = structuredClone(content.foundationAssessments);
    const questions = assessments.lessons.find((lesson) => lesson.lessonId === "l41").questions;
    for (const question of questions) {
      question.targetDimensions = question.targetDimensions.filter(
        (dimension) => dimension !== "evidence-traceability"
      );
    }
    expect(
      validateFoundationLessons(content.curriculum, assessments, content.lessonManuscripts)
    ).toContain("l41: 到達目標次元evidence-traceabilityを測る理解問題がありません");
  });

  it("原稿と実行用Stanコードのずれを検出する", () => {
    const broken = content.manuscript.replace(
      "vector[N] mu = alpha + beta * x_centered;",
      "vector[N] mu = alpha + 2 * beta * x_centered;"
    );
    expect(validateManuscript(broken, content.stanSource, content.runnerSource)).toContain(
      "原稿のStanコードが実行用.stanファイルと一致しません"
    );
  });

  it("実行後にStanコードが変わると証拠を無効化する", () => {
    expect(
      validateRuntimeEvidence(
        content.runtimeEvidence,
        content.stanSource.replace("normal(0, 2)", "normal(0, 3)"),
        content.runnerSource
      )
    ).toContain("Stanコードが実行証拠取得後に変更されています");
  });

  it("L40比較runnerから全反復診断の保存を削ると検出する", () => {
    const broken = content.reparameterizationRunner.replace(
      "lapply(performance_results, `[[`, \"diagnostics\")",
      "lapply(primary_results, `[[`, \"diagnostics\")"
    );
    expect(validateReparameterizationRunner(broken)).toContain(
      "L40比較が全性能反復の診断を保存していません"
    );
  });

  it("L40比較実行後にrunnerが変わると証拠を無効化する", () => {
    const sources = {
      "mr03-centered.candidate.stan": content.modelReviewSources[
        "model-review/mr03-centered.candidate.stan"
      ],
      "mr03-noncentered.reference.stan": content.modelReviewSources[
        "model-review/mr03-noncentered.reference.stan"
      ],
      "run-reparameterization-comparison.R": `${content.reparameterizationRunner}\n# changed`,
    };
    expect(validateReparameterizationEvidence(content.reparameterizationEvidence, sources)).toContain(
      "run-reparameterization-comparison.RがL40再パラメータ化実行証拠取得後に変更されています"
    );
  });

  it("L40の弱情報non-centeredへdivergenceを混入すると検出する", () => {
    const broken = structuredClone(content.reparameterizationEvidence);
    broken.performance.weak.noncentered.divergentTotal = 1;
    const sources = {
      "mr03-centered.candidate.stan": content.modelReviewSources[
        "model-review/mr03-centered.candidate.stan"
      ],
      "mr03-noncentered.reference.stan": content.modelReviewSources[
        "model-review/mr03-noncentered.reference.stan"
      ],
      "run-reparameterization-comparison.R": content.reparameterizationRunner,
    };
    expect(validateReparameterizationEvidence(broken, sources)).toContain(
      "L40弱情報実測がcenteredの幾何問題とnon-centeredの修復を示していません"
    );
  });

  it("L40の事後分布同値性を許容幅外へ変えると検出する", () => {
    const broken = structuredClone(content.reparameterizationEvidence);
    broken.posteriorEquivalence.maximumAbsoluteMcseZ = 4.1;
    const sources = {
      "mr03-centered.candidate.stan": content.modelReviewSources[
        "model-review/mr03-centered.candidate.stan"
      ],
      "mr03-noncentered.reference.stan": content.modelReviewSources[
        "model-review/mr03-noncentered.reference.stan"
      ],
      "run-reparameterization-comparison.R": content.reparameterizationRunner,
    };
    expect(validateReparameterizationEvidence(broken, sources)).toContain(
      "L40のモデル尺度における事後分布同値性証拠が固定基準を満たしません"
    );
  });

  it("白紙再現を欠いた文法単元を検出する", () => {
    const broken = structuredClone(content.grammarDrills);
    broken.units[0].steps = broken.units[0].steps.filter((step) => step.id !== "recall");
    expect(validateGrammarDrills(broken)).toContain("g01: 4段階練習の順序または段階が不完全です");
  });

  it("Stan構文スパインの三層設計欠落を検出する", () => {
    const broken = structuredClone(content.curriculum);
    broken.syntaxSpine.layers = broken.syntaxSpine.layers.filter((layer) => layer.id !== "computational");
    expect(validateCurriculum(broken)).toContain(
      "Stan構文スパインは言語・確率モデル・計算の三層を十分な範囲で定義する必要があります"
    );
  });

  it("Stan構文スパインの遅延想起欠落を検出する", () => {
    const broken = structuredClone(content.curriculum);
    broken.syntaxSpine.delayedChecks = broken.syntaxSpine.delayedChecks.slice(0, 2);
    expect(validateCurriculum(broken)).toContain(
      "Stan構文スパインに累積・遅延想起の評価証拠が不足しています"
    );
  });

  it("構文エラーの修正版が証拠取得後に変わると検出する", () => {
    const sources = structuredClone(content.syntaxErrorSources);
    sources["errors/se02-array-vector-assignment.fixed.stan"] = sources[
      "errors/se02-array-vector-assignment.fixed.stan"
    ].replace("vector[N] y_copy", "array[N] real y_copy");
    expect(
      validateSyntaxErrorCorpus(
        content.syntaxErrorCorpus,
        content.syntaxErrorEvidence,
        sources,
        content.syntaxErrorCorpusSource
      )
    ).toContain("se02: stanc3実測証拠取得後にソースが変更されています");
  });

  it("構文エラー課題から転移基準を削ると検出する", () => {
    const corpus = structuredClone(content.syntaxErrorCorpus);
    corpus.cases[0].transferPrompt = "";
    expect(
      validateSyntaxErrorCorpus(
        corpus,
        content.syntaxErrorEvidence,
        content.syntaxErrorSources,
        content.syntaxErrorCorpusSource
      )
    ).toContain("se01: transferPromptがありません");
  });

  it("コンパイル成功モデル対が証拠取得後に変わると検出する", () => {
    const sources = structuredClone(content.modelReviewSources);
    sources["model-review/mr04-exposure-log.reference.stan"] = sources[
      "model-review/mr04-exposure-log.reference.stan"
    ].replace("log(exposure)", "exposure");
    expect(
      validateModelReviewCorpus(
        content.modelReviewCorpus,
        content.modelReviewEvidence,
        sources,
        content.modelReviewCorpusSource
      )
    ).toContain("mr04: stanc3実測証拠取得後にモデルレビューソースが変更されています");
  });

  it("centered表現を無条件の誤答へ変えると検出する", () => {
    const corpus = structuredClone(content.modelReviewCorpus);
    corpus.cases.find((item) => item.id === "mr03").judgement = "candidate-reject";
    expect(
      validateModelReviewCorpus(
        corpus,
        content.modelReviewEvidence,
        content.modelReviewSources,
        content.modelReviewCorpusSource
      )
    ).toContain("mr03: candidate-reject・prefer-reference・context-dependentの区別が教材設計と一致しません");
  });

  it("遅延転移を直後評価へ変えると検出する", () => {
    const plan = structuredClone(content.syntaxRetentionPlan);
    plan.checkpoints.find((item) => item.id === "sr41d").schedule.minimumDays = 0;
    expect(
      validateSyntaxRetention(
        plan,
        content.syntaxRetentionAssessments,
        content.syntaxRetentionEvidence,
        content.syntaxRetentionReference,
        content.syntaxRetentionPlanSource,
        content.syntaxRetentionAssessmentSource
      )
    ).toContain("sr41dはpilotで再検討する7〜14日後の未見lognormal転移である必要があります");
  });

  it("自己チェックを保持の証拠へ格上げすると検出する", () => {
    const plan = structuredClone(content.syntaxRetentionPlan);
    plan.masteryPolicy.selfRecordIsMasteryEvidence = true;
    expect(
      validateSyntaxRetention(
        plan,
        content.syntaxRetentionAssessments,
        content.syntaxRetentionEvidence,
        content.syntaxRetentionReference,
        content.syntaxRetentionPlanSource,
        content.syntaxRetentionAssessmentSource
      )
    ).toContain("Stan保持計画が自己記録・直後・遅延・初回提出・pilot前閾値を分離していません");
  });

  it("未見lognormal参照モデルが証拠取得後に変わると検出する", () => {
    expect(
      validateSyntaxRetention(
        content.syntaxRetentionPlan,
        content.syntaxRetentionAssessments,
        content.syntaxRetentionEvidence,
        `${content.syntaxRetentionReference}\n// changed after evidence`,
        content.syntaxRetentionPlanSource,
        content.syntaxRetentionAssessmentSource
      )
    ).toContain("Stan保持計画・課題・参照モデルが実測証拠取得後に変更されています");
  });

  it("切断モデルから正規化の確認を削ると検出する", () => {
    const broken = content.truncatedNormalStan.replace("log_diff_exp(", "(");
    expect(
      validateDistributionGrammarLab(
        content.distributionManuscript,
        content.distributionRunner,
        content.priorPredictiveStan,
        broken
      )
    ).toContain("切断Stanコードに対数正規化項の確認がありません");
  });

  it("意図的な誤答モデルへ切断正規化が混入すると検出する", () => {
    const broken = content.wrongNaiveStan.replace(
      "y ~ normal(mu, sigma);",
      "y ~ normal(mu, sigma) T[lower_bound, upper_bound];"
    );
    expect(validateWrongNaiveProgram(broken)).toContain(
      "意図的な誤答Stanコードへ切断正規化が混入しています"
    );
  });

  it("ケース実行コードからfixed-parameter指定を削ると検出する", () => {
    const broken = content.scenarioRunner.replace("      fixed_param = TRUE,\n", "");
    expect(validateScenarioRunner(broken)).toContain(
      "事前予測がfixed-parameter samplerを使っていません"
    );
  });

  it("ケース原稿から計算診断とモデル妥当性の区別を削ると検出する", () => {
    const broken = content.scenarioManuscript.replace("診断が良い誤答", "診断結果");
    expect(validateScenarioManuscript(broken)).toContain(
      "切断ケース原稿に必須説明「診断が良い誤答」がありません"
    );
  });

  it("ケース実行後に誤答Stanコードが変わると証拠を無効化する", () => {
    const sources = {
      "prior-predictive.stan": content.priorPredictiveStan,
      "truncated-normal.stan": content.truncatedNormalStan,
      "wrong-naive-bounded-normal.stan": content.wrongNaiveStan.replace(
        "normal(0, 2)",
        "normal(0, 3)"
      ),
      "run-distribution-models.R": content.scenarioRunner,
    };
    expect(validateScenarioEvidence(content.scenarioEvidence, sources)).toContain(
      "wrong-naive-bounded-normal.stanがケース実行証拠取得後に変更されています"
    );
  });

  it("リンク関数教材から安定なBernoulli-logit尤度を削ると検出する", () => {
    const broken = content.binaryLogitLinearStan.replace(
      "y ~ bernoulli_logit(eta);",
      "y ~ bernoulli(inv_logit(eta));"
    );
    expect(
      validateLinkComparisonLab(
        content.linkComparisonManuscript,
        content.linkSimulationRunner,
        content.linkComparisonRunner,
        broken,
        content.binaryLogitQuadraticStan,
        content.poissonLogExposureStan
      )
    ).toContain("線形logit: 数値的に安定なBernoulli-logit尤度がありません");
  });

  it("LOO実行後に比較Rコードが変わると証拠を無効化する", () => {
    const sources = {
      "binary-logit-linear.stan": content.binaryLogitLinearStan,
      "binary-logit-quadratic.stan": content.binaryLogitQuadraticStan,
      "poisson-log-exposure.stan": content.poissonLogExposureStan,
      "simulate-link-functions.R": content.linkSimulationRunner,
      "run-link-model-comparison.R": content.linkComparisonRunner.replace("n = 400L", "n = 401L"),
    };
    expect(validateLinkComparisonEvidence(content.linkComparisonEvidence, sources)).toContain(
      "run-link-model-comparison.Rがリンク関数・LOO実行証拠取得後に変更されています"
    );
  });
});
