import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const BUNDLE_ROOT = "Learning_Stan_STEP1";
export const BUNDLE_PATH = join(projectRoot, "public", "downloads", "learning-stan-step1.zip");
export const BUNDLE_DATE = new Date("2026-08-01T00:00:00.000Z");

export const BUNDLE_FILES = Object.freeze([
  ["public/notebooks/nb1-data.qmd", "nb1-data.qmd"],
  ["public/scripts/step1_analysis.R", "step1_analysis.R"],
  ["public/challenges/step1-transfer.qmd", "step1-transfer.qmd"],
  ["public/challenges/step1_transfer_check.R", "step1_transfer_check.R"],
  ["public/data/rt_data.csv", "data/rt_data.csv"],
  ["public/data/participants.csv", "data/participants.csv"],
  ["public/data/rt_data_dirty.csv", "data/rt_data_dirty.csv"],
  ["public/data/rt_data.tsv", "data/rt_data.tsv"],
  ["public/data/participants_pipe.txt", "data/participants_pipe.txt"],
  ["public/data/trials.xlsx", "data/trials.xlsx"],
  ["public/data/batches/batch_01.xlsx", "data/batches/batch_01.xlsx"],
  ["public/data/batches/batch_02.xlsx", "data/batches/batch_02.xlsx"],
  ["public/data/transfer/switch_trials_dirty.csv", "data/transfer/switch_trials_dirty.csv"],
  ["public/data/transfer/switch_participants.csv", "data/transfer/switch_participants.csv"],
]);

export const BUNDLE_README = `Learning Stan: STEP 1 スターター
=====================================

このフォルダには、STEP 1「実データを読み、整える」で使う演習ノートと
入力データが、教材コードと同じ配置で入っています。

はじめ方
1. ZIPを右クリックして「すべて展開」します。
2. RStudioを開き、File > New Project > Existing Directoryを選びます。
3. 展開後の Learning_Stan_STEP1 フォルダをProjectに指定します。
4. 説明を読みながら進める場合はnb1-data.qmd、完成した一括処理を
   実行・編集する場合はstep1_analysis.Rを開きます。
5. 未導入の場合だけ、Consoleで次を1回実行します。
   install.packages(c("tidyverse", "readxl", "knitr", "rmarkdown"))
6. 上から順にコードを実行します。最後にoutput/condition_means.csvが
   3行3列で作成され、output/analysis_note.txtに分析対象・記述結果・
   限界の3行が保存されれば、中心課題は完了です。
7. 中心課題の後、step1-transfer.qmdで列名と条件名が異なるデータへ
   同じ品質方針を移します。step1_transfer_check.RのTRANSFER PASSが
   発展課題の完成条件です。

重要
- data/にある配布ファイル(raw)は上書きしません。
- 問題記録と検査済みデータはdata/processed/へ、要約結果はoutput/へ
  コードから生成します。これらのフォルダは実行時に自動作成されます。
- ファイルを手で直して結果を合わせず、コードを修正して再実行します。

教材サイト: https://ryuya-dot-com.github.io/Learning_Stan/
`;

export async function buildStep1Bundle() {
  const zip = new JSZip();

  zip.file(`${BUNDLE_ROOT}/README.txt`, BUNDLE_README, {
    createFolders: false,
    date: BUNDLE_DATE,
  });
  for (const [source, destination] of BUNDLE_FILES) {
    const contents = await readFile(join(projectRoot, source));
    zip.file(`${BUNDLE_ROOT}/${destination}`, contents, {
      binary: true,
      createFolders: false,
      date: BUNDLE_DATE,
    });
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
}

export async function verifyStep1Bundle(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const expectedFiles = new Set([
    `${BUNDLE_ROOT}/README.txt`,
    ...BUNDLE_FILES.map(([, destination]) => `${BUNDLE_ROOT}/${destination}`),
  ]);
  const actualFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);

  if (actualFiles.length !== expectedFiles.size || actualFiles.some((name) => !expectedFiles.has(name))) {
    throw new Error(`STEP 1 bundle manifest mismatch: ${actualFiles.join(", ")}`);
  }

  const readme = await zip.file(`${BUNDLE_ROOT}/README.txt`).async("string");
  for (const required of ["Existing Directory", "step1_analysis.R", "data/processed/", "output/condition_means.csv"]) {
    if (!readme.includes(required)) throw new Error(`STEP 1 bundle README is missing: ${required}`);
  }

  for (const [source, destination] of BUNDLE_FILES) {
    const [sourceBuffer, bundledBuffer] = await Promise.all([
      readFile(join(projectRoot, source)),
      zip.file(`${BUNDLE_ROOT}/${destination}`).async("nodebuffer"),
    ]);
    if (!sourceBuffer.equals(bundledBuffer)) {
      throw new Error(`STEP 1 bundle content differs: ${destination}`);
    }
  }

  return { files: actualFiles.length, root: BUNDLE_ROOT };
}

async function main() {
  const generated = await buildStep1Bundle();
  await verifyStep1Bundle(generated);

  if (process.argv.includes("--check")) {
    const published = await readFile(BUNDLE_PATH);
    if (!published.equals(generated)) {
      throw new Error("STEP 1 bundle is stale. Run: npm run generate:step1-bundle");
    }
    console.log(`STEP 1 bundle: ${BUNDLE_FILES.length + 1} files verified`);
    return;
  }

  await mkdir(dirname(BUNDLE_PATH), { recursive: true });
  await writeFile(BUNDLE_PATH, generated);
  console.log(`STEP 1 bundle generated: ${BUNDLE_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
