import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { appRouter } from "../trpc/router.js";
import type { AppRouter } from "../trpc/router.js";

export const handler = awsLambdaRequestHandler<AppRouter, APIGatewayProxyEventV2>({
  router: appRouter,
});
