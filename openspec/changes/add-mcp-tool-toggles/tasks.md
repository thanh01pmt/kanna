## 1. Type Definitions & Shared Config

- [ ] 1.1 Update the `McpConfig` and `McpServerConfig` types in Kanna (in `apps/client/src/client/app/SettingsPage.tsx` and `packages/shared/src/types.ts` if applicable) to include an optional `tools` record mapping server names/tool names to boolean status.

## 2. Frontend Toggle UI

- [ ] 2.1 Update the Tools display row in `SettingsPage.tsx` (`McpSection` component) to display each tool with an interactive Toggle Switch (e.g., Kanna's toggle switch or a custom styled switch).
- [ ] 2.2 Bind the Toggle Switch `onChange` event to update the `.mcp.json` configuration file immediately using the existing project file write API.

## 3. Backend Agent Runtime Tool Filtration

- [ ] 3.1 Modify the backend agent session bootloader (in `packages/server/src/agent.ts` or corresponding MCP connection layers) to read the project's `.mcp.json` configuration when starting a new turn.
- [ ] 3.2 Filter the toolset passed to the agent provider (e.g., Claude Code, Antigravity, Pi) by removing any tools explicitly marked as `false` in the project's config.

## 4. Verification

- [ ] 4.1 Verify that toggling a tool in the Settings -> MCP page correctly persists the tool's enabled/disabled state in the project's `.mcp.json`.
- [ ] 4.2 Verify that disabled tools are completely hidden from the LLM agent provider during an active chat turn.
