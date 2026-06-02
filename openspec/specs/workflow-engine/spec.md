# Capability: Workflow Engine

## Purpose
This capability defines the execution, progress tracking, artifact management, and real-time status synchronization for the Kanna Workflow Engine.
## Requirements
### Requirement: Real-time Projection Synchronization
The Kanna server and client SHALL establish a real-time data sync channel using WebSockets to broadcast workflow run projections, ensuring the right sidebar and tracking panel show live updates without requiring manual page refreshes.

#### Scenario: Real-time Workflow Snapshot Update
- **WHEN** a client subscribes to the `project-workflow` topic for a project
- **AND** the database workflow state is updated (such as when a node status changes or a new event is recorded)
- **THEN** the server SHALL push a revised `project-workflow` snapshot to the subscribed client
- **AND** the client store SHALL ingest the snapshot and update the workflow UI.

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

### Requirement: Static Extraction of Workflows
The system SHALL parse static Markdown documentation such as prompts, lessons, and specifications to extract `ArtifactDefinition` and `ArtifactDependencyRule` schemas, converting them into a structured `WorkflowManifest`.

#### Scenario: Discovering Artifact Rules
- **WHEN** the static extractor runs against a valid Markdown file containing expected output definitions
- **THEN** it SHALL output a correctly formatted `WorkflowManifest` based on the parsed textual anchors.

### Requirement: Workflow Approval and Publishing
The system SHALL present the extracted `WorkflowManifest` in a Human Approval UI before it becomes active. Only approved manifests SHALL be published as an immutable version.

#### Scenario: Publishing an Extracted Workflow
- **WHEN** the user is presented with a draft `WorkflowManifest` in an approval card
- **AND** they click "Publish"
- **THEN** the system SHALL save the manifest as an immutable workflow version in the database.

### Requirement: Artifact Action Controls
The Workflow Tracker Panel SHALL provide fine-grained controls for individual artifacts in expanded view modes, enabling users to `Rerun`, `Review downstream`, `Repair downstream`, `Regenerate`, `Invalidate`, or `Accept as source of truth` without re-running the entire workflow.

#### Scenario: Interacting with an Artifact
- **WHEN** the user views an artifact in expanded density mode
- **THEN** the UI SHALL display the available action buttons styled as pill-shaped or tag-shaped elements.

### Requirement: Downstream Impact Resolution
The system SHALL dynamically compute a dependency tree based on `artifact_impacts` to determine downstream artifacts that require attention when a source artifact is modified or selected for repair.

#### Scenario: Bulk Repair Initiation
- **WHEN** the user triggers the "Repair downstream" action on an artifact
- **THEN** the server SHALL recursively calculate all impacted artifacts
- **AND** the UI SHALL present a confirmation dialog listing the affected items before executing the repair operation.
