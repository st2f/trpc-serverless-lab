import { quoteCollections } from "./collections.js";
import type { Quote, Theme } from "./types.js";

export function selectQuotes(theme: Theme, random: () => number = Math.random): Quote[] {
  const remaining = [...quoteCollections[theme]];
  const selected: Quote[] = [];

  for (let count = 0; count < 3; count += 1) {
    const index = Math.floor(random() * remaining.length);
    const quote = remaining[index];
    if (quote === undefined) {
      throw new RangeError("Quote selection requires at least three quotes and random values in [0, 1).");
    }
    selected.push(quote);
    remaining.splice(index, 1);
  }

  return selected;
}
