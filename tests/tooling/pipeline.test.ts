import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { build, createServer } from "vite";
import { toolingProbe } from "../../tools/tooling-probe.ts";

test("native Node TypeScript and Vite ES bundle export the same tooling specimen", async () => {
  const output = await mkdtemp(join(tmpdir(), "gacha-tooling-"));
  try {
    await build({ mode: "tooling", logLevel: "silent", build: { outDir: output, emptyOutDir: true } });
    const bundle = await import(pathToFileURL(join(output, "tooling-probe.js")).href);
    assert.deepEqual(bundle.toolingProbe, toolingProbe);
    assert.equal(toolingProbe.label, "TypeScript 도구 확인");
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("Vite development pipeline transforms the portable TypeScript module", async () => {
  const server = await createServer({ logLevel: "silent", server: { middlewareMode: true } });
  try {
    const transformed = await server.transformRequest("/tools/tooling-probe.ts");
    assert.ok(transformed);
    assert.match(transformed.code, /TypeScript 도구 확인/);
    assert.doesNotMatch(transformed.code, /interface ToolingProbe|satisfies ToolingProbe/);
  } finally {
    await server.close();
  }
});

test("lockfile pins every direct dependency to official npm registry artifacts", async () => {
  const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  assert.equal(lock.lockfileVersion, 3);
  for (const [name, version] of Object.entries(pkg.devDependencies)) {
    assert.match(String(version), /^\d+\.\d+\.\d+$/);
    assert.equal(lock.packages["node_modules/" + name].version, version);
  }
  for (const [name, entry] of Object.entries(lock.packages) as [string, { resolved?: string; integrity?: string }][]) {
    if (!name) continue;
    assert.ok(entry.resolved?.startsWith("https://registry.npmjs.org/"), name);
    assert.ok(entry.integrity?.startsWith("sha512-"), name);
  }
});
