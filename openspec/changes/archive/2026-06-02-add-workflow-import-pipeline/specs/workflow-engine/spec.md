## ADDED Requirements

### Requirement: Static Extraction of Workflows
The system SHALL parse static Markdown documentation (e.g., prompts, lessons, specifications) to extract `ArtifactDefinition` and `ArtifactDependencyRule` schemas, converting them into a structured `WorkflowManifest`.

#### Scenario: Discovering Artifact Rules
- **WHEN** the static extractor runs against a valid Markdown file containing expected output definitions
- **THEN** it SHALL output a correctly formatted `WorkflowManifest` based on the parsed textual anchors.

### Requirement: Workflow Approval and Publishing
The system SHALL present the extracted `WorkflowManifest` in a Human Approval UI before it becomes active. Only approved manifests SHALL be published as an immutable version.

#### Scenario: Publishing an Extracted Workflow
- **WHEN** the user is presented with a draft `WorkflowManifest` in an `InfoCard` or `DiffFileCard`
- **AND** they click "Publish"
- **THEN** the system SHALL save the manifest as an Immutable Workflow Version in the database.
