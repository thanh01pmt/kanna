## ADDED Requirements

### Requirement: Section Division
Kanna SHALL divide the settings providers section into two separate tabs: `Agents` and `LLM (Quick Response)`.

#### Scenario: Tab Access
- **WHEN** the user opens the settings page
- **THEN** the sidebar displays separate "Agents" and "LLM (Quick Response)" options, and selecting either renders their respective config panels.

### Requirement: Agent Configuration Accordion
Kanna SHALL display configurations for the supported agents (Claude Code, Codex, Antigravity, Pi Agent) under the `Agents` tab as a vertical accordion list, with only the default agent's accordion expanded by default.

#### Scenario: Accordion Toggle
- **WHEN** the user clicks on a collapsed agent accordion
- **THEN** it expands to show details (Model, Reasoning Effort, Plan Mode, etc.) while the previously expanded agent accordion collapses.

### Requirement: Default Tools and Status Display
Kanna SHALL list the default tools and the local CLI installation status of each agent under its respective accordion.

#### Scenario: Pi Default Tools
- **WHEN** the user views the Pi Agent accordion
- **THEN** Kanna displays its default tools (`Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `TodoWrite`) and the active installation status pill.

### Requirement: Quick Response LLM Configuration
Kanna SHALL isolate the Quick Response SDK configuration to the `LLM (Quick Response)` tab and provide a visual fallback description.

#### Scenario: LLM Provider Save
- **WHEN** the user saves credentials in the LLM tab
- **THEN** Kanna persists the config to `~/.kanna-dev/llm-provider.json` and uses it for Title/Commit generation.

### Requirement: Context-Aware Skills and MCP Scanning for Pi Agent
When the default agent is set to Pi Agent, the `Skills` and `MCP` settings tabs SHALL query and list the custom skills and MCP servers configured locally in the Pi agent directory.

#### Scenario: Pi Skills and MCP List
- **WHEN** the default agent is set to Pi Agent and the user visits the Skills tab
- **THEN** Kanna displays the folders present in `~/.pi/agent/skills` and lists them as Pi local skills with an option to open the directory.
