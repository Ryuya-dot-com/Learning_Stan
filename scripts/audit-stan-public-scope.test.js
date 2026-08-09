import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  auditBuiltApp,
  auditTrackedEntries,
} from "./audit-stan-public-scope.mjs";

describe("Stan公開範囲監査", () => {
  it("公開可能なソースと合成データを通す", () => {
    const result = auditTrackedEntries([
      { path: "src/data/lessons/2-data/l16-reshape-save.js", content: "export default { id: 'l16' };" },
      { path: "public/data/synthetic.csv", content: "participant,condition\nP01,A\n" },
      { path: "quality/stan-release-gate/README.md", content: "secretをコミットしない。" },
    ]);

    expect(result.findings).toEqual([]);
    expect(result.textFilesScanned).toBe(3);
  });

  it("非公開pathと代表的なcredentialを値を露出せず検出する", () => {
    const token = "ghp_" + "A".repeat(32);
    const result = auditTrackedEntries([
      { path: "quality/stan-release-gate/filled-records/P01.md", content: "入力済み" },
      { path: "config.js", content: `const access_token = '${token}';` },
    ]);

    expect(result.findings.map(({ rule }) => rule)).toEqual(expect.arrayContaining([
      "private-observation-path",
      "github-token",
      "assigned-credential",
    ]));
    expect(JSON.stringify(result.findings)).not.toContain(token);
  });

  it("メールアドレスと実ユーザー名を含む絶対pathを直接識別子候補にする", () => {
    const email = ["participant", "example.test"].join("@");
    const userPath = ["", "Users", "researcher", "Desktop", "record.csv"].join("/");
    const result = auditTrackedEntries([
      { path: "notes.txt", content: `${email}\n${userPath}\nC:/Users/me/Desktop/example.csv` },
    ]);

    expect(result.findings.map(({ rule }) => rule)).toEqual(expect.arrayContaining([
      "email-address",
      "unix-user-path",
    ]));
    expect(result.findings.map(({ rule }) => rule)).not.toContain("windows-user-path");
  });

  it("依存lockfileの公開maintainer連絡先だけを個人データ候補から除外する", () => {
    const email = ["maintainer", "example.test"].join("@");
    const result = auditTrackedEntries([
      { path: "package-lock.json", content: JSON.stringify({ deprecated: `contact ${email}` }) },
      { path: "notes.txt", content: email },
    ]);

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: "email-address", path: "notes.txt" }),
    ]);
  });

  it("Stanレッスンのアプリsource混入を検出する", () => {
    const result = auditTrackedEntries([
      { path: "src/data/lessons/7-stan/l34-execution.js", content: "export default { id: 'l34' };" },
    ]);

    expect(result.findings.map(({ rule }) => rule)).toEqual(expect.arrayContaining([
      "stan-lesson-source-path",
      "stan-lesson-id",
    ]));
  });

  it("roadmapは許可し、通常のビルドassetへ混入したStan教材だけを拒否する", () => {
    const root = mkdtempSync(join(tmpdir(), "learning-stan-public-scope-"));
    mkdirSync(join(root, "dist", "assets"), { recursive: true });
    writeFileSync(join(root, "dist", "roadmap.html"), "<h3>L34 RからStanへ</h3>");
    writeFileSync(join(root, "dist", "assets", "index.js"), "const id = 'stan-l34-q1-contract';");

    const result = auditBuiltApp(root);
    expect(result.findings).toEqual([
      expect.objectContaining({ category: "app-scope", rule: "built-stan-assessment" }),
    ]);
  });
});
