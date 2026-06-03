# Tasks: Edit Agent Configurations (Pi & Antigravity) with Backups

## 1. Protocol definition
- [ ] 1.1 Add `settings.readAgentConfig`, `settings.writeAgentConfig`, and `settings.restoreAgentConfig` commands to `packages/shared/src/protocol.ts`.

## 2. Backend Implementation
- [ ] 2.1 Implement the WS handler `settings.readAgentConfig` in `packages/server/src/ws-router.ts` to read agent files and verify if `.bak` exists.
- [ ] 2.2 Implement `settings.writeAgentConfig` with `.bak` backup creation and JSON validation.
- [ ] 2.3 Implement `settings.restoreAgentConfig` to copy the `.bak` file back to the active filepath.

## 3. UI Integration
- [ ] 3.1 Implement the Raw Configuration Editor UI in `apps/client/src/client/app/SettingsPage.tsx` with validation and rollback actions.

## 4. Verification
- [ ] 4.1 Validate client build using `pnpm build:client`.
- [ ] 4.2 Validate specifications using `npx openspec validate --strict`.
