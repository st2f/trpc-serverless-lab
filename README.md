# trpc-serverless-lab

A small learning project for tRPC on API Gateway and AWS Lambda. See the [plan](specs/plan.md) and [roadmap](specs/roadmap.md).

## Step 1: MiniStack compatibility probe

The probe packages a JavaScript handler and uses Terraform to provision an IAM role, Node.js Lambda, HTTP API, proxy integration, route, invocation permission, and default stage in MiniStack.

```text
HTTP GET / POST → MiniStack API Gateway → MiniStack Lambda → index.handler
```

Prerequisites: Docker with Compose and a running daemon, Terraform >= 1.5 and < 2, Node.js 24, AWS CLI v2, and an available local port 4566. Initial setup downloads the pinned MiniStack image and Terraform providers. No AWS account credentials are needed.

Run from the repository root:

```sh
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

After changing the handler, rerun Terraform apply and the verifier. Terraform rebuilds the ZIP and detects code changes through its hash. Keep `.terraform.lock.hcl` in version control; generated ZIPs, provider downloads, and local state are ignored.

Teardown, in this order:

```sh
terraform -chdir=terraform/ministack-probe destroy
docker compose down
```

MiniStack has no persistent storage in this configuration. Destroy resources before removing the container so Terraform state and emulator state remain aligned. Use the startup commands to recreate the probe.

See the [verification record](specs/ministack-verification.md) for tested versions, results, and limitations. The local executor runs real JavaScript using the container's Node binary; it does not guarantee that binary matches the configured Lambda runtime.
