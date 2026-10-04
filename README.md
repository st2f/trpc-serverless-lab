# trpc-serverless-lab

A learning project: tRPC on AWS Lambda + API Gateway, run locally on [MiniStack](https://ministack.org). See the [plan](specs/plan.md) and [roadmap](specs/roadmap.md).

## Quick start

Requires Node 24 (`.nvmrc`).

```sh
nvm use
npm ci
npm test          # unit, adapter, and packaged-artifact tests
npm run typecheck
npm run build     # → backend/dist/lambda.zip, backend/dist/probe.zip
```

## Layout

```text
backend/src/quotes/        # quote selection (pure logic)
backend/src/trpc/          # router: quotes.get({ theme: "day" | "night" })
backend/src/entrypoints/   # lambda.ts (tRPC handler), probe.ts (MiniStack probe)
backend/tests/             # Vitest suites
frontend/                  # empty until step 7
terraform/ministack-probe/ # local infra (deploys probe.zip)
scripts/verify-ministack.mjs
```

## Run locally on MiniStack

Also requires Docker, Terraform ≥ 1.5, and AWS CLI v2. No AWS account needed.

```sh
npm run build
docker compose up -d --wait
terraform -chdir=terraform/ministack-probe init
terraform -chdir=terraform/ministack-probe apply
npm run verify:ministack
```

The only live endpoint is the probe. It echoes the request event and the Node version:

```text
http://localhost:4566/_aws/execute-api/<api-id>/probe?theme=day
```

`<api-id>` changes when the API is recreated. Get the current URL with:

```sh
terraform -chdir=terraform/ministack-probe output -raw probe_url
```

After changing code: `npm run build` and `terraform apply` again.

Teardown (in this order):

```sh
terraform -chdir=terraform/ministack-probe destroy
docker compose down
```

Debug: `docker compose logs ministack`. Verification details: [specs/ministack-verification.md](specs/ministack-verification.md).
