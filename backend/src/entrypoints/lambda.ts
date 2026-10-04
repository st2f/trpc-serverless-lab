import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { appRouter } from "../trpc/router.js";
import type { AppRouter } from "../trpc/router.js";

const adapter = awsLambdaRequestHandler<AppRouter, APIGatewayProxyEventV2>({
  router: appRouter,
  createContext: ({ event, context }) => ({
    logProcedure: (entry) => console.info(JSON.stringify({
      event: "trpc.procedure",
      requestId: context.awsRequestId,
      gatewayRequestId: event.requestContext.requestId,
      ...entry,
    })),
  }),
});

export async function handler(event: APIGatewayProxyEventV2, context: Context) {
  const started = performance.now();
  const request = {
    requestId: context.awsRequestId,
    gatewayRequestId: event.requestContext.requestId,
    method: event.requestContext.http.method,
    path: event.rawPath,
  };
  try {
    const response = await adapter(event, context);
    console.info(JSON.stringify({
      event: "lambda.response",
      ...request,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - started),
    }));
    const headers: Record<string, string | number | boolean> = {
      ...response.headers,
      "x-lambda-request-id": context.awsRequestId,
    };
    return { ...response, headers };
  } catch (error) {
    console.error(JSON.stringify({ event: "lambda.error", ...request }));
    throw error;
  }
}
