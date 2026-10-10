import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Tooling mode builds only a portable specimen; default mode requires the future index.html.
export default defineConfig(({ mode }) => ({
  base: "./",
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: mode === "tooling"
    ? {
        outDir: ".tooling-dist",
        lib: {
          entry: fileURLToPath(new URL("./tools/tooling-probe.ts", import.meta.url)),
          formats: ["es"],
          fileName: () => "tooling-probe.js",
        },
      }
    : { outDir: "dist" },
}));
