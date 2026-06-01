## ADDED Requirements

### Requirement: Tracker UI Density Modes
The Workflow Tracker Panel SHALL support multiple visual density modes to accommodate differing levels of desired detail during workflow execution.
- `compact`: Shows only high-level status without deeper context (e.g. hiding log summaries or nested children counts).
- `normal`: Shows standard node information, hiding exhaustive logs unless expanded.
- `expanded`: Shows all node data, actions, logs, and artifacts automatically.

#### Scenario: Switching Density Modes
- **WHEN** the density mode prop is set to `compact`
- **THEN** the UI SHALL collapse detailed logs and node metadata to preserve vertical space.

### Requirement: Design System Alignment
The Workflow Tracker Panel SHALL adhere to the overarching Kanna Design System tokens, ensuring proper background surface rendering (`bg-card`, `bg-background`), semantic border colors (`border-border`), and font usage.

#### Scenario: Visual UI Layout
- **WHEN** the panel renders a workflow node
- **THEN** it SHALL use the Roboto Mono font (`font-mono`) for code blocks, logs, and technical metadata, and the standard Body font for readable descriptions.
