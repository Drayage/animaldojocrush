import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

async function walk(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) files.push(full);
  }
  return files;
}

const files = [...await walk("js"), ...await walk("scripts"), ...await walk("test")];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Checked ${files.length} JavaScript files.`);
