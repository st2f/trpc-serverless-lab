# trpc-serverless-lab

A hands-on project for learning how a typed tRPC API fits into an AWS serverless architecture, from local [MiniStack](https://ministack.org) emulation to a real API Gateway + Lambda deployment.

See the [plan](specs/plan.md) for the architecture and the [roadmap](specs/roadmap.md) for the incremental learning path.

<img width="800" src="https://github.com/user-attachments/assets/e7af618c-7d28-4aa4-8161-bd65a4b94790" />

## How it works

The backend defines one procedure, validated at runtime by Zod ([router.ts](backend/src/trpc/router.ts)):

```ts
export const appRouter = router({
  quotes: router({
    get: publicProcedure
      .input(z.object({ theme: z.enum(["day", "night"]) }))
      .query(({ input }) => selectQuotes(input.theme)),
  }),
});
export type AppRouter = typeof appRouter;
```

Lambda serves it through tRPC's adapter. There's no HTTP server; API Gateway invokes the handler ([lambda.ts](backend/src/entrypoints/lambda.ts)):

```ts
const adapter = awsLambdaRequestHandler({
  router: appRouter /* createContext */,
});
```

The frontend imports only the router's **type**, so calls are fully typed without bundling backend code ([api.ts](frontend/src/api.ts), [App.tsx](frontend/src/App.tsx)):

```ts
import type { AppRouter } from "@trpc-lab/backend/types";
const client = createTRPCClient<AppRouter>({ links: [httpLink({ url })] });

const quotes = useQuery(trpc.quotes.get.queryOptions({ theme }));
// → GET <api_url>/quotes.get?input={"theme":"day"}
```

Rename the procedure or change its input, and the frontend stops type-checking. Full request trace: [request-path.md](specs/request-path.md).

## Layout

```text
backend/src/quotes/          # quote selection (pure logic)
backend/src/trpc/            # router: quotes.get({ theme: "day" | "night" })
backend/src/entrypoints/     # lambda.ts (tRPC handler), probe.ts (echo probe)
backend/tests/               # Vitest suites
frontend/                    # React + Tailwind + typed tRPC client
terraform/ministack/         # local: HTTP API, tRPC Lambda, probe Lambda
terraform/aws/               # real AWS: HTTP API, tRPC Lambda, logs (separate state)
scripts/verify-ministack.mjs # probe checks
```

## Build and test (no Docker)

Requires Node 24 (`.nvmrc`).

```sh
nvm use
npm ci
npm test            # backend unit, adapter, and artifact tests
npm run typecheck   # both workspaces
npm run build       # backend ZIPs + frontend/dist/
```

## Local: MiniStack

Requires Docker, Terraform ≥ 1.5 and < 2, and AWS CLI v2. No AWS account needed.

**Deploy and check**

```sh
docker compose up -d --wait
terraform -chdir=terraform/ministack init
terraform -chdir=terraform/ministack plan   # review first
terraform -chdir=terraform/ministack apply
npm run verify:ministack                    # probe checks
npm run test:integration                    # HTTP checks against the deployed API
```

**Run the UI**

```sh
printf 'VITE_API_URL=%s\n' "$(terraform -chdir=terraform/ministack output -raw api_url)" > frontend/.env.local
npm run dev
```

Open http://localhost:5173. The browser calls the API directly. Vite is pinned to port 5173 because that's the origin CORS allows. `VITE_API_URL` is baked in at build time, so after changing `.env.local` (e.g. the API was recreated), restart Vite.

**Endpoints**

| Route | Lambda | What it does |
| --- | --- | --- |
| `ANY /{proxy+}` | `trpc-lab-api` | tRPC, e.g. `/quotes.get` |
| `ANY /probe` | `trpc-lab-ministack-probe` | echoes the event and Node version |

```sh
API=$(terraform -chdir=terraform/ministack output -raw api_url)
curl --get "$API/quotes.get" --data-urlencode 'input={"theme":"day"}'   # or "night"
curl "$API/probe"
```

The API ID in `api_url` changes when the API is recreated, so always read it from Terraform. For a frontend origin other than `http://localhost:5173`, pass `-var='frontend_origin=http://localhost:PORT'` to `plan` and `apply`.

**After changing backend code**

```sh
npm run build
terraform -chdir=terraform/ministack plan
terraform -chdir=terraform/ministack apply
npm run test:integration
```

Frontend changes hot-reload in `npm run dev`.

**Logs:** `docker compose logs -f ministack` shows the emulator. The Lambda's request logs are in MiniStack's emulated CloudWatch Logs; [request-path.md](specs/request-path.md) shows how to read them and trace one request end to end.

**Teardown**

```sh
terraform -chdir=terraform/ministack destroy
docker compose down
```

Destroy first: MiniStack keeps nothing once the container is removed, which would leave Terraform state pointing at resources that no longer exist.

## Real AWS

Same `lambda.zip`, separate Terraform root and state, no probe Lambda. Requires an AWS profile and `terraform/aws/account.tfvars` (copy `account.tfvars.example`); `allowed_account_ids` stops Terraform from touching any other account. Run `aws sts get-caller-identity` first to confirm which account you're on.

**Deploy and check**

```sh
npm run build
terraform -chdir=terraform/aws init
terraform -chdir=terraform/aws plan -var-file=account.tfvars -out=aws.tfplan   # review first
terraform -chdir=terraform/aws apply aws.tfplan
npm run test:integration:aws
```

**Endpoints:** the same tRPC paths as MiniStack, via `GET /{proxy+}` and `POST /{proxy+}` routes. There's no `/probe`.

```sh
API=$(terraform -chdir=terraform/aws output -raw api_url)
curl --get "$API/quotes.get" --data-urlencode 'input={"theme":"day"}'
```

**Run the UI**

```sh
printf 'VITE_API_URL=%s\n' "$(terraform -chdir=terraform/aws output -raw api_url)" > frontend/.env.local
npm run dev
```

**After changing backend code:** run `npm run build`, then repeat the `plan` and `apply` commands and `npm run test:integration:aws`.

**Logs** go to CloudWatch (`/aws/lambda/trpc-lab-api`, 7-day retention):

```sh
export AWS_REGION=$(terraform -chdir=terraform/aws output -raw aws_region)
aws logs tail /aws/lambda/trpc-lab-api --since 1h --follow
```

To find one request, filter on the `x-lambda-request-id` response header:

```sh
aws logs filter-log-events --log-group-name /aws/lambda/trpc-lab-api \
  --filter-pattern '"<x-lambda-request-id>"' --query 'events[].message' --output text
```

Logs can take a few seconds to appear. A `REPORT` line with `Init Duration` marks a cold start.

**Teardown**

```sh
terraform -chdir=terraform/aws plan -destroy -var-file=account.tfvars
terraform -chdir=terraform/aws destroy -var-file=account.tfvars
```

## MiniStack vs AWS

| | MiniStack | AWS |
| --- | --- | --- |
| Runtime | container's Node 24.18.1 | managed `nodejs24.x` |
| CORS preflight | answered by the emulator, even with an `ANY` route | answered by API Gateway only if no route matches `OPTIONS` |
| Logs | emulated CloudWatch at `localhost:4566` | real CloudWatch |
| Cold starts | emulator workers, no realistic timing | visible as `Init Duration` |
| IAM | not enforced | enforced |

The preflight row is why AWS uses `GET` and `POST` routes instead of `ANY`. With `ANY`, AWS forwarded the browser's `OPTIONS` request to Lambda, which doesn't answer it, so the browser blocked the call. MiniStack hid this.
