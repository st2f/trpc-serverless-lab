import type { APIGatewayProxyResult, Context } from "aws-lambda";

// Compatibility probe retained for the original MiniStack verification workflow.
export async function handler(
  event: unknown,
  context: Pick<Context, "awsRequestId">,
): Promise<APIGatewayProxyResult> {
  console.log(JSON.stringify({ message: "MiniStack Node.js probe", requestId: context.awsRequestId }));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json", "x-probe-runtime": "nodejs" },
    isBase64Encoded: false,
    body: JSON.stringify({
      message: "Hello from Node.js Lambda",
      nodeVersion: process.version,
      requestId: context.awsRequestId,
      event,
    }),
  };
}
