import { describe, expect, it } from "vitest";
import {
  loadStanContent,
  validateCmdStanRunner,
  validateCurriculum,
  validateDistributionGrammarLab,
  validateGrammarDrills,
  validateLinkComparisonEvidence,
  validateLinkComparisonLab,
  validateManuscript,
  validateRuntimeEvidence,
  validateScenarioEvidence,
  validateScenarioManuscript,
  validateScenarioRunner,
  validateStanContent,
  validateStanProgram,
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

  it("白紙再現を欠いた文法単元を検出する", () => {
    const broken = structuredClone(content.grammarDrills);
    broken.units[0].steps = broken.units[0].steps.filter((step) => step.id !== "recall");
    expect(validateGrammarDrills(broken)).toContain("g01: 4段階練習の順序または段階が不完全です");
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
