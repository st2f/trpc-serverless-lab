import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const terraformRoot = fileURLToPath(new URL("../terraform/ministack-probe/", import.meta.url));
const outputs = JSON.parse(execFileSync("terraform", ["output", "-json"], {
  cwd: terraformRoot,
  encoding: "utf8",
}));
const nonce = randomUUID();
const temporaryDirectory = mkdtempSync(join(tmpdir(), "ministack-probe-"));
const awsEnvironment = {
  ...process.env,
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  AWS_CONFIG_FILE: "/dev/null",
  AWS_SHARED_CREDENTIALS_FILE: "/dev/null",
};
for (const key of ["AWS_PROFILE", "AWS_DEFAULT_PROFILE", "AWS_SESSION_TOKEN", "AWS_SECURITY_TOKEN"]) {
  delete awsEnvironment[key];
}

try {
  const configuration = JSON.parse(execFileSync("aws", [
    "--endpoint-url", "http://localhost:4566",
    "--region", "us-east-1",
    "--no-cli-pager",
    "lambda", "get-function-configuration",
    "--function-name", outputs.function_name.value,
    "--output", "json",
  ], { encoding: "utf8", env: awsEnvironment }));
  assert.equal(configuration.Runtime, "nodejs24.x");
  console.log("PASS: deployed Lambda configuration uses nodejs24.x");

  const resultPath = join(temporaryDirectory, "invocation.json");
  const metadata = JSON.parse(execFileSync("aws", [
    "--endpoint-url", "http://localhost:4566",
    "--region", "us-east-1",
    "--no-cli-pager",
    "lambda", "invoke",
    "--function-name", outputs.function_name.value,
    "--cli-binary-format", "raw-in-base64-out",
    "--payload", JSON.stringify({ source: "direct", nonce }),
    "--output", "json",
    resultPath,
  ], {
    encoding: "utf8",
    env: awsEnvironment,
  }));
  assert.equal(metadata.StatusCode, 200);
  assert.equal(metadata.FunctionError, undefined);
  const direct = JSON.parse(readFileSync(resultPath, "utf8"));
  assert.equal(direct.statusCode, 200);
  const directBody = JSON.parse(direct.body);
  assert.equal(directBody.event.nonce, nonce);
  assert.match(directBody.nodeVersion, /^v24\./);
  console.log("PASS: direct invocation executes the packaged Node.js handler");

  for (const method of ["GET", "POST"]) {
    const url = new URL(outputs.probe_url.value);
    url.searchParams.set("nonce", nonce);
    const response = await fetch(url, {
      method,
      headers: { "x-probe-input": nonce, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify({ nonce }) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(response.headers.get("x-probe-runtime"), "nodejs");
    const body = await response.json();
    assert.equal(body.message, "Hello from Node.js Lambda");
    assert.match(body.nodeVersion, /^v24\./);
    assert.ok(body.requestId);
    assert.equal(body.event.version, "2.0");
    assert.equal(body.event.rawPath, "/probe");
    assert.equal(body.event.requestContext.http.method, method);
    assert.equal(body.event.requestContext.apiId, outputs.api_id.value);
    assert.equal(body.event.headers["x-probe-input"], nonce);
    assert.equal(body.event.queryStringParameters.nonce, nonce);
    assert.equal(body.event.rawQueryString, `nonce=${nonce}`);
    assert.equal(body.event.isBase64Encoded, false);
    if (method === "POST") assert.equal(JSON.parse(body.event.body).nonce, nonce);
    console.log(`PASS: ${method} → API Gateway → Lambda; payload 2.0; runtime ${body.nodeVersion}`);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
