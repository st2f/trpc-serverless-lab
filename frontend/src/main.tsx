import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createApi } from "./api";
import { App } from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  root.render(
    <main className="mx-auto max-w-xl p-10">
      <h1 className="mb-4 text-2xl">Configure the API URL</h1>
      <p role="alert">Set VITE_API_URL in frontend/.env.local, then restart Vite. See the README for the Terraform output command.</p>
    </main>,
  );
} else {
  const { queryClient, trpc } = createApi(apiUrl);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App trpc={trpc} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
