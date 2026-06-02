## Context

Currently, Kanna connects to various MCP servers (such as the local `kanna-workflow` server or custom external servers configured via `.mcp.json`). All discovered tools are exposed directly to the AI agent providers (Claude, Antigravity, Pi, Codex), causing context bloat and token overhead.

This design introduces a mechanism to enable/disable specific tools per project. It stores the toggled state in `.mcp.json` and filters the tools list in Kanna's host server before passing them to the agent.

## Goals / Non-Goals

**Goals:**
- Enable granular tool filtering in `.mcp.json` to reduce token consumption and prevent tool confusion.
- Provide a robust frontend Toggle UI for all tools (both local and external discovered servers) in the MCP settings.
- Ensure that the agent runtime filters out disabled tools before registering them with the LLM API.

**Non-Goals:**
- Global/User-wide tool toggling (this feature is strictly scoped to individual projects).
- Modifying the underlying MCP server protocol or schemas. We filter tools on the host/client side.

## Decisions

### 1. Store Tool States in `.mcp.json`
We will store the tool configuration directly inside the project's existing `.mcp.json` file.
```json
{
  "mcpServers": { ... },
  "tools": {
    "kanna-workflow": {
      "workflow_start_run": true,
      "workflow_publish_manifest": false
    }
  }
}
```
- **Rationale:** Keeps all MCP-related configuration in a single, project-scoped file. Avoids file clutter.
- **Alternatives Considered:** Creating a separate `.mcp-tools.json` file. Rejected because keeping it unified is cleaner and fits within the current `project.readFile` / `project.writeFile` API structure.

### 2. Perform Filtering at Kanna's Agent Runtime
We will filter out the disabled tools inside `packages/server/src/agent.ts` (for Claude sessions) and the server protocol/app server layers for other providers (Antigravity, Pi, Codex).
- **Rationale:** Filtering tools before sending them to the LLM ensures that the LLM is completely unaware of the disabled tools, avoiding any context bloat or token wastage.
- **Alternatives Considered:** Dynamic tool registration at the MCP server level. Rejected because it violates the standard MCP server specs and is overly complex.

## Risks / Trade-offs

- **[Risk] Syncing External Tools** → When an external server is configured, its tools are dynamically discovered at runtime. If a tool is not yet in `.mcp.json`, it should default to `true` (enabled).
  - *Mitigation:* Ensure that the frontend and backend treat any unspecified tool as `true` (enabled) by default.
- **[Risk] Concurrency Writes to `.mcp.json`** → Frequent toggle operations in the UI could lead to overlapping file write requests.
  - *Mitigation:* Ensure frontend writes are debounced or the state is saved sequentially, and backend uses standard safe write handlers.
