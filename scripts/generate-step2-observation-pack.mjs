import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const PACK_ROOT = "Learning_Stan_STEP2_Observation";
export const GATE_DIR = join(projectRoot, "quality", "step2-observation-gate");
export const DATA_PATH = join(GATE_DIR, "fixtures", "device_load_trials.csv");
export const PACK_PATH = join(GATE_DIR, "participant-pack.zip");
export const PACK_DATE = new Date("2026-08-01T00:00:00.000Z");
export const TASK_SOURCE = join(GATE_DIR, "PARTICIPANT_TASK.md");

const FORBIDDEN_FILE_FRAGMENTS = Object.freeze([
  "checker",
  "facilitator",
  "decision",
  "observation_record",
  "status.json",
  "report_and_transfer",
]);

const FORBIDDEN_TASK_FRAGMENTS = Object.freeze([
  "S2O REHEARSAL PASS",
  "STEP 2 TRANSFER PASS",
  "device_condition_summary.csvは32行",
  "device_differences.csvは16行",
  "全16台でhigh_load",
]);

export function generateDeviceLoadCsv() {
  const lines = ["device_id,load_condition,reading,latency_ms,valid"];
  for (let device = 1; device <= 16; device += 1) {
    const deviceId = `D${String(device).padStart(2, "0")}`;
    for (const condition of ["baseline", "high_load"]) {
      for (let reading = 1; reading <= 12; reading += 1) {
        const base = 110 + device * 4;
        const noise = condition === "baseline"
          ? ((device * 11 + reading * 7) % 17) - 8
          : ((device * 13 + reading * 5) % 21) - 10;
        const loadIncrease = condition === "high_load" ? 28 + device * 2 : 0;
        const latency = base + loadIncrease + noise;
        const valid = reading !== 12;
        lines.push(`${deviceId},${condition},${reading},${latency},${valid}`);
      }
    }
  }
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function buildStep2ObservationPack() {
  const zip = new JSZip();
  const task = await readFile(TASK_SOURCE);
  const data = generateDeviceLoadCsv();
  zip.file(`${PACK_ROOT}/PARTICIPANT_TASK.md`, task, {
    binary: true,
    createFolders: false,
    date: PACK_DATE,
  });
  zip.file(`${PACK_ROOT}/data/device_load_trials.csv`, data, {
    binary: true,
    createFolders: false,
    date: PACK_DATE,
  });
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
}

export async function verifyStep2ObservationPack(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const expected = new Set([
    `${PACK_ROOT}/PARTICIPANT_TASK.md`,
    `${PACK_ROOT}/data/device_load_trials.csv`,
  ]);
  const actual = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);

  if (actual.length !== expected.size || actual.some((name) => !expected.has(name))) {
    throw new Error(`STEP 2 observation pack manifest mismatch: ${actual.join(", ")}`);
  }
  for (const name of actual) {
    const normalized = name.toLowerCase();
    if (!name.startsWith(`${PACK_ROOT}/`) || name.includes("\\") || name.includes("../")) {
      throw new Error(`Unsafe STEP 2 observation pack path: ${name}`);
    }
    const forbidden = FORBIDDEN_FILE_FRAGMENTS.find((fragment) => normalized.includes(fragment));
    if (forbidden) throw new Error(`STEP 2 observation pack exposes ${forbidden}: ${name}`);
  }

  const packedTask = await zip.file(`${PACK_ROOT}/PARTICIPANT_TASK.md`).async("string");
  for (const fragment of FORBIDDEN_TASK_FRAGMENTS) {
    if (packedTask.includes(fragment)) {
      throw new Error(`STEP 2 participant task exposes hidden expectation: ${fragment}`);
    }
  }
  const [sourceTask, packedData] = await Promise.all([
    readFile(TASK_SOURCE),
    zip.file(`${PACK_ROOT}/data/device_load_trials.csv`).async("nodebuffer"),
  ]);
  const packedTaskBuffer = await zip.file(`${PACK_ROOT}/PARTICIPANT_TASK.md`).async("nodebuffer");
  if (!sourceTask.equals(packedTaskBuffer)) throw new Error("STEP 2 task differs in pack");
  const expectedData = generateDeviceLoadCsv();
  if (!expectedData.equals(packedData)) throw new Error("STEP 2 data differs in pack");

  return {
    files: actual.length,
    root: PACK_ROOT,
    rows: expectedData.toString("utf8").trimEnd().split("\n").length - 1,
    sha256: sha256(expectedData),
  };
}

async function main() {
  const expectedData = generateDeviceLoadCsv();
  const generatedPack = await buildStep2ObservationPack();
  await verifyStep2ObservationPack(generatedPack);

  if (process.argv.includes("--check")) {
    const [publishedData, publishedPack] = await Promise.all([
      readFile(DATA_PATH),
      readFile(PACK_PATH),
    ]);
    if (!publishedData.equals(expectedData)) {
      throw new Error("STEP 2 observation data is stale. Run the generator.");
    }
    if (!publishedPack.equals(generatedPack)) {
      throw new Error("STEP 2 observation pack is stale. Run the generator.");
    }
    console.log(
      `STEP 2 observation pack verified: 2 safe files, 384 rows, SHA-256 ${sha256(expectedData)}`
    );
    return;
  }

  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, expectedData);
  await writeFile(PACK_PATH, generatedPack);
  console.log(`STEP 2 observation pack generated: ${PACK_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
