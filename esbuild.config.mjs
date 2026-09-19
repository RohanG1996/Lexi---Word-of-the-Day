import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    popup: "src/popup/index.ts",
    options: "src/options/index.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome110",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/index.html", "dist/popup.html");
cpSync("src/options/index.html", "dist/options.html");

console.log("Built to dist/");
