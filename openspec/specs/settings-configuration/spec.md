# settings-configuration Specification

## Purpose
TBD - created by archiving change update-llm-tab-layout. Update Purpose after archive.
## Requirements
### Requirement: Credential Layout Card
The LLM tab SHALL render LLM provider configurations inside a structured form card with distinct, labeled fields for Provider, Base URL, API Key, and Model ID, each with clear placeholder and description helper text.

#### Scenario: Field Labels Display
- **WHEN** the user navigates to the LLM settings tab
- **THEN** they see individual field labels for "Provider", "Base URL" (if custom provider is selected), "API Key", and "Model ID" above their respective inputs.

### Requirement: Password Toggle
The API Key input field SHALL support a show/hide password toggle.

#### Scenario: Password Visibility Change
- **WHEN** the user clicks the eye icon on the API Key input
- **THEN** the input text toggles between hidden password dots and visible plaintext.

### Requirement: Connection Test
The LLM tab SHALL provide a manual "Test Connection" button that triggers verification of the configured LLM provider and displays a loading indicator while validation is in progress.

#### Scenario: Test Connection Success
- **WHEN** the user clicks the "Test Connection" button with valid credentials
- **THEN** a loading spinner is displayed and upon success, Kanna displays a valid connection checkmark.

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

### Requirement: Skills Stateful Toggle
Kanna SHALL support listing and stateful toggling (enable/disable) of custom skills for Pi, Antigravity, and Codex agent providers via atomic filesystem directory renaming using `.disabled` suffix.

#### Scenario: List Skills
- **WHEN** the user views the skills section in settings
- **THEN** Kanna lists custom skills discovered in both global and project-local directories with their enable/disable status.

#### Scenario: Toggle Skill
- **WHEN** the user toggles a skill and saves
- **THEN** Kanna renames the skill directory (e.g., adding or removing `.disabled` suffix).

### Requirement: Dynamic Skill Paths Integration
Kanna SHALL dynamically merge global and project-local skill directory paths at agent runtime for Pi, Antigravity, and Codex agents.

#### Scenario: Run Pi Agent
- **WHEN** a Pi agent session is initialized
- **THEN** Kanna automatically resolves and passes additional project-local skill paths to the resource loader.

#### Scenario: Run Antigravity Agent
- **WHEN** an Antigravity agent is started via python SDK
- **THEN** Kanna resolves project-local skill paths and passes them via `skills_paths` config.

