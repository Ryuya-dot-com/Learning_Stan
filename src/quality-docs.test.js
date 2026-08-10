import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const qualityRoot = join(root, "quality", "foundation-gate");
const read = (name) => readFileSync(join(qualityRoot, name), "utf8");
const step1QualityRoot = join(root, "quality", "step1-data-gate");
const readStep1 = (name) => readFileSync(join(step1QualityRoot, name), "utf8");
const transferQualityRoot = join(root, "quality", "step1-transfer-gate");
const readTransfer = (name) => readFileSync(join(transferQualityRoot, name), "utf8");
const stanReleaseQualityRoot = join(root, "quality", "stan-release-gate");
const readStanRelease = (name) => readFileSync(join(stanReleaseQualityRoot, name), "utf8");

describe("Foundation Gate実施キット", () => {
  it("実施手順・監査票・観察票・判定票を追跡可能な場所に持つ", () => {
    const hub = read("README.md");

    for (const file of [
      "ACCESSIBILITY_AUDIT.md",
      "LEARNER_OBSERVATION_PROTOCOL.md",
      "LEARNER_OBSERVATION_RECORD.md",
      "GATE_DECISION.md",
    ]) {
      expect(hub).toContain(`(${file})`);
      expect(read(file).length).toBeGreaterThan(500);
    }
  });

  it("実機監査に対象版・NVDA・VoiceOver・モバイル・WCAG基準がある", () => {
    const audit = read("ACCESSIBILITY_AUDIT.md");

    for (const required of [
      "対象commit SHA",
      "NVDA",
      "VoiceOver",
      "A11Y-MOBILE",
      "320 CSS px",
      "4.5:1",
      "WCAG 2.2",
    ]) expect(audit).toContain(required);
  });

  it("観察プロトコルが少人数結果を一般化せず、支援と外部要因を分離する", () => {
    const protocol = read("LEARNER_OBSERVATION_PROTOCOL.md");

    expect(protocol).toContain("達成率を母集団へ一般化しません");
    expect(protocol).toContain("正式な研究、論文、学会発表");
    expect(protocol).toContain("H3");
    expect(protocol).toContain("外部要因");
    for (let index = 1; index <= 7; index += 1) {
      expect(protocol).toContain(`T${String(index).padStart(2, "0")}`);
    }
  });

  it("匿名記録票が直接識別子を禁止し、観察事実と仮説を分ける", () => {
    const record = read("LEARNER_OBSERVATION_RECORD.md");

    expect(record).toContain("氏名・学籍番号・メール・成績・診断情報を記録しない");
    expect(record).toContain("観察した事実");
    expect(record).toContain("観察者の仮説");
    expect(record).toContain("支援水準を過小申告していない");
  });

  it("Gate判定が未実施を合格にせず、全証拠と重大問題ゼロを要求する", () => {
    const gate = read("GATE_DECISION.md");

    expect(gate).toContain("G01–G14がすべて`PASS`");
    expect(gate).toContain("未解決のP0・P1が0件");
    expect(gate).toContain("初学者3名以上");
    expect(gate).toContain("D-001");
    expect(gate).toContain("D-005");
    expect(gate).toContain("未実施を`FAIL`や`PASS`へ丸めません");
    expect(gate).toContain("主実装者とは別のレビュー者");
  });

  it("README・ロードマップ・実施キットの相対リンクが実在する", () => {
    const sources = [
      join(root, "README.md"),
      join(root, "ROADMAP.md"),
      ...[
        "README.md",
        "ACCESSIBILITY_AUDIT.md",
        "LEARNER_OBSERVATION_PROTOCOL.md",
        "LEARNER_OBSERVATION_RECORD.md",
        "GATE_DECISION.md",
      ].map((name) => join(qualityRoot, name)),
      join(root, "quality", "beginner-journey", "README.md"),
      ...[
        "README.md",
        "OBSERVATION_PROTOCOL.md",
        "FACILITATOR_KEY.md",
        "OBSERVATION_RECORD.md",
        "DECISION_RECORD.md",
      ].map((name) => join(step1QualityRoot, name)),
      ...[
        "README.md",
        "PARTICIPANT_TASK.md",
        "OBSERVATION_PROTOCOL.md",
        "FACILITATOR_KEY.md",
        "OBSERVATION_RECORD.md",
        "DECISION_RECORD.md",
      ].map((name) => join(transferQualityRoot, name)),
      ...[
        "README.md",
        "DECISION_RECORD.md",
        "FEEDBACK_NOTES.md",
      ].map((name) => join(stanReleaseQualityRoot, name)),
    ];

    for (const source of sources) {
      const markdown = readFileSync(source, "utf8");
      const targets = [...markdown.matchAll(/\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !/^(?:https?:|#)/.test(target))
        .map((target) => target.split("#")[0]);

      for (const target of targets) {
        expect(existsSync(join(dirname(source), target)), `${source}: ${target}`).toBe(true);
      }
    }
  });
});

describe("STEP 1 Data Quality Gate", () => {
  it("L12→L13観察の実施手順・採点キー・匿名記録・判断票を分離する", () => {
    const hub = readStep1("README.md");

    for (const file of [
      "OBSERVATION_PROTOCOL.md",
      "FACILITATOR_KEY.md",
      "OBSERVATION_RECORD.md",
      "DECISION_RECORD.md",
    ]) {
      expect(hub).toContain(`(${file})`);
      expect(readStep1(file).length).toBeGreaterThan(1000);
    }
    expect(hub).toContain("現時点の状態は`NOT RUN`");
    expect(hub).toContain("達成率を母集団へ一般化しません");
  });

  it("L13を見る前の判断、段階支援、raw保全、未見表転移を必須にする", () => {
    const protocol = readStep1("OBSERVATION_PROTOCOL.md");
    const key = readStep1("FACILITATOR_KEY.md");

    for (let index = 1; index <= 5; index += 1) {
      expect(protocol).toContain(`DQ${String(index).padStart(2, "0")}`);
    }
    for (const fragment of [
      "L13をまだ見ていない",
      "step1_analysis.R`をまだ開いていない",
      "step1-transfer.qmd`・`step1_transfer_check.R`をまだ開いていない",
      "7分間",
      "H3",
      "tools::md5sum",
      "transfer_raw",
      "fingerprint",
      "最初のコホートでは恣意的な合格率を置かず",
    ]) expect(protocol).toContain(fragment);
    expect(key).toContain("参加者へ事前に見せません");
    expect(key).toContain("13入力行");
    expect(key).toContain("5問題行");
    expect(key).toContain("8採用行");
    expect(key).toContain("serialize(transfer_raw, NULL)");
  });

  it("転移表の準備規則が5問題・8採用行になる", () => {
    const cleanLines = readFileSync(join(root, "public", "data", "rt_data.csv"), "utf8").trim().split(/\r?\n/);
    const participants = new Set(
      readFileSync(join(root, "public", "data", "participants.csv"), "utf8")
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.split(",")[0])
    );
    const transfer = cleanLines.slice(1).map((line) => {
      const [id, cond, rt, correct] = line.split(",");
      return { id, cond, rt: Number(rt), correct };
    });
    transfer[1].cond = "practice";
    transfer[3].rt = 90;
    transfer[5].id = "P04";
    transfer[7].correct = "";
    transfer.push({ ...transfer[0] });

    const seen = new Set();
    const issues = transfer.map((row) => {
      const key = [row.id, row.cond, row.rt, row.correct].join("|");
      const duplicate = seen.has(key);
      seen.add(key);
      if (duplicate) return "duplicate";
      if (!["cong", "incong"].includes(row.cond)) return "invalid_cond";
      if (row.rt < 100 || row.rt > 3000) return "rt_out_of_range";
      if (!participants.has(row.id)) return "unknown_participant";
      if (row.correct === "") return "missing_correct";
      return null;
    });

    expect(transfer).toHaveLength(13);
    expect(issues.filter(Boolean).sort()).toEqual([
      "duplicate",
      "invalid_cond",
      "missing_correct",
      "rt_out_of_range",
      "unknown_participant",
    ]);
    expect(issues.filter((issue) => issue == null)).toHaveLength(8);
  });

  it("匿名記録とコホート判断が事実・仮説・単一変更を分ける", () => {
    const record = readStep1("OBSERVATION_RECORD.md");
    const decision = readStep1("DECISION_RECORD.md");

    expect(record).toContain("氏名・学籍番号・メール・成績・診断情報を記録しない");
    expect(record).toContain("DQ01の最初の判断を後から上書きしていない");
    expect(record).toContain("観察した事実");
    expect(record).toContain("観察者の仮説");
    expect(record).toContain("外部要因を教材理解の失敗に含めていない");
    expect(decision).toContain("次版の単一変更");
    expect(decision).toContain("達成率を母集団へ一般化しません");
    expect(decision).toContain("`OBSERVED`は実施済みを意味し");
    expect(decision).toContain("反証条件");
  });
});

describe("STEP 1 Independent Transfer Gate", () => {
  it("参加者用課題と、期待値を持つ進行役資料・記録票・判断票を分離する", () => {
    const hub = readTransfer("README.md");

    for (const file of [
      "PARTICIPANT_TASK.md",
      "OBSERVATION_PROTOCOL.md",
      "FACILITATOR_KEY.md",
      "OBSERVATION_RECORD.md",
      "DECISION_RECORD.md",
    ]) {
      expect(hub).toContain(`(${file})`);
      expect(readTransfer(file).length).toBeGreaterThan(1000);
    }
    expect(hub).toContain("現時点の状態は`NOT RUN`");
    expect(hub).toContain("学習効果や母集団の達成率として一般化しません");
    expect(hub).toContain("これは運用検査であり、学習者観察や`OBSERVED`の証拠には数えません");
  });

  it("初回提出までは解答を隠し、公式ヘルプを許可してTR01〜TR05を観察する", () => {
    const protocol = readTransfer("OBSERVATION_PROTOCOL.md");

    for (let index = 1; index <= 5; index += 1) {
      expect(protocol).toContain(`TR${String(index).padStart(2, "0")}`);
    }
    for (const fragment of [
      "自発的なR Helpと公式パッケージ文書は利用可能",
      "step1_transfer_check.R`を開かない",
      "7分間",
      "H3",
      "初回提出を記録した後",
      "1回だけ修正",
      "REHEARSAL PASS",
      "この結果は参加者証拠へ数えない",
      "INDEPENDENT",
      "SELF_REPAIRED",
      "最初のコホートの結果を見てから",
    ]) expect(protocol).toContain(fragment);
  });

  it("参加者用課題は成果物契約を示すが、期待件数・数値・MD5を露出しない", () => {
    const task = readTransfer("PARTICIPANT_TASK.md");

    for (const fragment of [
      "data/processed/switch_trials_issues.csv",
      "data/processed/switch_trials_checked.csv",
      "output/switch_costs.csv",
      "output/transfer_note.txt",
      "switch_cost_ms = switch条件の平均response_ms - repeat条件の平均response_ms",
      "公式文書は参照できます",
    ]) expect(task).toContain(fragment);
    expect(task).not.toContain("55e3056af5bda9a8cf86c19df9b0ad6f");
    expect(task).not.toContain("21入力行");
    expect(task).not.toContain("16行");
    expect(task).not.toContain("| A01 | 420 | 500 | 80 |");
    expect(task).not.toContain("TRANSFER PASS");
  });

  it("採点キー・匿名記録・コホート判断が初回と修正後、事実と仮説を分ける", () => {
    const key = readTransfer("FACILITATOR_KEY.md");
    const record = readTransfer("OBSERVATION_RECORD.md");
    const decision = readTransfer("DECISION_RECORD.md");

    for (const fragment of [
      "55e3056af5bda9a8cf86c19df9b0ad6f",
      "21入力行",
      "5行",
      "16行",
      "14行",
      "| A01 | 420 | 500 | 80 |",
      "初回提出を固定",
    ]) expect(key).toContain(fragment);
    expect(record).toContain("氏名、学籍番号、メール、成績、診断情報");
    expect(record).toContain("初回チェッカー");
    expect(record).toContain("1回の自己修正");
    expect(record).toContain("観察した事実");
    expect(record).toContain("観察者の仮説");
    expect(decision).toContain("次版で検証する単一変更");
    expect(decision).toContain("競合する説明");
    expect(decision).toContain("自動チェッカーのPASS率だけでSTEP 2開始を決めません");
  });
});

describe("Stan Release Gate文書", () => {
  it("10証拠を必須6項目と改善4項目へ分けて現在のBLOCKEDを明記する", () => {
    const hub = readStanRelease("README.md");

    for (let index = 1; index <= 10; index += 1) {
      expect(hub).toContain(`SRG${String(index).padStart(2, "0")}`);
    }
    expect(hub).toContain("現在は`BLOCKED`");
    expect(hub).toContain("必須6項目");
    expect(hub).toContain("4/6");
    expect(hub).toContain("公開を止めない改善証拠（4項目）");
    expect(hub).toContain("decision`だけを`PASS`へ書き換えても");
    expect(hub).toContain("7〜14日");
    expect(hub).toContain("未実施でもベータ公開は可能");
  });

  it("第三者の口頭感想を署名なしの短い改善記録として扱う", () => {
    const hub = readStanRelease("README.md");
    const feedback = readStanRelease("FEEDBACK_NOTES.md");

    expect(hub).toContain("口頭・チャット・文書");
    expect(hub).toContain("独立署名は求めません");
    expect(feedback).toContain("正式な審査、署名、全範囲の確認は求めません");
    expect(feedback).toContain("未実施でもベータ公開は妨げません");
  });

  it("L40実測の二条件・診断・再現情報を判断票に持つ", () => {
    const decision = readStanRelease("DECISION_RECORD.md");

    for (const fragment of [
      "弱い群情報",
      "強い群情報",
      "source SHA-256",
      "R / CmdStanR / CmdStan",
      "divergence / treedepth / E-BFMI",
      "R-hat / bulk ESS / tail ESS / MCSE",
      "ESS per second",
      "事後同値性",
    ]) expect(decision).toContain(fragment);
  });

  it("公開する集約証拠と非公開の観察原本を分離する", () => {
    const hub = readStanRelease("README.md");
    const decision = readStanRelease("DECISION_RECORD.md");

    for (const fragment of [
      "入力済み観察記録",
      "録画・録音",
      "直接識別子",
      "private-variants",
      "匿名化した集約結果",
    ]) expect(hub).toContain(fragment);
    expect(decision).toContain("少人数の完遂率を母集団へ一般化しません");
  });
});
