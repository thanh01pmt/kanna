# settings-configuration Delta Specification

## ADDED Requirements

### Requirement: Agent Config Editor
The settings interface SHALL provide a raw JSON/TOML configuration editor for Pi, Antigravity, Claude, and Codex agents to allow direct updates.

#### Scenario: Edit Configuration Content
- **WHEN** the user updates the configuration editor text with valid formatting
- **THEN** the "Save Changes" action becomes enabled.

#### Scenario: Invalid JSON Input
- **WHEN** the user inputs invalid JSON text for Pi, Antigravity, or Claude config
- **THEN** the "Save Changes" action is disabled and a syntax warning is shown.

### Requirement: Configuration Backups and Restore
Kanna SHALL automatically create a `.bak` backup file before writing any new agent configurations, and support reverting to it.

#### Scenario: Restore Config from Backup
- **WHEN** a backup file exists for the selected agent and the user clicks "Restore from Backup"
- **THEN** the active configuration is reverted to the backup content.
