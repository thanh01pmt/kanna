# Change: Edit Agent Configurations (Pi, Antigravity, Claude, Codex) with Backups

## Why
To allow developers to modify and restore configuration files for all external agents (Pi, Antigravity, Claude Code, and Codex) directly from Kanna's Settings UI without using external text editors, with safety backups to prevent misconfiguration.

## What Changes
- **ADDED** backend WebSocket protocol commands:
  - `settings.readAgentConfig`: reads the raw configuration contents of Pi (`settings.json`), Antigravity (`mcp_config.json`), Claude (`.claude.json`), or Codex (`config.toml`).
  - `settings.writeAgentConfig`: creates a `.bak` backup copy and writes the new configuration content.
  - `settings.restoreAgentConfig`: restores the configuration from the `.bak` backup copy.
- **ADDED** configuration editing panels in `SettingsPage.tsx` under the respective Agent settings view.
- **ADDED** rollback / restore capability to quickly reverse configurations from backups.

## Impact
- Specs: `settings-configuration`
- Code:
  - `packages/shared/src/protocol.ts`
  - `packages/server/src/ws-router.ts`
  - `apps/client/src/client/app/SettingsPage.tsx`
