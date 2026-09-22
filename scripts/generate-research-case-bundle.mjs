import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
const root = "public/practice/research-case";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry =>
    entry.isDirectory() ? (["outputs", "r-library"].includes(entry.name) ? [] : files(join(dir, entry.name))) :
      /\.(R|stan|md|csv|png)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}
const zip = new JSZip();
for (const path of files(root)) zip.file(`research-case/${path.slice(root.length+1)}`, readFileSync(path), { date: new Date("2026-09-22T00:00:00Z") });
zip.file("research-case/renv.lock", readFileSync("reproducibility/renv.lock"), { date: new Date("2026-09-22T00:00:00Z") });
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "UNIX" });
const target = "public/downloads/learning-stan-research-case.zip";
if (process.argv.includes("--check")) {
  const actual = await JSZip.loadAsync(readFileSync(target));
  const expected = await JSZip.loadAsync(buffer);
  if (Object.keys(actual.files).sort().join() !== Object.keys(expected.files).sort().join()) throw Error("Bundle files differ");
  for (const name of Object.keys(expected.files)) if (!expected.files[name].dir &&
    !(await actual.files[name].async("nodebuffer")).equals(await expected.files[name].async("nodebuffer"))) throw Error(`Stale bundle: ${name}`);
  console.log("Research case bundle PASS (sources and environment lock)");
} else {
  mkdirSync("public/downloads",{recursive:true}); writeFileSync(target, buffer);
  console.log(target);
}
