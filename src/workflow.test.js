import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(join(root, ".github", "workflows", "deploy.yml"), "utf8");
const config = parse(workflow);
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const nodeVersion = readFileSync(join(root, ".node-version"), "utf8").trim();

describe("GitHub Pages workflow", () => {
  it("pull requestでもtestとbuildを実行する", () => {
    expect(config.on.pull_request).toEqual({});
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toEqual(
      expect.arrayContaining([
        "npm test",
        "npm run test:excel-samples",
        "npm run test:step1-transfer-observation-pack",
        "npm run gate:step1-transfer:status",
        "npm run gate:stan-release:status",
        "npm run build",
      ])
    );
  });

  it("独立転移の観察用ZIPを固定入力から生成し、CIで漏えい検査する", () => {
    expect(packageJson.scripts["generate:step1-transfer-observation-pack"]).toBe(
      "node scripts/generate-step1-transfer-observation-pack.mjs"
    );
    expect(packageJson.scripts["test:step1-transfer-observation-pack"]).toBe(
      "node scripts/generate-step1-transfer-observation-pack.mjs --check"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toContain(
      "npm run test:step1-transfer-observation-pack"
    );
  });

  it("独立転移観察はNOT RUNをCIで検証し、OBSERVED要求を別コマンドにする", () => {
    expect(packageJson.scripts["gate:step1-transfer:status"]).toBe(
      "node scripts/step1-transfer-gate.mjs"
    );
    expect(packageJson.scripts["gate:step1-transfer:require-observed"]).toBe(
      "node scripts/step1-transfer-gate.mjs --require-observed"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toContain(
      "npm run gate:step1-transfer:status"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).not.toContain(
      "npm run gate:step1-transfer:require-observed"
    );
  });

  it("Stan公開判定はBLOCKEDをCIで検証し、PASS要求を公開時の別コマンドにする", () => {
    expect(packageJson.scripts["gate:stan-release:status"]).toBe(
      "node scripts/stan-release-gate.mjs"
    );
    expect(packageJson.scripts["gate:stan-release:require-pass"]).toBe(
      "node scripts/stan-release-gate.mjs --require-pass"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toContain(
      "npm run gate:stan-release:status"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).not.toContain(
      "npm run gate:stan-release:require-pass"
    );
  });

  it("Excel教材生成ランタイムを固定し、生成物検査をCIで実行する", () => {
    expect(packageJson.devDependencies.exceljs).toBe("4.4.0");
    expect(packageJson.overrides.uuid).toBe("11.1.1");
    expect(packageJson.scripts["generate:excel-samples"]).toBe("node scripts/generate-excel-samples.mjs");
    expect(packageJson.scripts["test:excel-samples"]).toBe("node scripts/generate-excel-samples.mjs --check");
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toContain("npm run test:excel-samples");
  });

  it("すべての外部Actionを完全なコミットSHAに固定する", () => {
    const refs = [...workflow.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/g)].map((match) => match[1]);

    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((ref) => /^[0-9a-f]{40}$/.test(ref))).toBe(true);
  });

  it("buildには配布権限を与えない", () => {
    expect(config.jobs.build.permissions).toEqual({ contents: "read" });
  });

  it("Nodeとnpmの版を宣言し、全Node jobで同じファイルを使う", () => {
    expect(packageJson.engines.node).toBe(nodeVersion);
    expect(packageJson.packageManager).toBe(`npm@${packageJson.engines.npm}`);

    for (const jobName of ["build", "r-verify", "stan-verify"]) {
      const setupNode = config.jobs[jobName].steps.find((step) =>
        step.uses?.startsWith("actions/setup-node@")
      );
      expect(setupNode.with["node-version-file"]).toBe(".node-version");
      expect(setupNode.with["node-version"]).toBeUndefined();
    }
  });

  it("R検証を独立jobで実行し、成功するまでdeployしない", () => {
    const rJob = config.jobs["r-verify"];

    expect(rJob.permissions).toEqual({ contents: "read" });
    expect(rJob.steps.some((step) => step.uses?.startsWith("r-lib/actions/setup-r@"))).toBe(true);
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("Rscript scripts/install-r-dependencies.R");
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("Rscript scripts/verify-file-io.R");
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("Rscript scripts/verify-notebook.R");
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("Rscript scripts/verify-step1-analysis.R");
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("Rscript scripts/verify-step1-transfer.R");
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("Rscript scripts/verify-step1-transfer-observation-rehearsal.R");
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("node scripts/r-example-verifier.mjs");
    expect(config.jobs.deploy.needs).toEqual(expect.arrayContaining(["build", "r-verify"]));
  });

  it("Stan検証を固定版の独立jobで実行し、成功するまでdeployしない", () => {
    const stanJob = config.jobs["stan-verify"];
    const runs = stanJob.steps.map((step) => step.run).filter(Boolean);

    expect(packageJson.scripts["install:stan-ci"]).toBe("Rscript scripts/install-stan-ci.R");
    expect(stanJob.permissions).toEqual({ contents: "read" });
    expect(stanJob["timeout-minutes"]).toBe(30);
    expect(stanJob.env).toBeUndefined();
    const configurePaths = stanJob.steps.find((step) => step.name === "Configure CmdStan paths");
    expect(configurePaths.run).toContain("CMDSTAN=${RUNNER_TEMP}/cmdstan");
    expect(configurePaths.run).toContain("LEARNING_STAN_CMDSTAN=${RUNNER_TEMP}/cmdstan/cmdstan-2.39.0");
    expect(configurePaths.run).toContain("LEARNING_STAN_STANC=${RUNNER_TEMP}/cmdstan/cmdstan-2.39.0/bin/stanc");
    expect(workflow).not.toContain("${{ runner.temp }}");
    expect(runs).toEqual(expect.arrayContaining([
      "Rscript scripts/install-stan-ci.R",
      "npm run test:stan-syntax-errors",
      "npm run test:stan-model-review",
      "npm run test:stan-retention",
      "npm run test:stan-existing-runtime",
      "npm run test:stan-reparameterization-runtime",
    ]));
    expect(config.jobs.deploy.needs).toEqual(
      expect.arrayContaining(["build", "r-verify", "stan-verify"])
    );
  });

  it("独立転移の観察用ZIPをRで展開し、初回提出後の採点動線をリハーサルする", () => {
    expect(packageJson.scripts["test:step1-transfer-observation-rehearsal"]).toBe(
      "Rscript scripts/verify-step1-transfer-observation-rehearsal.R"
    );
    expect(config.jobs["r-verify"].steps.map((step) => step.run).filter(Boolean)).toContain(
      "Rscript scripts/verify-step1-transfer-observation-rehearsal.R"
    );
  });

  it("Pages権限とOIDC権限をdeployだけに限定し、mainへのpush以外ではdeployしない", () => {
    const deployCondition = "github.event_name == 'push' && github.ref == 'refs/heads/main'";
    const upload = config.jobs.build.steps.find((step) =>
      step.uses?.startsWith("actions/upload-pages-artifact@")
    );

    expect(config.on).toHaveProperty("workflow_dispatch");
    expect(upload.if).toBe(deployCondition);
    expect(config.jobs.deploy.if).toBe(deployCondition);
    expect(config.jobs.deploy.permissions).toEqual({
      contents: "read",
      pages: "write",
      "id-token": "write",
    });
  });
});
