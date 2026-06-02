# nested-workflow-views Specification

## Purpose
TBD - created by archiving change add-nested-workflow-detail-views. Update Purpose after archive.
## Requirements
### Requirement: Main Flow Overview
The system SHALL provide a main flow overview that shows project-level workflow nodes and their high-level status without forcing users to inspect all nested steps at once.

#### Scenario: Viewing project flow
- **WHEN** the user opens the workflow panel for a project
- **THEN** the UI SHALL show the main workflow flow with each top-level workflow's status and artifact summary.

### Requirement: Nested Workflow Detail View
The system SHALL provide a detail view for a selected workflow node that shows its internal sub-workflow, tasks, steps, and artifacts.

#### Scenario: Opening workflow detail
- **WHEN** the user clicks a workflow node in the main flow
- **THEN** the UI SHALL open a detail view for that workflow
- **AND** show the selected workflow's internal nodes.

### Requirement: Breadcrumb Navigation
The system SHALL provide navigation between main flow and nested detail views.

#### Scenario: Returning to main flow
- **WHEN** the user is viewing a nested workflow detail
- **AND** clicks the main flow breadcrumb
- **THEN** the UI SHALL return to the main flow overview.

### Requirement: Status and Artifact Summaries Across Levels
The system SHALL show status counts and produced artifact summaries at both main flow and nested detail levels.

#### Scenario: Summarizing a nested workflow
- **WHEN** a nested workflow has completed child steps and produced artifacts
- **THEN** the parent workflow node SHALL show a concise summary of progress and outputs.

