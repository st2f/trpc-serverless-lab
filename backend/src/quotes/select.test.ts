import { describe, expect, test } from "vitest";
import { quoteCollections } from "./collections.js";
import { selectQuotes } from "./select.js";
import type { Theme } from "./types.js";

const themes: Theme[] = ["day", "night"];

test.each(themes)("%s collection contains at least three distinct quotes", (theme) => {
  const collection = quoteCollections[theme];
  expect(collection.length).toBeGreaterThanOrEqual(3);
  expect(new Set(collection.map((quote) => quote.id)).size).toBe(collection.length);
  expect(new Set(collection.map((quote) => quote.text)).size).toBe(collection.length);
});

describe.each(themes)("%s quote selection", (theme) => {
  test.each([
    { boundary: "lower", value: 0 },
    { boundary: "upper", value: 1 - Number.EPSILON },
  ])("returns three distinct quotes from the theme at the $boundary random boundary", ({ value }) => {
    const result = selectQuotes(theme, () => value);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((quote) => quote.id)).size).toBe(3);
    for (const quote of result) expect(quoteCollections[theme]).toContainEqual(quote);
  });
});

test.each(themes)("repeated %s selections preserve both collections", (theme) => {
  const before = structuredClone(quoteCollections);
  selectQuotes(theme, () => 0);
  selectQuotes(theme, () => 0.5);
  selectQuotes(theme, () => 1 - Number.EPSILON);
  expect(quoteCollections).toEqual(before);
});

test("different random values can select different sets of quotes", () => {
  const first = selectQuotes("day", () => 0).map((quote) => quote.id).sort();
  const last = selectQuotes("day", () => 1 - Number.EPSILON).map((quote) => quote.id).sort();
  expect(first).not.toEqual(last);
});

test.each([-1, 1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects an out-of-range random value (%s)",
  (value) => {
    expect(() => selectQuotes("day", () => value)).toThrow(RangeError);
  },
);
