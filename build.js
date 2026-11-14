// Build script: bundles Three.js + loaders + controls into a single browser-ready ES module.
// Run with: node build.js
// Output:   three.bundle.min.js in the repo root, next to the card, so HACS
//           (branch installs) ships it along. Committed: rebuild and commit it after
//           changing the three version in package.json.

import { build } from "esbuild";

await build({
  entryPoints: ["src/three-bundle.js"],
  bundle: true,
  format: "esm",
  minify: true,
  outfile: "three.bundle.min.js",
  platform: "browser",
  target: ["es2020"],
  logLevel: "info",
});

console.log("Done → three.bundle.min.js");
