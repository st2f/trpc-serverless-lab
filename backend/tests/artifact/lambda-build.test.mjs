import { afterAll, beforeAll, expect, test } from "vitest";
import { unzipSync } from "fflate";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import eventFixture from "../entrypoints/fixtures/http-api-v2.json" with { type: "json" };

const runNode = promisify(execFile);
let temporaryDirectory;
let moduleUrl;

beforeAll(async () => {
  // Build here so direct Vitest runs and watch reruns also use a fresh artifact.
  await runNode(process.execPath, [fileURLToPath(new URL("../../scripts/build.mjs", import.meta.url))]);
  const archive = unzipSync(await readFile(new URL("../../dist/lambda.zip", import.meta.url)));
  expect(Object.keys(archive)).toEqual(["index.mjs"]);
  temporaryDirectory = await mkdtemp(join(tmpdir(), "trpc-lambda-build-"));
  const modulePath = join(temporaryDirectory, "index.mjs");
  await writeFile(modulePath, archive["index.mjs"]);
  moduleUrl = pathToFileURL(modulePath).href;
});

afterAll(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

async function invokeArtifact(theme) {
  const input = JSON.stringify({ theme });
  const event = {
    ...eventFixture,
    rawQueryString: new URLSearchParams({ input }).toString(),
    queryStringParameters: { input },
  };
  // Native Node loads the extracted module outside the repository. Vitest's
  // module transforms and development node_modules cannot mask packaging errors.
  const { stdout } = await runNode(process.execPath, [
    "--input-type=module", "-e",
    `console.info = (...values) => console.error(...values);
     const { handler } = await import(process.argv[1]);
     const response = await handler(JSON.parse(process.argv[2]), { awsRequestId: "artifact-test" });
     process.stdout.write(JSON.stringify(response));`,
    moduleUrl,
    JSON.stringify(event),
  ], { cwd: temporaryDirectory });
  return JSON.parse(stdout);
}

test.each(["day", "night"])("packaged ESM handler returns three distinct %s quotes", async (theme) => {
  const response = await invokeArtifact(theme);
  expect(response.statusCode).toBe(200);
  expect(response.headers["x-lambda-request-id"]).toBe("artifact-test");
  expect(response.headers["content-type"]).toContain("application/json");
  const body = JSON.parse(response.body);
  expect(body.result.data).toHaveLength(3);
  expect(new Set(body.result.data.map((quote) => quote.id)).size).toBe(3);
  for (const quote of body.result.data) {
    expect(quote.id).toBeTypeOf("string");
    expect(quote.text).toBeTypeOf("string");
  }
});

test("packaged ESM handler returns HTTP 400 for an invalid theme", async () => {
  const response = await invokeArtifact("dusk");
  expect(response.statusCode).toBe(400);
  expect(response.headers["x-lambda-request-id"]).toBe("artifact-test");
  expect(response.headers["content-type"]).toContain("application/json");
  expect(JSON.parse(response.body).error.data).toMatchObject({ code: "BAD_REQUEST", httpStatus: 400 });
});
