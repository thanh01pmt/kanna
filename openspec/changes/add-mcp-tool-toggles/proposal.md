## Why

Currently, Kanna connects to MCP servers and exposes all discovered tools directly to the active agent provider (e.g., Claude, Antigravity, Pi). This results in context bloat, increased token consumption, high latency, and increased potential for model confusion or incorrect tool calls. We need a way to globally register MCP servers but selectively enable/disable specific tools on a per-project basis via a simple toggle UI.

## What Changes

- **Project Configuration (`.mcp.json`)**: Extend the `.mcp.json` file schema in each project to include a `tools` mapping of server names to tool enablement state (`Record<string, Record<string, boolean>>`).
- **Frontend settings UI (`SettingsPage.tsx`)**: In the MCP section under the Tools row, replace the static list with an interactive UI showing tool names, descriptions, and a toggle switch for each tool.
- **Backend agent runtime filtering (`agent.ts`)**: Update the agent execution pipeline to fetch the project's `.mcp.json` tool enablement configuration and filter the exposed tools before sending them to the LLM agent provider (e.g. Claude Code or Antigravity/Pi runtimes).

## Capabilities

### New Capabilities
<!-- None needed, fits under existing agent-orchestration -->

### Modified Capabilities
- `agent-orchestration`: Add per-project tool filtering to the agent execution session.

## Impact

- **`apps/client/src/client/app/SettingsPage.tsx`**: Add toggle switch elements for each tool and sync state back to `.mcp.json` on change.
- **`packages/server/src/agent.ts`**: Read project-level `.mcp.json` and filter out disabled tools from the toolsets passed to LLMs.
- **`packages/shared/src/types.ts`**: Update typescript definitions for MCP configurations to support the `tools` toggle state.
