## 1. Type and Catalog Updates
- [x] 1.1 Add `antigravity` to `AgentProvider` and configure catalog in `packages/shared/src/types.ts`.
- [x] 1.2 Add `pi` to `AgentProvider` and configure catalog in `packages/shared/src/types.ts`.
- [x] 1.3 Add `normalizeAntigravityModelOptions` to `packages/server/src/provider-catalog.ts`.
- [x] 1.4 Add `normalizePiModelOptions` to `packages/server/src/provider-catalog.ts`.

## 2. Project Discovery
- [x] 2.1 Implement `AntigravityProjectDiscoveryAdapter` in `packages/server/src/discovery.ts`.
- [x] 2.2 Implement `PiProjectDiscoveryAdapter` in `packages/server/src/discovery.ts`.

## 3. Server Managers
- [x] 3.1 Create `packages/server/src/antigravity-app-server.ts` to manage `agy` child process.
- [x] 3.2 Create `packages/server/src/pi-app-server.ts` to manage `pi` child process.

## 4. Agent Coordinator Integration
- [x] 4.1 Register `AntigravityAppServerManager` in `packages/server/src/agent.ts`.
- [x] 4.2 Register `PiAppServerManager` in `packages/server/src/agent.ts`.
- [x] 4.3 Update `getProviderSettings` and `startTurnForChat` for Antigravity.
- [x] 4.4 Update `getProviderSettings` and `startTurnForChat` for Pi.
