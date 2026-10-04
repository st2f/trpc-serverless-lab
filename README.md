# trpc-serverless-lab

A learning project: tRPC on AWS Lambda + API Gateway, run locally on [MiniStack](https://ministack.org). See the [plan](specs/plan.md) and [roadmap](specs/roadmap.md).

## Quick start

Requires Node 24 (`.nvmrc`).

```sh
nvm use
npm ci
npm test          # unit, adapter, artifact tests (no Docker needed)
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
terraform/ministack-probe/ # local infra: HTTP API + both Lambdas
scripts/verify-ministack.mjs # probe checks
```

## Run locally on MiniStack

Also requires Docker, Terraform ≥ 1.5 and < 2, and AWS CLI v2. No AWS account needed.

```sh
npm run build
docker compose up -d --wait
terraform -chdir=terraform/ministack-probe init
terraform -chdir=terraform/ministack-probe plan    # review first
terraform -chdir=terraform/ministack-probe apply
npm run verify:ministack                           # probe checks
npm run test:integration                           # HTTP checks against the deployed API
```

## Endpoints

One HTTP API, two Lambdas:

| Route | Lambda | What it does |
| --- | --- | --- |
| `ANY /{proxy+}` | `trpc-lab-api` (`lambda.zip`) | tRPC, e.g. `/quotes.get` |
| `ANY /probe` | `trpc-lab-ministack-probe` (`probe.zip`) | echoes the event and Node version |

```sh
API=$(terraform -chdir=terraform/ministack-probe output -raw api_url)

curl --get "$API/quotes.get" --data-urlencode 'input={"theme":"day"}'   # or "night"
curl "$API/probe?theme=day"
```

`api_url` looks like `http://localhost:4566/_aws/execute-api/<api-id>`. The ID changes when the API is recreated, so always read it from Terraform.

CORS allows `http://localhost:5173` by default (handled by API Gateway). For another origin, pass `-var='frontend_origin=http://localhost:PORT'` to `plan` and `apply`.

## After changing code

```sh
npm run build
terraform -chdir=terraform/ministack-probe plan
terraform -chdir=terraform/ministack-probe apply
npm run test:integration
```

Logs: `docker compose logs -f ministack`.

## Teardown

```sh
terraform -chdir=terraform/ministack-probe destroy
docker compose down
```

Verification details: [specs/ministack-verification.md](specs/ministack-verification.md).
