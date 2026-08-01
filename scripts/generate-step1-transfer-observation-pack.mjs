import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const PACK_ROOT = "Learning_Stan_STEP1_Transfer_Observation";
export const PACK_PATH = join(
  projectRoot,
  "quality",
  "step1-transfer-gate",
  "participant-pack.zip"
);
export const PACK_DATE = new Date("2026-08-01T00:00:00.000Z");
export const PACK_FILES = Object.freeze([
  ["quality/step1-transfer-gate/PARTICIPANT_TASK.md", "PARTICIPANT_TASK.md"],
  ["public/data/transfer/switch_trials_dirty.csv", "data/transfer/switch_trials_dirty.csv"],
  ["public/data/transfer/switch_participants.csv", "data/transfer/switch_participants.csv"],
]);

const FORBIDDEN_FILE_FRAGMENTS = Object.freeze([
  "step1_analysis",
  "nb1-data",
  "step1-transfer.qmd",
  "step1_transfer_check",
  "facilitator",
]);

const FORBIDDEN_TASK_FRAGMENTS = Object.freeze([
  "55e3056af5bda9a8cf86c19df9b0ad6f",
  "21入力行",
  "16行",
  "| A01 | 420 | 500 | 80 |",
  "TRANSFER PASS",
]);

export async function buildTransferObservationPack() {
  const zip = new JSZip();

  for (const [source, destination] of PACK_FILES) {
    zip.file(`${PACK_ROOT}/${destination}`, await readFile(join(projectRoot, source)), {
      binary: true,
      createFolders: false,
      date: PACK_DATE,
    });
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
}

export async function verifyTransferObservationPack(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const expectedFiles = new Set(
    PACK_FILES.map(([, destination]) => `${PACK_ROOT}/${destination}`)
  );
  const actualFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);

  if (
    actualFiles.length !== expectedFiles.size ||
    actualFiles.some((name) => !expectedFiles.has(name))
  ) {
    throw new Error(`Transfer observation pack manifest mismatch: ${actualFiles.join(", ")}`);
  }

  for (const name of actualFiles) {
    const normalized = name.toLowerCase();
    if (!name.startsWith(`${PACK_ROOT}/`) || name.includes("\\") || name.includes("../")) {
      throw new Error(`Unsafe transfer observation pack path: ${name}`);
    }
    const forbidden = FORBIDDEN_FILE_FRAGMENTS.find((fragment) => normalized.includes(fragment));
    if (forbidden) throw new Error(`Transfer observation pack exposes ${forbidden}: ${name}`);
  }

  for (const [source, destination] of PACK_FILES) {
    const [sourceBuffer, packedBuffer] = await Promise.all([
      readFile(join(projectRoot, source)),
      zip.file(`${PACK_ROOT}/${destination}`).async("nodebuffer"),
    ]);
    if (!sourceBuffer.equals(packedBuffer)) {
      throw new Error(`Transfer observation pack content differs: ${destination}`);
    }
  }

  const task = await zip.file(`${PACK_ROOT}/PARTICIPANT_TASK.md`).async("string");
  for (const fragment of FORBIDDEN_TASK_FRAGMENTS) {
    if (task.includes(fragment)) {
      throw new Error(`Participant task exposes hidden expectation: ${fragment}`);
    }
  }

  return { files: actualFiles.length, root: PACK_ROOT };
}

async function main() {
  const generated = await buildTransferObservationPack();
  await verifyTransferObservationPack(generated);

  if (process.argv.includes("--check")) {
    const published = await readFile(PACK_PATH);
    if (!published.equals(generated)) {
      throw new Error(
        "Transfer observation pack is stale. Run: npm run generate:step1-transfer-observation-pack"
      );
    }
    console.log(`STEP 1 transfer observation pack: ${PACK_FILES.length} safe files verified`);
    return;
  }

  await mkdir(dirname(PACK_PATH), { recursive: true });
  await writeFile(PACK_PATH, generated);
  console.log(`STEP 1 transfer observation pack generated: ${PACK_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
