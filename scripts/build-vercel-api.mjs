import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("lib", { recursive: true });

await esbuild.build({
  entryPoints: ["server/src/vercel-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "lib/vercel-api.cjs",
  sourcemap: true,
  external: ["mysql2", "express", "cors", "dotenv", "zod"],
  footer: {
    js: `
if (module.exports.default) {
  module.exports = module.exports.default;
}
`,
  },
  logLevel: "info",
});

console.log("Built lib/vercel-api.cjs for Vercel");
