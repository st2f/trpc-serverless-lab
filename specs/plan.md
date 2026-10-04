# Project Goal

Build a small learning project to understand tRPC running on a serverless AWS-style architecture, similar in principle to the architecture I encounter at work.

This is primarily a learning project. Keep the architecture deliberately small and introduce concepts incrementally.

## What I Want to Understand

I want to make this execution path concrete:

```text
React
  ↓
tRPC client
  ↓ HTTP
API Gateway
  ↓
Lambda
  ↓
tRPC AWS Lambda adapter
  ↓
tRPC router/procedure
  ↓
response
```

There is no persistent Node HTTP server in production. API requests invoke a Lambda. AWS manages the Lambda execution environments and Node runtimes.

Locally, I want to explore MiniStack as an AWS emulator rather than Serverless Offline, so the topology remains conceptually close to AWS:

```txt
LOCAL                           AWS
─────                           ───
React                           React
  ↓                               ↓
MiniStack API Gateway           API Gateway
  ↓                               ↓
MiniStack Lambda                Lambda
  ↓                               ↓
same handler                    same handler
  ↓                               ↓
same tRPC router                same tRPC router
```

Before relying on MiniStack, verify that its Lambda implementation works appropriately with Node.js Lambdas. If it doesn’t, stop and reconsider the local approach rather than adding workarounds.

## Application

Keep the actual product intentionally trivial: a random quotes page.

The UI displays three random quotes. It has a day/night setting that determines which quote collection is used. Refreshing retrieves another random selection.

No authentication, users, likes/dislikes, database, queues, or external quote API are needed initially. Quotes can live directly in code.

The application exists to exercise tRPC and the serverless execution model, not to build a useful quote service.

Conceptually:

```ts
quotes.get({ theme: "day" | "night" })
        ↓
returns 3 random quotes
```

Refreshing should simply refetch the query because it doesn’t mutate persistent server state.

## Technologies

Use:

- TypeScript
- Node.js
- React/TailwindCSS
- tRPC
- Vitest
- AWS Lambda adapter: `@trpc/server/adapters/aws-lambda`
- Infrastructure: Terraform
- Local AWS emulation: MiniStack
- Eventually: real AWS API Gateway + Lambda

Do not introduce Serverless Framework / Serverless Offline unless there is a concrete reason.

## Important Architectural Separation

Keep these concepts visibly separate:

| Layer             | Components                                  |
| ----------------- | ------------------------------------------- |
| Infrastructure    | API Gateway, Lambda, Terraform              |
| Entry adapter     | Lambda handler, `awsLambdaRequestHandler()` |
| Transport         | tRPC router, procedures                     |
| Application logic | Quote selection                             |

The Lambda handler should be a thin entry point rather than containing the application logic.

A rough structure could eventually resemble:

```text
frontend/
backend/
  trpc/
    router.ts
  quotes/
    ...
  entrypoints/
    lambda.ts
terraform/
```
