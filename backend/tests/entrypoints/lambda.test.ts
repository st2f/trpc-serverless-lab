import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { expect, test } from "vitest";
import { quoteCollections } from "../../src/quotes/collections.js";
import type { Theme } from "../../src/quotes/types.js";
import eventFixture from "./fixtures/http-api-v2.json" with { type: "json" };
import { handler } from "../../src/entrypoints/lambda.js";

const context: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "quotes-test",
  functionVersion: "$LATEST",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:000000000000:function:quotes-test",
  memoryLimitInMB: "128",
  awsRequestId: "lambda-test-request",
  logGroupName: "/aws/lambda/quotes-test",
  logStreamName: "test-stream",
  getRemainingTimeInMillis: () => 10_000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

function createFakeQueryEvent(input: string): APIGatewayProxyEventV2 {
  return {
    ...eventFixture,
    rawQueryString: new URLSearchParams({ input }).toString(),
    queryStringParameters: { input },
  };
}

const themes: Theme[] = ["day", "night"];

test.each(themes)("Lambda adapter returns a tRPC response for the %s query", async (theme) => {
  const response = await handler(createFakeQueryEvent(JSON.stringify({ theme })), context);

  expect(response.statusCode).toBe(200);
  expect(response.headers?.["content-type"]).toContain("application/json");
  expect(response.isBase64Encoded).not.toBe(true);
  expect(response.body).toBeTypeOf("string");
  const body = JSON.parse(response.body ?? "");
  expect(body.error).toBeUndefined();
  expect(body.result.data).toHaveLength(3);
  expect(new Set(body.result.data.map((quote: { id: string }) => quote.id)).size).toBe(3);
  for (const quote of body.result.data) expect(quoteCollections[theme]).toContainEqual(quote);
});

test.each([
  { name: "invalid theme", input: JSON.stringify({ theme: "dusk" }) },
  { name: "missing theme", input: JSON.stringify({}) },
  { name: "malformed JSON", input: "{" },
])("Lambda adapter returns HTTP 400 and a tRPC error for $name", async ({ input }) => {
  const response = await handler(createFakeQueryEvent(input), context);

  expect(response.statusCode).toBe(400);
  expect(response.headers?.["content-type"]).toContain("application/json");
  const body = JSON.parse(response.body ?? "");
  expect(body.result).toBeUndefined();
  expect(body.error.data).toMatchObject({ code: "BAD_REQUEST", httpStatus: 400, path: "quotes.get" });
});

test("Lambda adapter returns HTTP 404 for an unknown procedure", async () => {
  const event = createFakeQueryEvent(JSON.stringify({ theme: "day" }));
  event.rawPath = "/quotes.unknown";
  event.requestContext = {
    ...event.requestContext,
    http: { ...event.requestContext.http, path: "/quotes.unknown" },
  };
  event.pathParameters = { proxy: "quotes.unknown" };
  const response = await handler(event, context);

  expect(response.statusCode).toBe(404);
  expect(JSON.parse(response.body ?? "").error.data).toMatchObject({
    code: "NOT_FOUND",
    httpStatus: 404,
    path: "quotes.unknown",
  });
});
