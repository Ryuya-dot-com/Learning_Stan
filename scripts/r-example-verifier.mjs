import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODES = new Set(["exact", "numeric", "stochastic", "manual"]);
const NUMBER_PATTERN = /[-+]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|Inf|NaN)/g;
const EXPECTED_R_VERSION = "4.6.1";
const R_LESSON_DIRECTORIES = new Set([
  "0-basics",
  "1-setup",
  "2-data",
  // STEP 2はMarkdown原稿からViteで組み立て、4本の専用R実行検証で確認する。
  "4-sim",
  "5-bayes",
  "6-brms",
  "bridge",
  "extra",
]);

function normalizeOutput(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

function stripIndexes(value) {
  return normalizeOutput(value).replace(/\[\s*\d+\s*\]/g, "[]");
}

function extractNumbers(value) {
  const withoutIndexes = normalizeOutput(value).replace(/\[\s*\d+\s*\]/g, "");
  return [...withoutIndexes.matchAll(NUMBER_PATTERN)].map(([token]) => Number(token));
}

function numericSkeleton(value) {
  return stripIndexes(value).replace(NUMBER_PATTERN, "#").replace(/\s+/g, " ").trim();
}

function compareOutput(example, actualOutput) {
  const actual = normalizeOutput(actualOutput);
  const expected = normalizeOutput(example.out);
  const verify = example.verify;

  if (verify.mode === "exact") {
    return actual === expected
      ? { ok: true }
      : { ok: false, message: `expected:\n${expected}\nactual:\n${actual}` };
  }

  if (verify.mode === "numeric") {
    if (numericSkeleton(actual) !== numericSkeleton(expected)) {
      return { ok: false, message: "numeric出力の非数値部分が一致しません" };
    }
    const actualNumbers = extractNumbers(actual);
    const expectedNumbers = extractNumbers(expected);
    if (actualNumbers.length !== expectedNumbers.length) {
      return { ok: false, message: `数値の個数が不一致: expected ${expectedNumbers.length}, actual ${actualNumbers.length}` };
    }
    const absolute = verify.absoluteTolerance ?? 1e-8;
    const relative = verify.relativeTolerance ?? 1e-8;
    for (let i = 0; i < expectedNumbers.length; i += 1) {
      const a = actualNumbers[i];
      const e = expectedNumbers[i];
      if (Object.is(a, e)) continue;
      if (!Number.isFinite(a) || !Number.isFinite(e)) {
        return { ok: false, message: `数値${i + 1}が不一致: expected ${e}, actual ${a}` };
      }
      const tolerance = Math.max(absolute, Math.abs(e) * relative);
      if (Math.abs(a - e) > tolerance) {
        return { ok: false, message: `数値${i + 1}が許容誤差外: expected ${e}, actual ${a}, tolerance ${tolerance}` };
      }
    }
    return { ok: true };
  }

  if (verify.mode === "stochastic") {
    const numbers = extractNumbers(actual);
    for (const range of verify.ranges) {
      const value = numbers[range.index];
      if (!Number.isFinite(value) || value < range.min || value > range.max) {
        return {
          ok: false,
          message: `${range.label || `数値${range.index + 1}`}が範囲外: ${value} not in [${range.min}, ${range.max}]`,
        };
      }
    }
    return { ok: true };
  }

  throw new Error(`${example.id}: manual例は出力比較できません`);
}

function classifyBlock(block, id) {
  if (!block.code) return null;
  const verify = { ...(block.verify || {}) };
  verify.mode ||= block.out != null ? "exact" : null;

  if (!MODES.has(verify.mode)) {
    throw new Error(`${id}: code例に有効なverify.modeがありません`);
  }
  if (block.lang && block.lang !== "R" && verify.mode !== "manual") {
    throw new Error(`${id}: ${block.lang}コードはR検証器で自動実行できません`);
  }
  if (verify.mode === "manual") {
    if (typeof verify.reason !== "string" || !verify.reason.trim()) {
      throw new Error(`${id}: manual例にはreasonが必要です`);
    }
    if (verify.parse != null && typeof verify.parse !== "boolean") {
      throw new Error(`${id}: manual例のparseはbooleanで指定してください`);
    }
  } else if (verify.mode === "stochastic") {
    if (!Array.isArray(verify.ranges) || verify.ranges.length === 0) {
      throw new Error(`${id}: stochastic例には1件以上のrangesが必要です`);
    }
    for (const range of verify.ranges) {
      if (!Number.isInteger(range.index) || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) {
        throw new Error(`${id}: stochastic rangesのindex/min/maxが不正です`);
      }
    }
  } else if (block.out == null) {
    throw new Error(`${id}: ${verify.mode}例には期待出力outが必要です`);
  }
  return verify;
}

async function loadLessons(rootDir) {
  const lessonsDir = join(rootDir, "src", "data", "lessons");
  const paths = readdirSync(lessonsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && R_LESSON_DIRECTORIES.has(entry.name))
    .flatMap((section) =>
      readdirSync(join(lessonsDir, section.name), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
        .map((entry) => join(lessonsDir, section.name, entry.name))
    )
    .sort((a, b) => a.localeCompare(b, "en"));

  return Promise.all(
    paths.map(async (path) => ({
      path,
      lesson: (await import(pathToFileURL(path).href)).default,
    }))
  );
}

function collectExamples(lessonModules) {
  const examples = [];
  for (const { lesson, path } of lessonModules) {
    const setup = [];
    lesson.pages.forEach((page, index) => {
      if (!page.code) return;
      const id = `${lesson.id}:page:${index + 1}`;
      const verify = classifyBlock(page, id);
      examples.push({ id, source: path, code: page.code, out: page.out, verify, setup: setup.join("\n\n") });
      if (verify.mode !== "manual") setup.push(page.code);
    });
    lesson.ex.forEach((exercise, index) => {
      if (!exercise.code) return;
      const id = `${lesson.id}:exercise:${index + 1}`;
      const verify = classifyBlock(exercise, id);
      examples.push({
        id,
        source: path,
        code: exercise.code,
        out: exercise.out,
        verify,
        setup: setup.join("\n\n"),
      });
    });
    (lesson.practice?.items || []).forEach((item, index) => {
      if (!item.code) return;
      const id = `${lesson.id}:practice:${item.id || index + 1}`;
      const verify = classifyBlock(item, id);
      examples.push({ id, source: path, code: item.code, out: item.out, verify, setup: "" });
    });
  }
  return examples;
}

function workingRscript(candidate) {
  if (!candidate) return false;
  const result = spawnSync(candidate, ["--version"], { encoding: "utf8", windowsHide: true });
  return !result.error && result.status === 0;
}

function findRscript(environment = process.env, expectedVersion = EXPECTED_R_VERSION) {
  const candidates = [environment.RSCRIPT];
  if (process.platform === "win32") {
    for (const base of [
      environment.LOCALAPPDATA && join(environment.LOCALAPPDATA, "Programs", "R"),
      environment.ProgramFiles && join(environment.ProgramFiles, "R"),
    ].filter(Boolean)) {
      if (!existsSync(base)) continue;
      const versions = readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("R-"))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
      for (const version of versions) candidates.push(join(base, version, "bin", "Rscript.exe"));
    }
  }
  candidates.push("Rscript", "Rscript.exe");
  const installed = [...new Set(candidates.filter(Boolean))]
    .filter(workingRscript)
    .map((path) => ({ path, version: getRVersion(path) }));
  const found = installed.find(({ version }) => version === expectedVersion);
  if (!found) {
    const detail = installed.length > 0
      ? installed.map(({ path, version }) => `${path} (${version})`).join(", ")
      : "なし";
    throw new Error(`R ${expectedVersion}が見つかりません。検出結果: ${detail}`);
  }
  return found.path;
}

function getRVersion(rscript) {
  const result = spawnSync(rscript, ["--vanilla", "-e", "cat(as.character(getRversion()))"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Rバージョンを取得できません: ${normalizeOutput(result.stderr || result.error?.message)}`);
  }
  return normalizeOutput(result.stdout);
}

function runExample(rscript, example, tempDir) {
  const filename = `${example.id.replace(/[^a-zA-Z0-9_-]/g, "-")}.R`;
  const path = join(tempDir, filename);
  const setup = example.setup
    ? `invisible(capture.output({\n${example.setup}\n}))\n`
    : "";
  const script = [
    'invisible(options(width = 80, useFancyQuotes = FALSE))',
    'invisible(Sys.setenv(LANGUAGE = "en"))',
    setup,
    example.code,
    "",
  ].join("\n");
  writeFileSync(path, script, "utf8");

  const rPath = path.replace(/\\/g, "/").replace(/'/g, "\\'");
  const expression = `source('${rPath}', echo = FALSE, print.eval = TRUE, encoding = 'UTF-8')`;
  const result = spawnSync(rscript, ["--vanilla", "-e", expression], {
    cwd: tempDir,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, LANGUAGE: "en" },
  });
  if (result.error) return { ok: false, message: result.error.message };
  if (result.status !== 0) {
    return { ok: false, message: normalizeOutput(result.stderr || result.stdout) };
  }
  return compareOutput(example, result.stdout);
}

function parseExample(rscript, example) {
  const result = spawnSync(
    rscript,
    ["--vanilla", "-e", "parse(text = Sys.getenv('LEARNING_STAN_R_CODE'), keep.source = FALSE)"],
    {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        LANGUAGE: "en",
        LEARNING_STAN_R_CODE: [example.setup, example.code].filter(Boolean).join("\n\n"),
      },
    }
  );
  if (result.error) return { ok: false, message: result.error.message };
  if (result.status !== 0) {
    return { ok: false, message: normalizeOutput(result.stderr || result.stdout) };
  }
  return { ok: true };
}

async function verifyExamples({
  rootDir = process.cwd(),
  log = console.log,
  expectedRVersion = EXPECTED_R_VERSION,
} = {}) {
  const lessons = await loadLessons(rootDir);
  const examples = collectExamples(lessons);
  const rscript = findRscript(process.env, expectedRVersion);
  const rVersion = getRVersion(rscript);
  if (rVersion !== expectedRVersion) {
    throw new Error(`Rバージョンが不一致です: expected ${expectedRVersion}, actual ${rVersion}`);
  }
  const tempDir = mkdtempSync(join(tmpdir(), "learning-stan-r-"));
  const failures = [];
  let passed = 0;
  let manual = 0;

  try {
    const publicDataDir = join(rootDir, "public", "data");
    if (existsSync(publicDataDir)) {
      cpSync(publicDataDir, join(tempDir, "data"), { recursive: true });
    }
    for (const example of examples) {
      if (example.verify.mode === "manual") {
        manual += 1;
        if (example.verify.parse) {
          const result = parseExample(rscript, example);
          if (!result.ok) {
            failures.push({ example, message: result.message });
            log(`FAIL   ${example.id}: R構文エラー: ${result.message}`);
            continue;
          }
          log(`MANUAL ${example.id} (syntax checked): ${example.verify.reason}`);
        } else {
          log(`MANUAL ${example.id}: ${example.verify.reason}`);
        }
        continue;
      }
      const result = runExample(rscript, example, tempDir);
      if (result.ok) {
        passed += 1;
        log(`PASS   ${example.id} (${example.verify.mode})`);
      } else {
        failures.push({ example, message: result.message });
        log(`FAIL   ${example.id}: ${result.message}`);
      }
    }
  } finally {
    if (basename(tempDir).startsWith("learning-stan-r-")) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  log(`R ${rVersion} examples: ${passed} passed, ${manual} manual, ${failures.length} failed`);
  return { rscript, rVersion, examples, passed, manual, failures };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  verifyExamples().then(({ failures }) => {
    if (failures.length > 0) process.exitCode = 1;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export {
  EXPECTED_R_VERSION,
  classifyBlock,
  collectExamples,
  compareOutput,
  extractNumbers,
  findRscript,
  getRVersion,
  loadLessons,
  normalizeOutput,
  verifyExamples,
};
