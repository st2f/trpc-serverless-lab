import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/{entrypoints,quotes,trpc,artifact}/**/*.test.{ts,mjs}"],
    forceRerunTriggers: ["**/src/**", "**/scripts/build.mjs"],
  },
});
