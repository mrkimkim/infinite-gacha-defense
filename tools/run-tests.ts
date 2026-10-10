import { globSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Explicit paths avoid shell glob differences; new suites join without editing a list.
const paths = globSync("tests/**/*.test.ts").sort();
for (const suite of ["tooling", "core", "web", "integration"]) {
  const count = paths.filter((path) => path.startsWith(`tests/${suite}/`)).length;
  console.error(`${suite}: ${count} test file(s)${count === 0 ? " — NOT_RUN (no tests present)" : ""}`);
}
if (paths.length === 0) {
  console.error("No tests discovered.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", ...paths], { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
