import { initTRPC } from "@trpc/server";

// Optional so direct callers can use the router without a logging transport.
type RequestContext = {
  logProcedure?: (entry: {
    path: string;
    type: string;
    code: string;
    durationMs: number;
  }) => void;
};

const t = initTRPC.context<RequestContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure.use(async ({ ctx, path, type, next }) => {
  const started = performance.now();
  const result = await next();
  ctx.logProcedure?.({
    path,
    type,
    code: result.ok ? "OK" : result.error.code,
    durationMs: Math.round(performance.now() - started),
  });
  return result;
});
