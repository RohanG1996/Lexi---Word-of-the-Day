import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    selection: "src/content/selection.ts",
    sidepanel: "src/sidepanel/index.ts",
    options: "src/options/index.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome110",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/sidepanel/index.html", "dist/sidepanel.html");
cpSync("src/options/index.html", "dist/options.html");

console.log("Built to dist/");
