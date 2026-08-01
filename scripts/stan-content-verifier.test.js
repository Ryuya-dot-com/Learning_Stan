import { describe, expect, it } from "vitest";
import {
  loadStanContent,
  validateCmdStanRunner,
  validateCurriculum,
  validateManuscript,
  validateRuntimeEvidence,
  validateStanContent,
  validateStanProgram,
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
});
