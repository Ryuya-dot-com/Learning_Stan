import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "content", "step2", "data", "expanded_pilot_trials.csv");
const SEED = 20260802;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random) {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateStep2Rows(seed = SEED) {
  const random = mulberry32(seed);
  const rows = [];

  for (let participant = 1; participant <= 24; participant += 1) {
    const id = `P${String(participant).padStart(2, "0")}`;
    const participantOffset = normal(random) * 45;
    const incongruentCost = 65 + normal(random) * 18;

    for (const condition of ["cong", "incong"]) {
      for (let trial = 1; trial <= 20; trial += 1) {
        const conditionOffset = condition === "incong" ? incongruentCost : 0;
        const practiceOffset = -1.2 * trial;
        const longTail = random() < 0.025 ? 220 + random() * 120 : 0;
        const rt = Math.round(
          Math.max(
            250,
            Math.min(
              1500,
              520 + participantOffset + conditionOffset + practiceOffset + normal(random) * 55 + longTail,
            ),
          ),
        );
        const errorProbability = condition === "incong" ? 0.1 : 0.05;
        const correct = random() >= errorProbability;

        rows.push({ id, condition, trial, rt_ms: rt, correct });
      }
    }
  }

  return rows;
}

function serializeStep2Rows(rows) {
  const header = "id,condition,trial,rt_ms,correct";
  const lines = rows.map(({ id, condition, trial, rt_ms, correct }) =>
    [id, condition, trial, rt_ms, correct].join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

function main(args = process.argv.slice(2)) {
  const csv = serializeStep2Rows(generateStep2Rows());

  if (args.includes("--check")) {
    const current = readFileSync(OUTPUT, "utf8");
    if (current !== csv) {
      throw new Error("STEP 2合成データが固定生成結果と一致しません");
    }
    console.log("STEP 2 sample verified: 24 participants, 960 trials");
    return;
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, csv, "utf8");
  console.log(`Generated ${OUTPUT}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export { SEED, generateStep2Rows, serializeStep2Rows };
