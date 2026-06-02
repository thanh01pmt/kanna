## ADDED Requirements

### Requirement: Agent Status Floating Popover
Kanna SHALL support a floating popover containing the active agent checklist, project environment context, and files referenced as sources.

#### Scenario: Open Status Popover
- **WHEN** the user clicks the agent status button in the top navbar
- **THEN** Kanna displays the status popover displaying "Progress", "Environment", and "Sources".

#### Scenario: Right Sidebar Conflict Resolution
- **WHEN** the user opens the right sidebar panel
- **THEN** Kanna automatically closes the status popover.
