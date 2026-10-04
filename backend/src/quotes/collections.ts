import type { Quote, Theme } from "./types.js";

// Original sample quotes for this learning project.
export const quoteCollections: Readonly<Record<Theme, readonly Quote[]>> = {
  day: [
    { id: "day-1", text: "A small step still moves the day forward." },
    { id: "day-2", text: "Let curiosity be the first thing you open this morning." },
    { id: "day-3", text: "Make room for one good idea and see where it leads." },
    { id: "day-4", text: "Progress begins with the next thing you can do." },
    { id: "day-5", text: "There is daylight enough to try again." },
  ],
  night: [
    { id: "night-1", text: "Rest is part of the work, too." },
    { id: "night-2", text: "You can leave an unfinished thought for tomorrow." },
    { id: "night-3", text: "A quiet evening has its own kind of progress." },
    { id: "night-4", text: "Let the day settle before you decide what it meant." },
    { id: "night-5", text: "Some answers arrive after a little silence." },
  ],
};
