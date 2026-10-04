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

**Completed and rechecked with Node 24 on 2026-10-04:** see the [verification record](./ministack-verification.md) and [reproduction commands](../README.md). The topology checks passed, including clean teardown and recreation. The configured `nodejs24.x` runtime and actual Node 24.18.1 execution now match in major version; full AWS runtime parity remains outside the local probe's scope.

**Completion criteria:** a local HTTP request reaches a real emulated Node.js Lambda invocation through API Gateway, and its response reaches the caller. Direct Lambda invocation alone is insufficient.

**Stop condition:** if MiniStack cannot support this execution path appropriately, stop and reconsider the local approach before continuing. Do not add compatibility workarounds or silently replace it with Serverless Offline. Any alternative should preserve the learning goals and be an explicit decision.

## 2. Establish a minimal TypeScript project

- [ ] Set up `backend/`, `frontend/`, and `terraform/` with a small, documented package arrangement.
- [ ] Select a Node.js version supported by the intended Lambda runtime and use it consistently for local development and builds.
- [ ] Enable strict TypeScript checking and configure Vitest for backend tests.
- [ ] Add scripts for type checking, testing, and building the Lambda artifact.
- [ ] Keep the frontend and backend dependency boundaries visible. The frontend will import the router's type only, without bundling backend implementation code.
- [ ] Document the development commands and prerequisites in the README.

Prefer a straightforward repository setup; introduce workspace tooling only if it makes sharing types and running commands clearer.

**Completion criteria:** TypeScript checking, a minimal test, and a backend build run successfully from documented commands.

## 3. Implement quote selection independently

- [ ] Define the quote shape and the `day | night` theme type.
- [ ] Add in-code collections with at least three distinct quotes per theme.
- [ ] Implement a function that selects three distinct quotes from the requested collection without modifying it.
- [ ] Keep this function independent of tRPC, HTTP, Lambda, and AWS.
- [ ] Test the result count, uniqueness, theme membership, and preservation of the original collection.

Random results can repeat across requests; refreshing does not need to guarantee a different selection. Avoid tests that depend on a particular random result. If deterministic sampling tests are useful, allow a controlled random source in the selection function.

**Completion criteria:** the application behavior is covered by fast Vitest tests without starting any infrastructure.

## 4. Expose the application through tRPC

- [ ] Create the tRPC initialization and root router under `backend/trpc/`.
- [ ] Add `quotes.get` as a query accepting `{ theme: "day" | "night" }`.
- [ ] Validate input at runtime with a schema supported by tRPC. TypeScript types alone do not validate incoming HTTP data.
- [ ] Call the quote-selection function from the procedure and export the router type for the frontend.
- [ ] Test both valid themes and invalid input through a direct router caller.

Direct caller tests exercise procedure behavior without HTTP. They do not establish that the API Gateway or Lambda adapter integration works.

**Completion criteria:** valid inputs return three quotes, invalid inputs are rejected, and the router remains independent of its deployment entry point.

## 5. Add the Lambda entry point and build artifact

- [ ] Create `backend/entrypoints/lambda.ts` using `awsLambdaRequestHandler()` from `@trpc/server/adapters/aws-lambda`.
- [ ] Keep the handler thin: connect the router and any necessary request context, with quote logic staying in its own module.
- [ ] Build a deployment artifact whose module format, handler export, and dependencies match the chosen Node.js Lambda runtime.
- [ ] Test the adapter with representative API Gateway events for the payload version chosen in stage 1.
- [ ] Verify a valid query and an invalid request, including response status and body.

Instantiate the router and handler at module scope. Lambda can reuse an execution environment across requests, but application correctness must not depend on that reuse.

**Completion criteria:** the built handler processes the chosen API Gateway event format and produces responses that the tRPC client can consume.

## 6. Provision and exercise the local backend

- [ ] Extend the verified Terraform setup to deploy the quote Lambda artifact and its API Gateway integration.
- [ ] Configure routes to forward the tRPC procedure path to the handler.
- [ ] Configure CORS for the local frontend origin, including preflight requests where required by the client transport.
- [ ] Make the API URL available as a Terraform output.
- [ ] Send a tRPC HTTP request through MiniStack API Gateway and verify the returned quote data.
- [ ] Confirm how to inspect Lambda logs and how to rebuild and redeploy after a backend change.
- [ ] Document local startup, provisioning, invocation, and teardown commands.

**Completion criteria:** the packaged quote backend works through the full local API Gateway → Lambda → adapter → router → quote-selection path. Its lifecycle is reproducible from the README.

## 7. Build the React interface

- [ ] Set up React and TailwindCSS in `frontend/`.
- [ ] Configure a typed tRPC client using the exported router type and an environment-configured API URL.
- [ ] Choose a query integration and document its basic fetch, cache, and refetch behavior. If using a query library, keep its configuration minimal.
- [ ] Display three quotes with loading and error states.
- [ ] Add a day/night control that supplies the theme to `quotes.get` and updates the page appearance.
- [ ] Make Refresh refetch the current query; no mutation is needed because there is no persistent state change.
- [ ] Check that changing themes displays the matching collection and that repeated refreshes remain usable.

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
