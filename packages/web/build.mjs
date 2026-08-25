import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const engine = await build({
  entryPoints: ["../engine/dist/index.js"],
  bundle: true,
  format: "iife",
  globalName: "perhaps",
  minify: true,
  write: false,
});

const font = readFileSync("assets/unifont-subset.woff2").toString("base64");
const favicon = readFileSync("assets/favicon.png").toString("base64");
const html = readFileSync("template.html", "utf8")
  .replace("__ENGINE__", () => engine.outputFiles[0].text)
  .replace("__UNIFONT__", () => `data:font/woff2;base64,${font}`)
  .replace("__FAVICON__", () => `data:image/png;base64,${favicon}`);

mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
console.log(`dist/index.html (${(html.length / 1024).toFixed(1)}kb)`);
