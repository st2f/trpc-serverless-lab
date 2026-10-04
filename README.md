# trpc-serverless-lab

A small learning project for tRPC on API Gateway and AWS Lambda. See the [plan](specs/plan.md) and [roadmap](specs/roadmap.md).

## Development setup

Use Node.js 24 throughout development, builds, and Lambda configuration. `.nvmrc` selects that major version; package engines and `.npmrc` reject installing dependencies with another Node major version.

```sh
nvm use
npm ci
npm run typecheck
npm test
npm run build
```

`nvm use` is optional if Node 24 is already selected through another version manager. Run `npm run test:watch` for watch mode. The lockfile records the installed dependencies so `npm ci` reproduces them.

The repository has two npm workspaces sharing one lockfile:

```text
backend/
  src/entrypoints/probe.ts       # Current compatibility handler
  src/entrypoints/probe.test.ts  # Minimal Vitest test
  scripts/build.mjs             # ESM bundle and ZIP packaging
  dist/index.mjs                # Generated ESM handler
  dist/probe.zip                # Generated Lambda artifact
frontend/                       # Reserved for React in step 7
terraform/ministack-probe/       # Local infrastructure only
scripts/verify-ministack.mjs     # HTTP and Lambda integration checks
```

Backend commands are available at the root and in the backend workspace. The frontend currently has no application code; root type checking covers the backend source, its test, and Vitest configuration.

### ESM and TypeScript choices

All project packages use `"type": "module"`, scripts use `.mjs`, and the Lambda ZIP contains `index.mjs`. The handler setting stays `index.handler`: Lambda resolves the module and calls its named `handler` export.

The shared TypeScript configuration enables strict checking, unchecked-index checks, and exact optional-property types. Backend `NodeNext` resolution follows Node's ESM rules. Relative TypeScript imports use the eventual JavaScript extension, such as `import { handler } from "./probe.js"`; TypeScript and Vitest resolve it to the source `.ts` file.

`verbatimModuleSyntax` preserves ordinary imports and erases explicit `import type` declarations. It also prevents silently translating ESM imports into CommonJS. See the [TypeScript documentation](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html).

TypeScript checks types without emitting files. esbuild bundles the entry point with `format: "esm"` and `target: "node24"`; the build then packages it in a ZIP. The build runs type checking first because esbuild transpilation does not check types. See the [esbuild API](https://esbuild.github.io/api/).

### Frontend/backend boundary

Each workspace owns its dependencies. The backend exposes `AppRouter` through a type-only package entry:

```ts
import type { AppRouter } from "@trpc-lab/backend/types";
```

Its export map defines only the TypeScript `types` condition; there is no runtime entry for this path. The import is erased from browser output, keeping the router and quote-selection implementation out of the frontend bundle. The frontend will extend the shared strict configuration with browser and bundler settings when its build tool is added. This follows [tRPC's router type-sharing pattern](https://trpc.io/docs/server/routers).

## Quote selection

`backend/src/quotes/` contains the independent application logic. `Quote` has an `id` and `text`; `Theme` is `"day" | "night"`. Each theme has five original sample quotes stored in code.

`selectQuotes(theme)` returns three distinct quotes by randomly selecting and removing entries from a copy of the requested collection. The source collection remains intact. TypeScript's `readonly` declarations prevent accidental writes during development; copying the array preserves its contents at runtime.

An optional second argument supplies a random function returning a number in `[0, 1)`. Tests use controlled values to check selection boundaries and different results without relying on chance. Repeated calls may return the same selection. Run `npm test` to check the quote behavior without starting MiniStack.

The tRPC `quotes.get` procedure calls this function. The deployed Lambda currently remains the compatibility probe; the tRPC adapter is added in step 5.

## tRPC router

`backend/src/trpc/init.ts` initializes tRPC once and exposes the router and public-procedure builders. `router.ts` defines the root router with a `quotes.get` query accepting `{ theme: "day" | "night" }` and returning three quotes.

The input uses a Zod object schema with a theme enum. tRPC infers the procedure input type from the schema and validates actual incoming values at runtime. Missing themes, unsupported values, and malformed inputs are rejected with `BAD_REQUEST`. TypeScript alone cannot validate data arriving over HTTP. See [tRPC's validator documentation](https://trpc.io/docs/server/validators).

The router tests use `appRouter.createCaller({})` to execute the procedure without HTTP or AWS. They verify both themes and malformed inputs. Invalid test inputs deliberately bypass the caller's static typing with `@ts-expect-error` so the runtime parser is exercised. Type assertions also verify the public `AppRouter` contract during `npm run typecheck`; Vitest's normal test run transpiles TypeScript without checking its types.

Run `npm test` and `npm run typecheck` for these checks. The router is independent of the Lambda entry point, which will connect it to HTTP in the next stage.

## Step 1: MiniStack compatibility probe

The backend build packages the TypeScript probe as an ESM JavaScript handler. Terraform provisions an IAM role, Node.js Lambda, HTTP API, proxy integration, route, invocation permission, and default stage in MiniStack.

```text
HTTP GET / POST → MiniStack API Gateway → MiniStack Lambda → index.handler
```

Prerequisites: Node.js 24 and npm, Docker with Compose and a running daemon, Terraform >= 1.5 and < 2, AWS CLI v2, and an available local port 4566. Initial setup downloads npm dependencies, the pinned MiniStack image, and Terraform providers. No AWS account credentials are needed.

Run from the repository root:

```sh
npm ci
npm run build
docker compose up -d --wait
terraform -chdir=terraform/ministack-probe init
terraform -chdir=terraform/ministack-probe apply
node scripts/verify-ministack.mjs
```

The verifier checks that the deployed Lambda is configured as `nodejs24.x`, invokes it directly, then sends GET and POST requests through API Gateway. It asserts actual Node 24 execution, the returned status, headers, event format, HTTP method, path, query, and body. A per-run random value confirms that requests reach the executing handler.

To inspect the HTTP response manually:

```sh
curl "$(terraform -chdir=terraform/ministack-probe output -raw probe_url)?theme=day"
```

The response includes the received event and actual Node.js version. Infrastructure uses HTTP API payload format `2.0`, with `ANY /{proxy+}` forwarding paths to the same handler. The integration's `POST` method is how API Gateway invokes Lambda; the client can still use GET.

Check provisioning and container logs:

```sh
terraform -chdir=terraform/ministack-probe plan
docker compose logs ministack
```

After changing the handler, rerun `npm run build`, Terraform apply, and the verifier. Terraform consumes `backend/dist/probe.zip` and detects code changes through its hash. ZIP timestamps are fixed so unchanged builds keep the same hash. Keep the npm and Terraform lockfiles in version control; build output, installed dependencies, provider downloads, and local state are ignored.

Teardown, in this order:

```sh
terraform -chdir=terraform/ministack-probe destroy
docker compose down
```

MiniStack has no persistent storage in this configuration. Destroy resources before removing the container so Terraform state and emulator state remain aligned. Use the startup commands to recreate the probe.

See the [verification record](specs/ministack-verification.md) for tested versions, results, and limitations. The local executor runs real JavaScript using the container's Node binary; it does not guarantee that binary matches the configured Lambda runtime.
