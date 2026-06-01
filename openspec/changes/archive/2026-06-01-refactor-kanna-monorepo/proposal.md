# Change: Refactor Kanna to Monorepo Workspace

## Why
To modularize the codebase, simplify dependency management, and separate the client, server, shared, and export-viewer subprojects using a modern pnpm workspace monorepo architecture, similar to `markdown-viewer`.

## What Changes
- Add `pnpm-workspace.yaml` defining `apps/*` and `packages/*`.
- Add `turbo.json` to orchestrate tasks across workspaces.
- Update root `package.json` to remove local dependencies, specify pnpm workspace engines, and define global scripts.
- Restructure project files:
  - Create `apps/client` containing client React UI (`src/client`, `index.html`, etc.).
  - Create `apps/export-viewer` containing export-viewer bundle configuration.
  - Create `packages/server` containing supervisor backend code (`src/server`, `bin/`).
  - Create `packages/shared` containing shared types and helpers (`src/shared`).
- Create package-specific `package.json` and `tsconfig.json` configurations.
- Map internal dependencies (e.g. `@kanna/shared` linked via `workspace:*`).
- Adapt imports and build configurations to work under the new workspace layout.

## Impact
- Specs: `openspec/specs/monorepo/spec.md`
- Code: Restructuring of the entire codebase.
