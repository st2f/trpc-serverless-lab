import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, test } from "vitest";
import { quoteCollections } from "../../src/quotes/collections.js";
import type { Quote, Theme } from "../../src/quotes/types.js";

type QuoteResponse = { result: { data: Quote[] } };
type ErrorResponse = { error: { data: { code: string; httpStatus: number } } };

let apiUrl: string;
let frontendOrigin: string;

beforeAll(() => {
  const terraformRoot = fileURLToPath(
    new URL("../../../terraform/ministack-probe/", import.meta.url),
  );
  const outputs = JSON.parse(
    execFileSync("terraform", ["output", "-json"], {
      cwd: terraformRoot,
      encoding: "utf8",
    }),
  );
  if (!outputs.api_url?.value || !outputs.frontend_origin?.value) {
    throw new Error(
      "Outputs are missing. Build and provision the local backend before running integration tests.",
    );
  }
  apiUrl = outputs.api_url.value;
  frontendOrigin = outputs.frontend_origin.value;
});

function queryUrl(theme: string, procedure = "quotes.get"): URL {
  const url = new URL(`${apiUrl}/${procedure}`);
  url.searchParams.set("input", JSON.stringify({ theme }));
  return url;
}

const themes: Theme[] = ["day", "night"];

test.each(themes)(
  "HTTP %s query and refetch return three matching quotes",
  async (theme) => {
    for (let request = 0; request < 2; request += 1) {
      const response = await fetch(queryUrl(theme), {
        headers: { origin: frontendOrigin },
        signal: AbortSignal.timeout(15_000),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("access-control-allow-origin")).toBe(
        frontendOrigin,
      );
      const body = (await response.json()) as QuoteResponse;
      expect(body.result.data).toHaveLength(3);
      expect(new Set(body.result.data.map((quote) => quote.id)).size).toBe(3);
      for (const quote of body.result.data)
        expect(quoteCollections[theme]).toContainEqual(quote);
    }
  },
);

test("HTTP invalid input returns a tRPC BAD_REQUEST error with CORS headers", async () => {
  const response = await fetch(queryUrl("dusk"), {
    headers: { origin: frontendOrigin },
    signal: AbortSignal.timeout(15_000),
  });
  expect(response.status).toBe(400);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    frontendOrigin,
  );
  const body = (await response.json()) as ErrorResponse;
  expect(body.error.data).toMatchObject({
    code: "BAD_REQUEST",
    httpStatus: 400,
  });
});

test("API Gateway answers the browser preflight", async () => {
  const response = await fetch(`${apiUrl}/quotes.get`, {
    method: "OPTIONS",
    headers: {
      origin: frontendOrigin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "content-type",
    },
    signal: AbortSignal.timeout(15_000),
  });
  expect([200, 204]).toContain(response.status);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    frontendOrigin,
  );
  expect(
    response.headers
      .get("access-control-allow-methods")
      ?.split(",")
      .map((method) => method.trim()),
  ).toContain("GET");
  expect(
    response.headers
      .get("access-control-allow-headers")
      ?.toLowerCase()
      .split(",")
      .map((header) => header.trim()),
  ).toContain("content-type");
});

test("CORS does not grant access to an unconfigured origin", async () => {
  const origin = "http://unconfigured.example";
  const response = await fetch(queryUrl("day"), {
    headers: { origin },
    signal: AbortSignal.timeout(15_000),
  });
  expect(response.headers.get("access-control-allow-origin")).not.toBe(origin);
  expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
});

test("unknown procedure paths reach tRPC and return NOT_FOUND", async () => {
  const response = await fetch(queryUrl("day", "quotes.unknown"), {
    signal: AbortSignal.timeout(15_000),
  });
  expect(response.status).toBe(404);
  const body = (await response.json()) as ErrorResponse;
  expect(body.error.data).toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
});
