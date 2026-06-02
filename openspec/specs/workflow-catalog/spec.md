# workflow-catalog Specification

## Purpose
TBD - created by archiving change add-workflow-catalog-settings. Update Purpose after archive.
## Requirements
### Requirement: Settings Workflow Catalog
The system SHALL provide a Settings-level workflow catalog where users can view workflow definitions available to them before adding them to any project.

#### Scenario: Viewing available workflows
- **WHEN** a user opens Settings > Workflows
- **THEN** the system SHALL list workflows owned by that user
- **AND** official global workflows available to all users.

### Requirement: Workflow Ownership and Visibility
Workflow definitions SHALL have ownership and visibility metadata so SaaS users do not automatically see private workflows created by other users.

#### Scenario: Private workflow visibility
- **WHEN** user A publishes a private workflow
- **THEN** user B SHALL NOT see that workflow in their catalog unless it is explicitly shared or published globally.

#### Scenario: Official global workflow visibility
- **WHEN** a workflow is marked as official global
- **THEN** all users SHALL be able to see it in their workflow catalog.

### Requirement: Frontmatter-First Workflow Import
The system SHALL treat YAML frontmatter in workflow Markdown as the primary workflow contract and use static extraction only as a fallback or inference aid.

#### Scenario: Importing declared artifacts
- **WHEN** the workflow frontmatter declares artifacts and dependencies
- **THEN** those declarations SHALL be used as the source of truth for the proposed manifest.

#### Scenario: Inferring undeclared artifacts
- **WHEN** the workflow body references artifacts not declared in frontmatter
- **THEN** the system SHALL present those artifacts as inferred additions requiring user approval before publish.

### Requirement: Workflow Version History
The system SHALL preserve version history for each workflow definition and publish immutable workflow versions.

#### Scenario: Publishing a new version
- **WHEN** a user publishes a workflow version
- **THEN** the system SHALL store the source Markdown and normalized manifest as an immutable version
- **AND** the previous published versions SHALL remain available for existing project registrations.
*** Add File: /Users/tonypham/MEGA/WebApp/kanna/openspec/changes/add-workflow-catalog-settings/tasks.md

