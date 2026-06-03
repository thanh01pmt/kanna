## ADDED Requirements

### Requirement: Agent Status Floating Popover
Kanna SHALL support a floating popover containing the active agent checklist, project environment context, and files referenced as sources.

#### Scenario: Open Status Popover
- **WHEN** the user clicks the agent status button in the top navbar
- **THEN** Kanna displays the status popover displaying "Progress", "Environment", and "Sources".

#### Scenario: Right Sidebar Conflict Resolution
- **WHEN** the user opens the right sidebar panel
- **THEN** Kanna automatically closes the status popover.

### Requirement: Collapsible Turn Diagnostics in Transcript
Kanna SHALL support collapsible turn-level diagnostics under result messages, displaying execution duration, costs, token usage, and trajectory details.

#### Scenario: View Turn Diagnostics
- **WHEN** the user clicks the duration/stats badge on a result message
- **THEN** the message expands to show a breakdown of tokens, tool calls, and trajectory steps for that turn.

### Requirement: Diagnostics Panel Quick Access
Kanna SHALL allow quick toggles to open the Diagnostics panel in the right sidebar via a navbar button and the status strip "Tokens" chip.

#### Scenario: Click Tokens Chip
- **WHEN** the user clicks the "Tokens" chip in the status strip
- **THEN** Kanna opens the Diagnostics panel in the right sidebar.

