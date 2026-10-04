# trpc-serverless-lab

A learning project: a React app calling tRPC on AWS Lambda + API Gateway, all running locally on [MiniStack](https://ministack.org). See the [plan](specs/plan.md) and [roadmap](specs/roadmap.md).

## Layout

```text
backend/src/quotes/          # quote selection (pure logic)
backend/src/trpc/            # router: quotes.get({ theme: "day" | "night" })
backend/src/entrypoints/     # lambda.ts (tRPC handler), probe.ts (echo probe)
backend/tests/               # Vitest suites
frontend/                    # React + Tailwind + typed tRPC client
terraform/ministack-probe/   # HTTP API + both Lambdas
scripts/verify-ministack.mjs # probe checks
```

## 1. Build and test (no Docker)

Requires Node 24 (`.nvmrc`).

```sh
nvm use
npm ci
npm test            # backend unit, adapter, and artifact tests
npm run typecheck   # both workspaces
npm run build       # backend ZIPs + frontend/dist/
```

## 2. Deploy to MiniStack

Also requires Docker, Terraform ≥ 1.5 and < 2, and AWS CLI v2. No AWS account needed.

```sh
docker compose up -d --wait
terraform -chdir=terraform/ministack-probe init
terraform -chdir=terraform/ministack-probe plan    # review first
terraform -chdir=terraform/ministack-probe apply
npm run verify:ministack                           # probe checks
npm run test:integration                           # HTTP checks against the deployed API
```

## 3. Run the UI

```sh
printf 'VITE_API_URL=%s\n' "$(terraform -chdir=terraform/ministack-probe output -raw api_url)" > frontend/.env.local
npm run dev
```

Open http://localhost:5173. The browser calls MiniStack directly. Vite is pinned to port 5173 because that's the origin CORS allows.

`VITE_API_URL` is baked in at build time: after changing `.env.local` (e.g. the API was recreated), restart Vite or rebuild.

## Endpoints

| Route | Lambda | What it does |
| --- | --- | --- |
| `ANY /{proxy+}` | `trpc-lab-api` | tRPC, e.g. `/quotes.get` |
| `ANY /probe` | `trpc-lab-ministack-probe` | echoes the event and Node version |

```sh
API=$(terraform -chdir=terraform/ministack-probe output -raw api_url)
curl --get "$API/quotes.get" --data-urlencode 'input={"theme":"day"}'   # or "night"
curl "$API/probe"
```

The API ID in `api_url` changes when the API is recreated, so always read it from Terraform.

CORS allows `http://localhost:5173`. For another origin, pass `-var='frontend_origin=http://localhost:PORT'` to `plan` and `apply`.

## After changing backend code

```sh
npm run build
terraform -chdir=terraform/ministack-probe plan
terraform -chdir=terraform/ministack-probe apply
npm run test:integration
```

Frontend changes hot-reload in `npm run dev`.

Logs: `docker compose logs -f ministack`.

## Teardown

```sh
terraform -chdir=terraform/ministack-probe destroy
docker compose down
```
