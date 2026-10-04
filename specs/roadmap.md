# Implementation Roadmap

This roadmap implements [the project plan](./plan.md) incrementally. The goal is to understand the request path from React through tRPC, API Gateway, and Lambda while keeping the application small.

Each stage should leave something observable and understandable before the next layer is added. The checklist tracks implementation work; the completion criteria define when to move on.

## 1. Verify the local execution model

MiniStack compatibility is the first decision gate, before building the application around it.

- [x] Check MiniStack's current documentation for Node.js Lambda runtimes, API Gateway support, Terraform integration, and required local tooling.
- [x] Choose an API Gateway type and event payload version that both MiniStack and the tRPC AWS Lambda adapter support. Record the choice and its implications.
- [x] Package and invoke a minimal Node.js Lambda that returns a JSON response.
- [x] Route an HTTP request through MiniStack API Gateway to that Lambda, confirming the event shape and response handling.
- [x] Confirm that the integration can be provisioned with Terraform and recreated from documented commands.
- [x] Record the versions tested and any relevant limitations.

**Completed and rechecked with Node 24 on 2026-10-04:** The topology checks passed, including clean teardown and recreation. The configured `nodejs24.x` runtime and actual Node 24.18.1 execution now match in major version; full AWS runtime parity remains outside the local probe's scope.

**Completion criteria:** a local HTTP request reaches a real emulated Node.js Lambda invocation through API Gateway, and its response reaches the caller. Direct Lambda invocation alone is insufficient.

**Stop condition:** if MiniStack cannot support this execution path appropriately, stop and reconsider the local approach before continuing. Do not add compatibility workarounds or silently replace it with Serverless Offline. Any alternative should preserve the learning goals and be an explicit decision.

## 2. Establish a minimal TypeScript project

- [x] Set up `backend/`, `frontend/`, and `terraform/` with a small, documented package arrangement.
- [x] Select a Node.js version supported by the intended Lambda runtime and use it consistently for local development and builds.
- [x] Enable strict TypeScript checking and configure Vitest for backend tests.
- [x] Add scripts for type checking, testing, and building the Lambda artifact.
- [x] Keep the frontend and backend dependency boundaries visible. The frontend will import the router's type only, without bundling backend implementation code.
- [x] Document the development commands and prerequisites in the README.

**Completed 2026-10-04:** npm workspaces, Node 24 configuration, strict TypeScript, Vitest, and an ESM-only backend build are in place. The existing probe is now TypeScript and builds to `backend/dist/index.mjs` plus a Lambda ZIP consumed by Terraform. Type checking, the minimal test, native ESM import, and deployed MiniStack invocation checks passed. A clean install reproduced the same ZIP, and Terraform reported no drift. The frontend is reserved for step 7; the router's type-only package export will be added with the router in step 4.

Prefer a straightforward repository setup; introduce workspace tooling only if it makes sharing types and running commands clearer.

**Completion criteria:** TypeScript checking, a minimal test, and a backend build run successfully from documented commands.

## 3. Implement quote selection independently

- [x] Define the quote shape and the `day | night` theme type.
- [x] Add in-code collections with at least three distinct quotes per theme.
- [x] Implement a function that selects three distinct quotes from the requested collection without modifying it.
- [x] Keep this function independent of tRPC, HTTP, Lambda, and AWS.
- [x] Test the result count, uniqueness, theme membership, and preservation of the original collection.

**Completed 2026-10-04:** `backend/src/quotes/` defines the quote types, five original sample quotes per theme, and `selectQuotes()`. Selection samples from a copy without replacement and accepts an optional random source for deterministic checks. Strict type checking and all 14 backend tests passed, including result invariants, collection preservation, different selections, and invalid random-source values. The tRPC procedure will call this function in step 4.

Random results can repeat across requests; refreshing does not need to guarantee a different selection. Avoid tests that depend on a particular random result. If deterministic sampling tests are useful, allow a controlled random source in the selection function.

**Completion criteria:** the application behavior is covered by fast Vitest tests without starting any infrastructure.

## 4. Expose the application through tRPC

- [x] Create the tRPC initialization and root router under `backend/src/trpc/`.
- [x] Add `quotes.get` as a query accepting `{ theme: "day" | "night" }`.
- [x] Validate input at runtime with a schema supported by tRPC. TypeScript types alone do not validate incoming HTTP data.
- [x] Call the quote-selection function from the procedure and export the router type for the frontend.
- [x] Test both valid themes and invalid input through a direct router caller.

**Completed 2026-10-04:** the ESM router validates input with Zod, calls `selectQuotes()`, and exposes `AppRouter` through `@trpc-lab/backend/types`. Both themes return three distinct quotes; seven invalid-input cases are rejected with `BAD_REQUEST`. Strict type checking and all 24 backend tests passed. The type-only export resolves during type checking and rejects runtime imports. HTTP and Lambda adapter checks remain in the next stages.

Direct caller tests exercise procedure behavior without HTTP. They do not establish that the API Gateway or Lambda adapter integration works.

**Completion criteria:** valid inputs return three quotes, invalid inputs are rejected, and the router remains independent of its deployment entry point.

## 5. Add the Lambda entry point and build artifact

- [x] Create `backend/src/entrypoints/lambda.ts` using `awsLambdaRequestHandler()` from `@trpc/server/adapters/aws-lambda`.
- [x] Keep the handler thin: connect the router and any necessary request context, with quote logic staying in its own module.
- [x] Build a deployment artifact whose module format, handler export, and dependencies match the chosen Node.js Lambda runtime.
- [x] Test the adapter with representative API Gateway events for the payload version chosen in stage 1.
- [x] Verify a valid query and an invalid request, including response status and body.

**Completed 2026-10-04:** the module-scope Lambda adapter uses HTTP API v2 event types and builds to a self-contained ESM `backend/dist/lambda.zip` for Node 24. The compatibility probe retains its separate ZIP for the existing Terraform setup. All tests and fixtures are under `backend/tests/`. Strict type checking and all 33 tests passed through Vitest, including valid-theme, invalid-input, malformed-JSON, and unknown-procedure adapter responses. The artifact suite builds a fresh ZIP and invokes its extracted ESM handler outside the repository in native Node. Application deployment through MiniStack remains step 6.

Instantiate the router and handler at module scope. Lambda can reuse an execution environment across requests, but application correctness must not depend on that reuse.

**Completion criteria:** the built handler processes the chosen API Gateway event format and produces responses that the tRPC client can consume.

## 6. Provision and exercise the local backend

- [x] Extend the verified Terraform setup to deploy the quote Lambda artifact and its API Gateway integration.
- [x] Configure routes to forward the tRPC procedure path to the handler.
- [x] Configure CORS for the local frontend origin, including preflight requests where required by the client transport.
- [x] Make the API URL available as a Terraform output.
- [x] Send a tRPC HTTP request through MiniStack API Gateway and verify the returned quote data.
- [x] Confirm how to inspect Lambda logs and how to rebuild and redeploy after a backend change.
- [x] Document local startup, provisioning, invocation, and teardown commands.

**Completed 2026-10-04:** the user applied the reviewed Terraform configuration: four resources added, two updated, none destroyed. The Node 24 tRPC API runtime shares the HTTP API with the `/probe` handler. All six live HTTP checks passed, covering both themes and refetches, invalid input, unknown procedures, CORS preflight, and an unconfigured origin. MiniStack container logs confirmed the `trpc-lab-api` Node 24 worker started. Rebuild, deployment, log inspection, and teardown commands are documented in the README.

**Completion criteria:** the packaged quote backend works through the full local API Gateway → Lambda → adapter → router → quote-selection path. Its lifecycle is reproducible from the README.

## 7. Build the React interface

- [x] Set up React and TailwindCSS in `frontend/`.
- [x] Configure a typed tRPC client using the exported router type and an environment-configured API URL.
- [x] Choose a query integration and document its basic fetch, cache, and refetch behavior. If using a query library, keep its configuration minimal.
- [x] Display three quotes with loading and error states.
- [x] Add a day/night control that supplies the theme to `quotes.get` and updates the page appearance.
- [x] Make Refresh refetch the current query; no mutation is needed because there is no persistent state change.
- [x] Check that changing themes displays the matching collection and that repeated refreshes remain usable.

**Completed 2026-10-04:** React, Vite, and TailwindCSS provide a responsive day/night interface with a typed tRPC client and an environment-configured API URL. TanStack Query caches each theme separately and refetches stale data when switching themes; Refresh refetches the current query. Both workspaces pass strict type checking and build successfully. All 33 offline tests and six live HTTP checks passed. Chromium exercised the complete browser → MiniStack → Lambda path, covering initial loading, matching collections, cached-theme refetch, repeated refreshes, simulated request failure and recovery, and mobile layout with no runtime errors.

The query input should distinguish the two themes in the client cache. Decide explicitly whether theme changes may display cached quotes or should fetch fresh ones; either behavior is acceptable if the UI is consistent.

**Completion criteria:** the browser exercises the complete local request path and correctly handles theme changes, refreshes, loading, and failures.

## 8. Make the request path observable

- [ ] Write a short architecture note mapping each repository component to infrastructure, entry adapter, transport, or application logic.
- [ ] Trace one browser request through the network panel, API Gateway integration, Lambda logs, and tRPC procedure.
- [ ] Explain where input validation happens and how errors return to the client.
- [ ] Record the difference between a local frontend development server and the production backend's invocation-based execution model.
- [ ] Add a small HTTP integration check for the deployed local backend if needed to make the stage 6 checks repeatable.

**Completion criteria:** the execution path in the plan can be explained using a working request and evidence from the running system.

## 9. Deploy the backend to real AWS

Start this stage after the local path is understood and working.

- [ ] Configure Terraform for real AWS with separate configuration and state from the local environment.
- [ ] Provision API Gateway, Lambda, the required invocation permission, and an execution role with permissions needed for logs.
- [ ] Deploy the same handler and router using the build process already established.
- [ ] Configure CORS for the frontend origin used during verification and point the frontend at the AWS API URL.
- [ ] Verify valid queries, invalid input, theme changes, and refresh through the AWS endpoint.
- [ ] Compare local and AWS behavior, recording emulator differences and any observed environment reuse or cold-start behavior.
- [ ] Document teardown and remove AWS resources when the learning exercise is complete.

The frontend can run locally while calling AWS. Public frontend hosting is a separate decision and is not required to understand this backend architecture.

**Completion criteria:** React can retrieve quotes through real API Gateway and Lambda using the same application code as the local deployment.

## Scope boundaries

Keep authentication, users, likes/dislikes, persistent storage, queues, external quote APIs, and Serverless Framework out of the initial implementation. Revisit additional tooling only when a concrete limitation or learning objective warrants it.

The initial project is complete when both execution paths work, the layers remain visibly separate, and another developer can reproduce the setup from the documentation.
