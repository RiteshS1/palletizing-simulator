// The engine's output (web/public/data + web/public/wasm) is committed so Vercel can build the site
// without a C++ toolchain. CI rebuilds it from core/ and runs this check: if the freshly generated
// plans differ from the committed ones, someone changed the C++ engine without running
// `npm run engine` and committing the result.
//
// Plans must match exactly (ids, positions, orders). Derived floating-point metrics may differ in
// the last binary digit between platforms (e.g. std::hypot in glibc vs Apple's libm), so numbers
// are compared with a relative tolerance of 1e-9, and measured runtimes are ignored.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function diff(a, b, path = "") {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)) ? null : `${path}: ${a} vs ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = diff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === "runtimeMs") continue;
      const d = diff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

const stale = [];
for (const file of ["plan_greedy.json", "plan_ep.json", "wes.json"]) {
  const path = `public/data/${file}`;
  const fresh = JSON.parse(readFileSync(path, "utf8"));
  const committed = JSON.parse(execSync(`git show HEAD:web/${path}`, { encoding: "utf8", maxBuffer: 1 << 26 }));
  const d = diff(fresh, committed);
  if (d) stale.push(`${file} (first difference at ${d})`);
}
if (stale.length) {
  console.error(`Committed engine output is stale:\n  ${stale.join("\n  ")}\nRun \`npm run engine\` in web/ and commit web/public/data and web/public/wasm.`);
  process.exit(1);
}
console.log("engine artifacts: committed plans match the C++ engine");
