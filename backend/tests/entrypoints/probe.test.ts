import { expect, test } from "vitest";
import { handler } from "../../src/entrypoints/probe.js";

test("preserves request data inside a JSON Lambda proxy response", async () => {
  const event = { message: 'Quotes: "hello"\nBonjour 🌙', values: [1, null, true] };
  const response = await handler(event, { awsRequestId: "test-request" });

  expect(response.statusCode).toBe(200);
  expect(response.headers?.["content-type"]).toBe("application/json");
  expect(response.isBase64Encoded).toBe(false);
  expect(JSON.parse(response.body)).toMatchObject({
    event,
    requestId: "test-request",
  });
});
