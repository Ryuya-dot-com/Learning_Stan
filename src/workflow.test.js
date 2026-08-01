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
    expect(config.on.pull_request.branches).toContain("main");
    expect(config.jobs.build.steps.map((step) => step.run).filter(Boolean)).toEqual(
      expect.arrayContaining(["npm test", "npm run build"])
    );
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

    for (const jobName of ["build", "r-verify"]) {
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
    expect(rJob.steps.map((step) => step.run).filter(Boolean)).toContain("node scripts/r-example-verifier.mjs");
    expect(config.jobs.deploy.needs).toEqual(expect.arrayContaining(["build", "r-verify"]));
  });

  it("Pages権限とOIDC権限をdeployだけに限定し、PRではdeployしない", () => {
    expect(config.jobs.deploy.if).toBe("github.event_name != 'pull_request'");
    expect(config.jobs.deploy.permissions).toEqual({
      contents: "read",
      pages: "write",
      "id-token": "write",
    });
  });
});
