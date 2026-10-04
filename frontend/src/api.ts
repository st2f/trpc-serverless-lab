import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "@trpc-lab/backend/types";

export type Theme = inferRouterInputs<AppRouter>["quotes"]["get"]["theme"];

export function createApi(url: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  const client = createTRPCClient<AppRouter>({ links: [httpLink({ url })] });
  const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient });
  return { queryClient, trpc };
}
