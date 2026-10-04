# Implementation Roadmap

This roadmap implements [the project plan](./plan.md) one stage at a time. The goal is to understand the request path from React through tRPC, API Gateway and Lambda while keeping the app small. Each stage should leave something observable before the next layer is added.

## 1. Verify the local execution model ✅

- [x] Check MiniStack's support for Node.js Lambdas, API Gateway, Terraform, and the local tooling it needs.
- [x] Choose an API Gateway type and payload version supported by both MiniStack and the tRPC Lambda adapter.
- [x] Package and invoke a minimal Node.js Lambda that returns JSON.
- [x] Route an HTTP request through MiniStack API Gateway to that Lambda.
- [x] Provision it with Terraform and recreate it from documented commands.
- [x] Record tested versions and limitations.

**Done:** HTTP API with payload format 2.0, and Node 24 in both configuration and execution.

**Stop condition:** if MiniStack can't support this path, stop and reconsider. Don't add workarounds or silently switch to Serverless Offline.

## 2. Establish a minimal TypeScript project ✅

- [x] Set up `backend/`, `frontend/` and `terraform/`.
- [x] Use one Node.js version, matching the Lambda runtime, for development and builds.
- [x] Enable strict TypeScript and configure Vitest.
- [x] Add typecheck, test and build scripts.
- [x] Have the frontend import only the router's type, not backend code.
- [x] Document the commands in the README.

**Done:** npm workspaces, Node 24, strict TypeScript, Vitest, and an ESM-only backend build.

## 3. Implement quote selection independently ✅

- [x] Define the quote shape and the `day | night` theme type.
- [x] Add in-code collections with at least three quotes per theme.
- [x] Select three distinct quotes without modifying the collection.
- [x] Keep this independent of tRPC, HTTP, Lambda and AWS.
- [x] Test count, uniqueness, theme membership, and that the collection is unchanged.

**Done:** `backend/src/quotes/` has five quotes per theme. `selectQuotes()` accepts an optional random source so tests are deterministic.

## 4. Expose the application through tRPC ✅

- [x] Create the tRPC setup and root router under `backend/src/trpc/`.
- [x] Add `quotes.get` as a query taking `{ theme: "day" | "night" }`.
- [x] Validate input at runtime (Zod); TypeScript alone doesn't validate HTTP data.
- [x] Call quote selection from the procedure and export the router type.
- [x] Test valid and invalid input through a direct caller.

**Done:** invalid input returns `BAD_REQUEST`. `AppRouter` is exported type-only via `@trpc-lab/backend/types`.

## 5. Add the Lambda entry point and build artifact ✅

- [x] Create `backend/src/entrypoints/lambda.ts` with `awsLambdaRequestHandler()`.
- [x] Keep the handler thin.
- [x] Build an artifact matching the Lambda runtime's module format and handler export.
- [x] Test the adapter with representative API Gateway v2 events.
- [x] Check a valid query and an invalid request, including status and body.

**Done:** a self-contained ESM `backend/dist/lambda.zip`. A test unzips it and runs the handler in plain Node.

## 6. Provision and exercise the local backend ✅

- [x] Deploy the quote Lambda and its API Gateway integration with Terraform.
- [x] Route the tRPC procedure path to the handler.
- [x] Configure CORS for the local frontend origin, including preflight.
- [x] Output the API URL from Terraform.
- [x] Send a tRPC request through MiniStack and check the quotes.
- [x] Document logs, rebuild/redeploy, and teardown.

**Done:** the tRPC Lambda and the probe share one HTTP API. `npm run test:integration` covers the deployed API.

## 7. Build the React interface ✅

- [x] Set up React and Tailwind in `frontend/`.
- [x] Configure a typed tRPC client with an environment-configured API URL.
- [x] Pick a query integration and keep its configuration minimal.
- [x] Show three quotes with loading and error states.
- [x] Add a day/night control that sets the theme and the page appearance.
- [x] Make Refresh refetch the current query (no mutation).
- [x] Check that theme changes and repeated refreshes behave correctly.

**Done:** uses TanStack Query via tRPC's integration. Each theme has its own cache entry, and `staleTime: 0` means switching theme refetches. Retries and focus refetches are off. Checked in Chromium against MiniStack, including a failed request and recovery.

## 8. Make the request path observable ✅

- [x] Map each component to infrastructure, entry adapter, transport, or application logic.
- [x] Trace one browser request through the Network panel, API Gateway, Lambda logs and the procedure.
- [x] Explain where validation happens and how errors reach the client.
- [x] Explain the difference between the local dev server and invocation-based execution.
- [x] Add a repeatable HTTP integration check.

**Done:** see [request-path.md](./request-path.md). A browser `x-lambda-request-id` matched both structured log entries in MiniStack's emulated CloudWatch Logs.

## 9. Deploy the backend to real AWS ✅

- [x] Configure Terraform for AWS with separate configuration and state.
- [x] Provision API Gateway, Lambda, the invocation permission, and a logging execution role.
- [x] Deploy the same handler and router with the same build.
- [x] Configure CORS for the verification origin and point the frontend at the AWS URL.
- [x] Verify queries, invalid input, theme changes and refresh through AWS.
- [x] Compare local and AWS behaviour, including environment reuse and cold starts.
- [x] Document teardown and remove AWS resources when finished.

**Done:** deployed, verified, and torn down. Lesson: an `ANY /{proxy+}` route sends CORS preflights to Lambda on AWS, but not on MiniStack; see the [README](../README.md#ministack-vs-aws).

**Completion criteria:** React gets quotes through real API Gateway and Lambda, using the same application code as locally.

## Scope boundaries

Out of scope: authentication, users, likes, persistent storage, queues, external quote APIs, Serverless Framework, and public frontend hosting.

The project is complete when both execution paths work, the layers stay visibly separate, and another developer can reproduce the setup from the docs.
