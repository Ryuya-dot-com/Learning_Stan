import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(join(root, ".github", "workflows", "deploy.yml"), "utf8");
const config = parse(workflow);
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const stanInstaller = readFileSync(join(root, "scripts", "install-stan-ci.R"), "utf8");
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

  it("独立転移観察はNOT RUNをCIで検証し、公開を止める要求コマンドを持たない", () => {
    expect(packageJson.scripts["gate:step1-transfer:status"]).toBe(
      "node scripts/step1-transfer-gate.mjs"
    );
    expect(packageJson.scripts["gate:step1-transfer:require-observed"]).toBeUndefined();
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toContain(
      "npm run gate:step1-transfer:status"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).not.toContain(
      "npm run gate:step1-transfer:require-observed"
    );
  });

  it("Stan公開判定のPASS要求はmain公開時に適用する", () => {
    expect(packageJson.scripts["gate:stan-release:status"]).toBe(
      "node scripts/stan-release-gate.mjs"
    );
    expect(packageJson.scripts["gate:stan-release:require-pass"]).toBe(
      "node scripts/stan-release-gate.mjs --require-pass"
    );
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toContain(
      "npm run gate:stan-release:status"
    );
    const gate = config.jobs.build.steps.find(step => step.run === "npm run gate:stan-release:require-pass");
    expect(gate.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'");
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

  it("STEP 5の共通データとベイズ教材のRコードをCIで検証する", () => {
    const runs = config.jobs["r-verify"].steps.map((step) => step.run).filter(Boolean);

    expect(packageJson.scripts["test:step5-data"]).toBe(
      "Rscript scripts/verify-step5-data.R"
    );
    expect(packageJson.scripts["test:bayes-methods-r-syntax"]).toBe(
      "Rscript scripts/verify-bayes-methods-r-syntax.R"
    );
    expect(runs).toEqual(expect.arrayContaining([
      "npm run test:step5-data",
      "npm run test:bayes-methods-r-syntax",
    ]));
  });

  it("Stan検証を固定版の独立jobで実行し、成功するまでdeployしない", () => {
    const stanJob = config.jobs["stan-verify"];
    const runs = stanJob.steps.map((step) => step.run).filter(Boolean);

    expect(packageJson.scripts["install:stan-ci"]).toBe("Rscript scripts/install-stan-ci.R");
    expect(stanJob.permissions).toEqual({ contents: "read" });
    expect(stanJob["timeout-minutes"]).toBe(30);
    expect(stanJob.env).toBeUndefined();
    const configurePaths = stanJob.steps.find((step) => step.name === "Configure CmdStan paths");
    expect(configurePaths.run).toContain("LEARNING_STAN_CMDSTAN_ROOT=${RUNNER_TEMP}/cmdstan");
    expect(configurePaths.run).toContain("LEARNING_STAN_CMDSTAN=${RUNNER_TEMP}/cmdstan/cmdstan-2.39.0");
    expect(configurePaths.run).toContain("LEARNING_STAN_STANC=${RUNNER_TEMP}/cmdstan/cmdstan-2.39.0/bin/stanc");
    expect(configurePaths.run).not.toMatch(/echo "CMDSTAN=/);
    for (const job of Object.values(config.jobs))
      expect(JSON.stringify(job.env || {})).not.toContain("runner.temp");
    expect(stanInstaller).toContain('Sys.getenv("LEARNING_STAN_CMDSTAN_ROOT"');
    expect(stanInstaller).toContain('install.packages("loo", repos = cran_repository)');
    expect(stanInstaller).toContain('install.packages("cmdstanr", repos = repositories)');
    expect(runs).toEqual(expect.arrayContaining([
      "Rscript scripts/install-stan-ci.R",
      "npm run test:stan-syntax-errors",
      "npm run test:stan-model-review",
      "npm run test:stan-retention",
      "npm run test:stan-existing-runtime",
      "npm run test:stan-reparameterization-runtime",
    ]));
    expect(config.jobs.deploy.needs).toEqual(
      expect.arrayContaining(["build", "r-verify", "stan-verify", "brms-verify"])
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


it("brms検証は公開の前提となり、失敗時もコミット対応の診断を保存する", () => {
  expect(config.jobs.deploy.needs).toContain("brms-verify");
  const job = config.jobs["brms-verify"];
  expect(job.steps.some(step => step.name?.startsWith("Restore reference R packages"))).toBe(true);
  const artifact = job.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  expect(artifact.if).toBe("always()");
  expect(artifact.with.name).toContain("github.sha");
  expect(artifact.with.path).toContain("/crossed");
  expect(artifact.with.path).toContain("/nb5");
  expect(config.jobs["brms-compatibility"].if).toBe("github.event_name == 'workflow_dispatch'");
});
