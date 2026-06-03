# Change: Stateful Skills and MCP Management

## Why
Currently, Kanna's custom skills are not toggleable in the UI, and they do not support multiple providers like Antigravity and Codex or dynamic path merging. This proposal standardizes skill enable/disable logic using `.disabled` directory suffixes and enables dynamic project-local skill and MCP path injection at runtime.

## What Changes
- **Skills Directory Renaming**: Enable/disable logic using `.disabled` directory suffix.
- **Dynamic Path Merging**: Merge global and local skill paths at session start for Pi, Antigravity, and Codex.
- **MCP Config Integration**: Per-project tool enabling/disabling via `.mcp.json`.

## Impact
- Specs: `settings-configuration`
- Code:
  - `packages/shared/src/protocol.ts`
  - `packages/server/src/ws-router.ts`
  - `packages/server/src/pi-sdk-app-server.ts`
  - `packages/server/src/antigravity-app-server.ts`
  - `packages/server/src/antigravity-sdk-bridge.py`
  - `apps/client/src/client/app/SettingsPage.tsx`
