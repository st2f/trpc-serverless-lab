# Frontend workspace

Reserved for React and TailwindCSS in roadmap step 7. The backend tooling is ready; this workspace currently has no application code or runtime dependencies.

When the tRPC router exists, expose its `AppRouter` type from a dedicated backend package export and consume it with `import type`. Keep backend entry points and application implementations out of frontend runtime imports. Type-only imports are erased from the browser output; the shared `verbatimModuleSyntax` setting makes that distinction explicit.

The backend currently has an empty `exports` map, so no runtime entry point is exposed to this workspace.

The frontend TypeScript configuration will extend `../tsconfig.base.json` and use browser libraries and bundler module resolution when the frontend build tool is added. The backend uses `NodeNext` because its output runs in Node.js.
