# Capability: Monorepo Workspace

## Purpose
This capability defines the monorepo structure, package management, build pipeline, and execution orchestration for the Kanna project.

## Requirements

### Requirement: Monorepo Directory Structure
The project SHALL be organized as a monorepo workspace using pnpm, with applications isolated in `apps/` and libraries/services in `packages/`.

#### Scenario: Workspace Partitioning
- **WHEN** listing the root workspace directory
- **THEN** it SHALL contain a `pnpm-workspace.yaml` file
- **AND** it SHALL contain `apps/` and `packages/` directories
- **AND** `apps/client` SHALL contain the client frontend
- **AND** `apps/export-viewer` SHALL contain the export viewer frontend
- **AND** `packages/server` SHALL contain the supervisor backend CLI
- **AND** `packages/shared` SHALL contain the shared constants and utilities

---

### Requirement: Independent Build & Execution
Each workspace package and app SHALL possess its own `package.json` to manage its specific dependencies and local tasks, while utilizing a root command to orchestrate the dev environment.

#### Scenario: Running Dev Mode
- **WHEN** executing the development script at the root directory
- **THEN** it SHALL orchestrate the concurrently running client and server processes
- **AND** the app SHALL load successfully on the designated port.
