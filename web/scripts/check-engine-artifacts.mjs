// The engine's output (web/public/data + web/public/wasm) is committed so Vercel can build the site
// without a C++ toolchain. CI rebuilds it from core/ and runs this check: if the freshly generated
// plans differ from the committed ones (ignoring measured runtimes), someone changed the C++ engine
// without running `npm run engine` and committing the result.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const strip = (v) =>
  JSON.stringify(v, (k, x) => (k === "runtimeMs" ? 0 : x));

let stale = [];
for (const file of ["plan_greedy.json", "plan_ep.json", "wes.json"]) {
  const path = `public/data/${file}`;
  const fresh = JSON.parse(readFileSync(path, "utf8"));
  const committed = JSON.parse(execSync(`git show HEAD:web/${path}`, { encoding: "utf8", maxBuffer: 1 << 26 }));
  if (strip(fresh) !== strip(committed)) stale.push(file);
}
if (stale.length) {
  console.error(`Committed engine output is stale: ${stale.join(", ")}.\nRun \`npm run engine\` in web/ and commit web/public/data and web/public/wasm.`);
  process.exit(1);
}
console.log("engine artifacts: committed plans match the C++ engine");
