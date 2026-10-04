# Frontend workspace

Reserved for React and TailwindCSS in roadmap step 7. The backend tooling is ready; this workspace currently has no application code or runtime dependencies.

The tRPC router's `AppRouter` type is available through the backend's dedicated type-only package export. Consume it when the frontend is implemented:

```ts
import type { AppRouter } from "@trpc-lab/backend/types";
```

Keep backend entry points and application implementations out of frontend runtime imports. Type-only imports are erased from browser output; the shared `verbatimModuleSyntax` setting makes that distinction explicit. The backend export map defines only a `types` condition for this entry, so it cannot be imported at runtime. Add the backend workspace as a development dependency when adding the frontend's type consumer in step 7.

The frontend TypeScript configuration will extend `../tsconfig.base.json` and use browser libraries and bundler module resolution when the frontend build tool is added. The backend uses `NodeNext` because its output runs in Node.js.
