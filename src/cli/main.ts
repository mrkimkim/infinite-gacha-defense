import { readFileSync } from "node:fs";
import { CliError, execute, failure, validateInput } from "./adapter.ts";

try {
  const args = process.argv.slice(2);
  if (args.length !== 3 || (args[0] !== "run" && args[0] !== "replay") ||
      args[1] !== "--input" || !args[2]) throw new CliError("USAGE", 2);
  let text: string;
  try { text = readFileSync(args[2] === "-" ? 0 : args[2], "utf8"); }
  catch { throw new CliError("INPUT_IO", 2); }
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new CliError("INVALID_JSON", 2); }
  validateInput(args[0], input);
  let core;
  try { core = await import("../core/index.ts"); }
  catch { throw new CliError("CORE_UNAVAILABLE", 1); }
  console.log(JSON.stringify(execute(core, args[0], input)));
} catch (error) {
  const result = failure(error);
  console.log(JSON.stringify(result.output));
  process.exitCode = result.exitCode;
}
