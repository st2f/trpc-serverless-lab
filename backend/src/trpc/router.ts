import { z } from "zod";
import { selectQuotes } from "../quotes/select.js";
import { publicProcedure, router } from "./init.js";

const quotesRouter = router({
  get: publicProcedure
    .input(z.object({ theme: z.enum(["day", "night"]) }))
    .query(({ input }) => selectQuotes(input.theme)),
});

export const appRouter = router({ quotes: quotesRouter });

export type AppRouter = typeof appRouter;
