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
  entryPoints: ["src/entrypoints/probe.ts"],
  outfile: fileURLToPath(new URL("index.mjs", dist)),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  tsconfig: "tsconfig.json",
});

const handler = await readFile(new URL("index.mjs", dist));
// A fixed ZIP timestamp keeps identical builds from changing Terraform's code hash.
const archive = zipSync({ "index.mjs": handler }, { mtime: new Date("2000-01-01T00:00:00Z") });
await writeFile(new URL("probe.zip", dist), archive);
console.log("Built backend/dist/index.mjs and backend/dist/probe.zip (handler: index.handler)");
