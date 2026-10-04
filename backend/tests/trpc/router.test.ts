import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@trpc-lab/backend/types";
import { expect, expectTypeOf, test } from "vitest";
import { quoteCollections } from "../../src/quotes/collections.js";
import type { Theme } from "../../src/quotes/types.js";
import { appRouter } from "../../src/trpc/router.js";

const themes: Theme[] = ["day", "night"];

test.each(themes)("quotes.get returns three distinct %s quotes", async (theme) => {
  const caller = appRouter.createCaller({});
  const result = await caller.quotes.get({ theme });

  expect(result).toHaveLength(3);
  expect(new Set(result.map((quote) => quote.id)).size).toBe(3);
  for (const quote of result) expect(quoteCollections[theme]).toContainEqual(quote);
});

const invalidInputs: { name: string; input: unknown }[] = [
  { name: "unsupported theme", input: { theme: "dusk" } },
  { name: "incorrect theme casing", input: { theme: "DAY" } },
  { name: "non-string theme", input: { theme: 1 } },
  { name: "missing theme", input: {} },
  { name: "non-object input", input: "day" },
  { name: "null input", input: null },
  { name: "absent input", input: undefined },
];

test.each(invalidInputs)("quotes.get rejects $name with BAD_REQUEST", async ({ input }) => {
  const caller = appRouter.createCaller({});

  // Deliberately bypass static input checking to exercise runtime validation.
  // @ts-expect-error The caller normally requires a valid { theme } object.
  const result = caller.quotes.get(input);
  await expect(result).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("the public router type exposes the quote query contract", () => {
  type Inputs = inferRouterInputs<AppRouter>;
  type Outputs = inferRouterOutputs<AppRouter>;

  expectTypeOf<Inputs["quotes"]["get"]>().toEqualTypeOf<{ theme: Theme }>();
  expectTypeOf<Outputs["quotes"]["get"][number]["id"]>().toEqualTypeOf<string>();
  expectTypeOf<Outputs["quotes"]["get"][number]["text"]>().toEqualTypeOf<string>();
});
