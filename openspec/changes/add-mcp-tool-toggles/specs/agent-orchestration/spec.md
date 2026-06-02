## ADDED Requirements

### Requirement: Per-Project MCP Tool Filtering
Kanna SHALL allow users to selectively enable or disable individual MCP tools for each project.
The agent runner SHALL filter out disabled tools from the toolsets passed to the active LLM agent provider.

#### Scenario: Enable/Disable Tool in UI
- **WHEN** the user toggles a tool's active status in the Settings -> MCP view
- **THEN** Kanna SHALL update the `tools` map inside the project's `.mcp.json` file to reflect the new state.

#### Scenario: Filtering during Agent Turn
- **WHEN** Kanna starts a new turn or session for an agent in a project
- **THEN** Kanna SHALL read the project's `.mcp.json` and filter out any tools marked as `false` before sending the tool definitions to the active agent provider.
