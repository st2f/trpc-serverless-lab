# MiniStack compatibility verification

## Decision

MiniStack is suitable for exploring the project's local API Gateway → Node.js Lambda execution path. The ZIP handler executes, direct invocation works, and HTTP GET and POST requests produce the expected payload-format-2.0 events and proxy responses.

This establishes topology and basic request/response compatibility. It does not establish exact AWS runtime parity or validate tRPC itself; the adapter is introduced and tested in later roadmap stages.

## Configuration and rationale

- **API Gateway HTTP API, payload format 2.0:** supported by the [tRPC AWS Lambda adapter](https://trpc.io/docs/server/adapters/aws-lambda) and defined in [AWS's integration documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html). HTTP APIs provide the required Lambda proxy path without REST API features this application does not need.
- **One proxy route and a `$default` stage:** `ANY /{proxy+}` forwards procedure paths to the same Lambda. No stage segment is needed for the default stage.
- **MiniStack's path-based invocation URL:** `http://localhost:4566/_aws/execute-api/{apiId}/probe`, documented in its [repository](https://github.com/ministackorg/ministack). This avoids custom DNS or Host-header setup.
- **Local Lambda executor inside the container:** MiniStack executes the uploaded JavaScript using its Node subprocess. No persistent application HTTP server, external handler service, or Docker socket mount is needed.
- **Node.js 24:** `nodejs24.x` is a supported [AWS Lambda runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) and is recognized by the pinned MiniStack implementation. It matches the major version of both the host Node.js and MiniStack's executor.
- **Local Terraform root:** dummy credentials and explicit IAM, Lambda, API Gateway v1/v2, and STS endpoint overrides. Provider support and endpoint configuration are described in the [MiniStack IaC documentation](https://www.ministack.org/docs/iac).

The initial step 1 handler was plain JavaScript. Step 2 moved it to `backend/src/entrypoints/probe.ts` and packaged its ESM `index.mjs` in `backend/dist/probe.zip`. Step 5 builds this probe from `dist/probe.mjs` and builds the separate tRPC application artifact as `dist/lambda.zip`. Each ZIP still contains `index.mjs`. Step 6 deploys both ZIPs; the user applied the configuration and all six live application HTTP checks passed.

## Tested versions

Rechecked with `nodejs24.x` on 2026-10-04, macOS ARM64 with Docker using Colima.

| Component | Version |
| --- | --- |
| MiniStack | 1.5.20, light image |
| Image digest | `sha256:051edcb3daed7ca3bdfe06c3c5e1427473ba656e8211f8c1d342543b277e982d` |
| Docker Engine | 29.1.4 |
| Docker Compose | 5.0.1 |
| Terraform | 1.15.8 |
| Terraform AWS provider | 6.67.0 |
| Terraform archive provider, initial step 1 only | 2.8.1; replaced by backend ZIP packaging in step 2 |
| Host Node.js, used by verifier | 24.7.0 |
| Configured Lambda runtime | `nodejs24.x` |
| Actual Lambda executor Node.js | 24.18.1 |
| AWS CLI | 2.34.61 |

The Compose image is pinned by digest, and Terraform provider selections are recorded in the lock file.

## Verification results

- Terraform validation passed and the seven resources provisioned successfully.
- The verifier confirmed the deployed Lambda configuration reports `nodejs24.x`.
- Direct Lambda invocation returned a successful proxy response with the supplied random value.
- GET through API Gateway returned HTTP 200, JSON content type, and the handler's response header.
- POST through API Gateway returned HTTP 200 and preserved its JSON body.
- Both HTTP requests delivered `version: "2.0"`, `rawPath: "/probe"`, the expected method and API ID, input headers, query parameters, raw query string, and `isBase64Encoded: false`.
- Direct and HTTP responses passed assertions that the executing runtime is Node 24; HTTP responses also included a Lambda request ID.
- A subsequent Terraform plan reported no changes.
- Terraform destroyed all seven resources, the container was removed and recreated, and a fresh apply recreated all seven resources. The direct, GET, and POST checks passed again.
- Step 2 rechecked direct, GET, and POST invocation after deploying the TypeScript-built ESM `index.mjs` artifact. All checks passed under Node 24.18.1, and Terraform reported no drift after a reproducible rebuild.

The executable checks are in [scripts/verify-ministack.mjs](../scripts/verify-ministack.mjs). Reproduction and teardown commands are in the [README](../README.md).

## Limitations and follow-up

1. **Matching Node major versions do not establish full runtime parity.** The configured runtime is `nodejs24.x` and the local executor used Node 24.18.1. MiniStack runs its own container's Node binary rather than the AWS managed runtime, so operating system, patch version, bundled libraries, and execution environment can still differ. AWS deployment checks remain necessary. No executor modification or workaround was added.
2. **Emulation is not an AWS environment.** This probe does not verify IAM enforcement, AWS isolation, cold-start timings, or CloudWatch log delivery. It uses container logs to inspect local execution.
3. **Application transport is verified locally.** Step 6 passed six live HTTP checks for both themes, repeated queries, invalid input, unknown procedures, and CORS. MiniStack logs confirmed the Node 24 worker started for `trpc-lab-api`. Browser behavior remains step 7; batching, if selected, would need separate verification.
4. **Local state is ephemeral.** Removing the container discards resources; destroy with Terraform first. Terraform state remains local and separate from any future AWS configuration.

The [MiniStack Lambda service page](https://www.ministack.org/docs/services/lambda) and repository describe execution modes with different levels of detail. The runtime version and behavior above are observed results from the pinned image, rather than assumptions based only on advertised support.
