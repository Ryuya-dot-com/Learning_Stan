import { describe, expect, it } from "vitest";
import {
  loadStep2Content,
  validateCurriculum,
  validateData,
  validateDocuments,
  validateStep2Content,
} from "./step2-content-verifier.mjs";

const content = loadStep2Content();

describe("STEP 2公開教材パック", () => {
  it("カリキュラム・データ・原稿・Rコードが同期している", () => {
    expect(validateStep2Content(content)).toEqual([]);
  });

  it("初学者観察を公開前ゲートへ戻す変更を拒否する", () => {
    const broken = structuredClone(content.curriculum);
    broken.releasePrerequisites = [
      { gate: "step2-learning-observation", requiredDecision: "OBSERVED" },
    ];
    expect(validateCurriculum(broken)).toContain(
      "STEP 2に公開前の観察ゲートを設定してはいけません",
    );
  });

  it("初学者フィードバックを公開後の改善へ使う方針を固定する", () => {
    const broken = structuredClone(content.curriculum);
    broken.feedbackPolicy = "公開前に観察する";
    expect(validateCurriculum(broken)).toContain(
      "初学者フィードバックを公開後の改善に使う方針がありません",
    );
  });

  it("表示番号と意味IDを混同したカリキュラムを拒否する", () => {
    const broken = structuredClone(content.curriculum);
    broken.lessons[0].id = "l17";
    expect(validateCurriculum(broken)).toContain("l17: 永続IDが意味キー形式ではありません");
  });

  it("前段階を飛ばす依存関係を検出する", () => {
    const broken = structuredClone(content.curriculum);
    broken.lessons[2].prerequisites = ["step2-describe-distributions"];
    expect(validateCurriculum(broken)).toContain(
      "step2-show-individuals: 前提はstep2-grammar-of-graphicsでなければなりません",
    );
  });

  it("成果物の件数だけでなく名前と順序の不一致を検出する", () => {
    const broken = structuredClone(content.curriculum);
    broken.scenario.deliverables[2] = "output/untracked_summary.csv";
    expect(validateCurriculum(broken)).toContain(
      "STEP 2の最終成果物6件が契約どおりではありません",
    );
  });

  it("合成データが書き換わるとfingerprint不一致になる", () => {
    const changedSource = content.dataSource.replace("P01,cong,1,485,true", "P01,cong,1,486,true");
    const changedData = {
      ...content.data,
      rows: content.data.rows.map((row, index) =>
        index === 0 ? { ...row, rt_ms: "486" } : row,
      ),
    };
    expect(validateData(changedSource, changedData, content.validation)).toContain(
      "STEP 2 CSVのSHA-256が検証契約と一致しません",
    );
  });

  it("試行を参加者内で要約しないRコードを拒否する", () => {
    const broken = {
      ...content,
      rSource: content.rSource.replace(
        "dplyr::group_by(id, condition)",
        "dplyr::group_by(condition)",
      ),
    };
    expect(validateDocuments(broken)).toContain(
      "L17 Rコードに「dplyr::group_by(id, condition)」がありません",
    );
  });

  it("合成データ表記を消した原稿を拒否する", () => {
    const broken = {
      ...content,
      manuscript: content.manuscript.replaceAll("合成データ", "教材データ"),
    };
    expect(validateDocuments(broken)).toContain("L17原稿に「合成データ」がありません");
  });

  it("参加者点を消したL18コードを拒否する", () => {
    const broken = {
      ...content,
      l18RSource: content.l18RSource.replace("ggplot2::geom_point(", "ggplot2::geom_blank("),
    };
    expect(validateDocuments(broken)).toContain(
      "L18 Rコードに「ggplot2::geom_point(」がありません",
    );
  });

  it("L18 PNGの寸法契約変更を検出する", () => {
    const broken = structuredClone(content);
    broken.validation.expected.figures.conditionDistributions.widthPx = 2000;
    expect(validateDocuments(broken)).toContain("L18条件別分布図の検証契約が不正です");
  });

  it("参加者IDの対応を消したL19コードを拒否する", () => {
    const broken = {
      ...content,
      l19RSource: content.l19RSource.replace(
        "ggplot2::aes(group = id)",
        "ggplot2::aes(group = condition)",
      ),
    };
    expect(validateDocuments(broken)).toContain(
      "L19 Rコードに「ggplot2::aes(group = id)」がありません",
    );
  });

  it("L19 PNGの線数契約変更を検出する", () => {
    const broken = structuredClone(content);
    broken.validation.expected.figures.participantDifferences.lineGroups = 48;
    expect(validateDocuments(broken)).toContain("L19参加者内対応図の検証契約が不正です");
  });

  it("L20の入力fingerprint検査を消したコードを拒否する", () => {
    const broken = {
      ...content,
      l20RSource: content.l20RSource.replaceAll("tools::md5sum(input_path)", "input_path"),
    };
    expect(validateDocuments(broken)).toContain(
      "L20 Rコードに「tools::md5sum(input_path)」がありません",
    );
  });

  it("L20をGlobal Environmentへ再依存させる変更を拒否する", () => {
    const broken = {
      ...content,
      l20RSource: content.l20RSource.replace(
        'new.env(parent = asNamespace("stats"))',
        "new.env(parent = globalenv())",
      ),
    };
    expect(validateDocuments(broken)).toContain(
      'L20 Rコードに「new.env(parent = asNamespace("stats"))」がありません',
    );
  });

  it("L20最終分析パックの成果物欠落を検出する", () => {
    const broken = structuredClone(content);
    broken.validation.expected.finalPortfolio.outputs.pop();
    expect(validateDocuments(broken)).toContain("L20最終分析パックの検証契約が不正です");
  });
});
