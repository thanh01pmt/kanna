## ADDED Requirements

### Requirement: Workflow Packs
The system SHALL allow related workflows to be grouped into workflow packs that can be registered into a project together.

#### Scenario: Registering a workflow pack
- **WHEN** a user selects a workflow pack for a project
- **THEN** the system SHALL register the pack's workflows into the project using pinned workflow versions
- **AND** apply the pack's recommended default entrypoint when the user accepts it.

### Requirement: Project Flow Graph
The system SHALL represent relationships between registered project workflows as a project flow graph.

#### Scenario: Viewing main workflow order
- **WHEN** a project has registered workflows with graph edges
- **THEN** the UI SHALL show the main flow between workflows, such as `A -> B -> C`.

### Requirement: Edge Source Precedence
The system SHALL resolve workflow graph edges using explicit edges before inferred or AI-suggested edges.

#### Scenario: Explicit edge overrides inference
- **WHEN** an explicit edge conflicts with an inferred artifact IO edge
- **THEN** the explicit edge SHALL take precedence
- **AND** the conflict SHALL be visible for review if it changes readiness or ordering.

### Requirement: Artifact IO Edge Inference
The system SHALL infer flow graph edges from workflow input and output artifact contracts.

#### Scenario: Inferring producer-consumer relationship
- **WHEN** workflow A outputs an artifact required by workflow B
- **THEN** the system SHALL infer an edge from workflow A to workflow B.

### Requirement: AI-Suggested Graph Edges
The system SHALL allow AI to suggest project flow graph edges, but suggested edges SHALL require approval before becoming canonical.

#### Scenario: Approving an AI edge suggestion
- **WHEN** AI suggests a flow edge
- **AND** the user approves it
- **THEN** the system SHALL store the edge as approved and include it in the canonical project flow graph.
