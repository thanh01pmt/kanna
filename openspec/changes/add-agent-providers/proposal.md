# Change: add-agent-providers

## Why
Kanna's orchestration capabilities currently rely on Claude and Codex. To support a wider ecosystem of specialized agents, we need to integrate the Antigravity and Pi agent providers. This enables Kanna to leverage Antigravity's generalized CLI and Pi's educational orchestration directly within the workspace.

## What Changes
- **ADDED** `antigravity` and `pi` to the `AgentProvider` type and catalog definitions.
- **ADDED** `AntigravityProjectDiscoveryAdapter` and `PiProjectDiscoveryAdapter` to automatically discover active projects for these providers.
- **ADDED** App Server managers (`antigravity-app-server.ts`, `pi-app-server.ts`) to manage CLI child processes and stream transcript events.
- **MODIFIED** `AgentCoordinator` to handle initialization and turn routing for the new providers.

## Impact
- Specs: `specs/agent-orchestration/spec.md`
- Code: `packages/shared/src/types.ts`, `packages/server/src/provider-catalog.ts`, `packages/server/src/discovery.ts`, `packages/server/src/agent.ts`, `packages/server/src/antigravity-app-server.ts`, `packages/server/src/pi-app-server.ts`
