import { describe, expect, it } from "vitest";
import {
  loadStep2Assessments,
  validateAssessmentContract,
} from "./step2-assessment-verifier.mjs";

const content = loadStep2Assessments();

describe("STEP 2内容理解問題", () => {
  it("L17–L20の目標次元、診断、rubric、原稿、直接証拠が同期している", () => {
    expect(validateAssessmentContract(content)).toEqual([]);
  });

  it("誤答診断の欠落を検出する", () => {
    const broken = structuredClone(content);
    delete broken.assessments.lessons[0].questions[0].choices[0].diagnostic;
    expect(validateAssessmentContract(broken)).toContain(
      "step2-l17-q1-row-count:trials-all: 誤答診断がありません",
    );
  });

  it("存在しない正答IDを検出する", () => {
    const broken = structuredClone(content);
    broken.assessments.lessons[1].questions[0].correctChoiceId = "missing";
    expect(validateAssessmentContract(broken)).toContain(
      "step2-l18-q1-aes-roles: correctChoiceIdが選択肢にありません",
    );
  });

  it("カリキュラム外の測定次元を検出する", () => {
    const broken = structuredClone(content);
    broken.assessments.lessons[0].questions[0].targetDimensions = ["p-value"];
    expect(validateAssessmentContract(broken)).toContain(
      "step2-l17-q1-row-count: 未定義の測定次元p-valueがあります",
    );
  });

  it("記述rubricの不足を検出する", () => {
    const broken = structuredClone(content);
    broken.assessments.lessons[1].questions[3].rubric = [
      broken.assessments.lessons[1].questions[3].rubric[0],
    ];
    expect(validateAssessmentContract(broken)).toContain(
      "step2-l18-q4-why-points: 記述rubricは3観点以上必要です",
    );
  });

  it("原稿に載らない問題IDを検出する", () => {
    const broken = {
      ...content,
      manuscripts: new Map(content.manuscripts),
    };
    broken.manuscripts.set(
      "step2-grammar-of-graphics",
      broken.manuscripts
        .get("step2-grammar-of-graphics")
        .replace("step2-l18-q5-transfer-yield", "missing-question"),
    );
    expect(validateAssessmentContract(broken)).toContain(
      "step2-l18-q5-transfer-yield: 対応原稿に問題IDがありません",
    );
  });

  it("L19の対応キー次元をカリキュラムと照合する", () => {
    const broken = structuredClone(content);
    broken.assessments.lessons[2].outcomeDimensions[0] = "row-order";
    expect(validateAssessmentContract(broken)).toContain(
      "step2-show-individuals: 到達目標次元がカリキュラムと一致しません",
    );
  });

  it("L20の再現可能性次元をカリキュラムと照合する", () => {
    const broken = structuredClone(content);
    broken.assessments.lessons[3].outcomeDimensions[0] = "manual-export";
    expect(validateAssessmentContract(broken)).toContain(
      "step2-report-and-transfer: 到達目標次元がカリキュラムと一致しません",
    );
  });
});
