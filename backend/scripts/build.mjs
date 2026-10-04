import { build } from "esbuild";
import { zipSync } from "fflate";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const backendRoot = fileURLToPath(new URL("../", import.meta.url));
const dist = new URL("../dist/", import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  absWorkingDir: backendRoot,
  entryPoints: {
    index: "src/entrypoints/lambda.ts",
    probe: "src/entrypoints/probe.ts",
  },
  outdir: fileURLToPath(dist),
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  tsconfig: "tsconfig.json",
});

// A fixed ZIP timestamp keeps identical builds from changing Terraform's code hash.
for (const [moduleName, zipName] of [["index.mjs", "lambda.zip"], ["probe.mjs", "probe.zip"]]) {
  const handler = await readFile(new URL(moduleName, dist));
  const archive = zipSync({ "index.mjs": handler }, { mtime: new Date("2000-01-01T00:00:00Z") });
  await writeFile(new URL(zipName, dist), archive);
  console.log(`Built backend/dist/${moduleName} and backend/dist/${zipName} (handler: index.handler)`);
}
