# spec delta settings-configuration

## ADDED Requirements
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
