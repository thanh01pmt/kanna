## 1. Setup Monorepo Workspace Configuration
- [x] 1.1 Create `pnpm-workspace.yaml` specifying `apps/*` and `packages/*`.
- [x] 1.2 Create root `turbo.json` config for pipelines.
- [x] 1.3 Update root `package.json` with workspace settings and scripts.

## 2. Code Restructuring & Package Isolation
- [x] 2.1 Migrate shared module into `packages/shared` with a dedicated `package.json`.
- [x] 2.2 Migrate server module into `packages/server` with a dedicated `package.json`.
- [x] 2.3 Migrate client module into `apps/client` with a dedicated `package.json` and client configs.
- [x] 2.4 Migrate export-viewer module into `apps/export-viewer` with a dedicated `package.json`.

## 3. Wiring and Validation
- [x] 3.1 Configure `tsconfig.json` files for workspaces and support path resolution.
- [x] 3.2 Update internal dependencies and import statements across all packages.
- [x] 3.3 Verify build and development execution using `pnpm dev`.
