# Design: Edit Agent Configurations (Pi, Antigravity, Claude, Codex) with Backups

## Context
External agent runners rely on configuration files in the user's home subdirectory:
- Pi: `~/.pi/agent/settings.json`
- Antigravity: `~/.gemini/config/mcp_config.json`
- Claude: `~/.claude.json`
- Codex: `~/.codex/config.toml`

Currently, Kanna only shows lists or links to open directories. We will integrate inline config editing with automated backups for all four agents to make Kanna a true unified control panel.

## Goals
- Allow developers to view and edit agent configurations as raw text (JSON/TOML).
- Prevent JSON misconfiguration via syntax validation before saving.
- Create automated `.bak` files on edit to allow one-click rollback.

## Decisions

### 1. WebSocket Commands
We will introduce three new WS message types:
```typescript
type AgentConfigType = "pi" | "antigravity" | "claude" | "codex";

// Request/Response types in protocol.ts
| { type: "settings.readAgentConfig"; agent: AgentConfigType }
| { type: "settings.writeAgentConfig"; agent: AgentConfigType; content: string }
| { type: "settings.restoreAgentConfig"; agent: AgentConfigType }
```

### 2. File Mappings & Formats
- `pi` -> JSON: `~/.pi/agent/settings.json` (Backup: `settings.json.bak`)
- `antigravity` -> JSON: `~/.gemini/config/mcp_config.json` (Backup: `mcp_config.json.bak`)
- `claude` -> JSON: `~/.claude.json` (Backup: `.claude.json.bak`)
- `codex` -> TOML: `~/.codex/config.toml` (Backup: `config.toml.bak`)

### 3. Validation Strategy
- **JSON files** (`pi`, `antigravity`, `claude`): The client and server will validate using `JSON.parse` before writing.
- **TOML files** (`codex`): Edited as plain text. The server will perform basic checks or allow writing directly with a warning.

## UI Design
- Added under `SettingsPage.tsx` under each agent's config dashboard.
- A collapsible section titled "Raw Configuration Editor".
- Monospaced text area showing the configuration contents.
- Action Buttons:
  - **Save Changes**: enabled when the content is valid (JSON syntax ok) and modified.
  - **Restore from Backup**: enabled when a backup file exists on the server.
