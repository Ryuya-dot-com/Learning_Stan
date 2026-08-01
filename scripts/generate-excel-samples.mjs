import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceCsv = join(root, "public", "data", "rt_data.csv");
const outputDir = join(root, "outputs", "learning-stan-excel-samples");
const publicDir = join(root, "public", "data");
const publicBatchDir = join(publicDir, "batches");
const previewPath = join(outputDir, "preview.html");
const SOURCE_URL = "https://ryuya-dot-com.github.io/Learning_Stan/data/rt_data.csv";
const FIXED_DATE = new Date("2026-08-01T00:00:00.000Z");

const files = Object.freeze([
  { name: "trials.xlsx", publicPath: join(publicDir, "trials.xlsx") },
  { name: "batch_01.xlsx", publicPath: join(publicBatchDir, "batch_01.xlsx") },
  { name: "batch_02.xlsx", publicPath: join(publicBatchDir, "batch_02.xlsx") },
]);

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  assert.equal(lines[0], "id,cond,rt,correct");
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",");
    assert.equal(cells.length, 4, `CSV ${index + 2}行目の列数`);
    const [id, cond, rt, correct] = cells;
    assert.match(id, /^P\d{2}$/);
    assert.ok(["cong", "incong"].includes(cond));
    assert.ok(Number.isFinite(Number(rt)));
    assert.ok(["true", "false"].includes(correct));
    return { id, cond, rt: Number(rt), correct: correct === "true" };
  });
}

function styleHeader(row) {
  row.height = 26;
  row.font = { name: "Aptos", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.border = { bottom: { style: "medium", color: { argb: "FF1E3A8A" } } };
}

function addReadmeSheet(workbook, label, rowCount) {
  const sheet = workbook.addWorksheet("README", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 20 },
  });
  sheet.columns = [
    { header: "項目", key: "item", width: 22 },
    { header: "内容", key: "description", width: 72 },
  ];
  sheet.addRows([
    { item: "目的", description: "RのreadxlによるExcel読込と検査を練習するための教材" },
    { item: "データ", description: "個人情報を含まない架空の反応時間実験データ" },
    { item: "ファイル", description: label },
    { item: "trials行数", description: rowCount },
    { item: "表の契約", description: "1行1試行、1列1変数。列はid / cond / rt / correct" },
    { item: "欠損", description: "このExcelサンプルには欠損なし。欠損は空欄またはNAとして扱う" },
    { item: "元データURL", description: { text: SOURCE_URL, hyperlink: SOURCE_URL } },
    { item: "再生成", description: "npm run generate:excel-samples" },
  ]);
  styleHeader(sheet.getRow(1));
  sheet.getColumn(1).font = { name: "Aptos", bold: true, color: { argb: "FF1E3A8A" } };
  sheet.getColumn(2).alignment = { vertical: "top", wrapText: true };
  sheet.autoFilter = "A1:B9";
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  return sheet;
}

function addTrialsSheet(workbook, rows) {
  const sheet = workbook.addWorksheet("trials", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 20 },
  });
  sheet.columns = [
    { header: "id", key: "id", width: 12, style: { numFmt: "@" } },
    { header: "cond", key: "cond", width: 14 },
    { header: "rt", key: "rt", width: 12, style: { numFmt: "0.0" } },
    { header: "correct", key: "correct", width: 12 },
  ];
  sheet.addRows(rows);
  styleHeader(sheet.getRow(1));
  sheet.getColumn(3).alignment = { horizontal: "right" };
  sheet.getColumn(4).alignment = { horizontal: "center" };
  sheet.autoFilter = `A1:D${rows.length + 1}`;
  sheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  return sheet;
}

function createWorkbook(label, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Learning Stan";
  workbook.lastModifiedBy = "Learning Stan generator";
  workbook.created = FIXED_DATE;
  workbook.modified = FIXED_DATE;
  workbook.calcProperties.fullCalcOnLoad = true;
  addReadmeSheet(workbook, label, rows.length);
  addTrialsSheet(workbook, rows);
  return workbook;
}

async function saveWorkbook(name, workbook) {
  const outputPath = join(outputDir, name);
  const target = files.find((file) => file.name === name)?.publicPath;
  assert.ok(target, `未定義の出力: ${name}`);
  await workbook.xlsx.writeFile(outputPath);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(outputPath, target);
}

function cellValue(cell) {
  if (cell.value && typeof cell.value === "object" && "text" in cell.value) return cell.value.text;
  return cell.value;
}

async function readTrials(path) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["README", "trials"]);
  const readme = workbook.getWorksheet("README");
  const sheet = workbook.getWorksheet("trials");
  assert.equal(readme.views[0].state, "frozen");
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(sheet.getRow(1).fill.fgColor.argb, "FF2563EB");
  assert.equal(cellValue(readme.getCell("B8")), SOURCE_URL);
  assert.deepEqual(sheet.getRow(1).values.slice(1), ["id", "cond", "rt", "correct"]);

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = sheet.getRow(rowNumber).values.slice(1);
    assert.equal(values.length, 4);
    assert.equal(typeof values[0], "string");
    assert.equal(typeof values[1], "string");
    assert.equal(typeof values[2], "number");
    assert.equal(typeof values[3], "boolean");
    rows.push({ id: values[0], cond: values[1], rt: values[2], correct: values[3] });
  }
  return { workbook, rows };
}

async function verifySamples(expectedRows) {
  const all = await readTrials(files[0].publicPath);
  const batch1 = await readTrials(files[1].publicPath);
  const batch2 = await readTrials(files[2].publicPath);
  assert.deepEqual(all.rows, expectedRows);
  assert.deepEqual([...batch1.rows, ...batch2.rows], expectedRows);
  assert.equal(batch1.rows.length, 8);
  assert.equal(batch2.rows.length, 4);

  for (const { workbook } of [all, batch1, batch2]) {
    let formulas = 0;
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) formulas += 1;
        assert.doesNotMatch(String(cellValue(cell) ?? ""), /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A)$/);
      }));
    });
    assert.equal(formulas, 0);
  }
  console.log("Excel samples: 3 workbooks, 6 sheets, 12 combined trial rows verified");
  return [all, batch1, batch2];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writePreview(workbooks) {
  const sections = [];
  workbooks.forEach(({ workbook }, workbookIndex) => {
    const name = files[workbookIndex].name;
    workbook.eachSheet((sheet) => {
      const rows = [];
      sheet.eachRow((row) => {
        const cells = [];
        for (let column = 1; column <= sheet.columnCount; column += 1) {
          const tag = row.number === 1 ? "th" : "td";
          cells.push(`<${tag}>${escapeHtml(cellValue(row.getCell(column)))}</${tag}>`);
        }
        rows.push(`<tr>${cells.join("")}</tr>`);
      });
      sections.push(`<section><h2>${escapeHtml(name)} / ${escapeHtml(sheet.name)}</h2><table>${rows.join("")}</table></section>`);
    });
  });
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Excel sample preview</title><style>
    body{margin:24px;background:#f8fafc;color:#172033;font-family:Arial,"Yu Gothic",sans-serif}
    section{margin:0 0 32px;padding:20px;background:white;border:1px solid #cbd5e1;border-radius:12px;break-inside:avoid}
    h2{margin:0 0 12px;color:#1e3a8a;font-size:18px}table{border-collapse:collapse;width:auto;min-width:580px}
    th{background:#2563eb;color:white;text-align:left}th,td{padding:7px 12px;border-bottom:1px solid #dbeafe;white-space:nowrap}
    td:nth-child(3){text-align:right}
  </style><body>${sections.join("")}</body></html>`;
  await writeFile(previewPath, html, "utf8");
  console.log(`Preview HTML: ${previewPath}`);
}

async function main() {
  const rows = parseCsv(await readFile(sourceCsv, "utf8"));
  if (!process.argv.includes("--check")) {
    await mkdir(outputDir, { recursive: true });
    await mkdir(publicBatchDir, { recursive: true });
    await saveWorkbook("trials.xlsx", createWorkbook("全12試行", rows));
    await saveWorkbook("batch_01.xlsx", createWorkbook("P01・P02の8試行", rows.slice(0, 8)));
    await saveWorkbook("batch_02.xlsx", createWorkbook("P03の4試行", rows.slice(8)));
  }
  const workbooks = await verifySamples(rows);
  if (process.argv.includes("--preview")) await writePreview(workbooks);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
