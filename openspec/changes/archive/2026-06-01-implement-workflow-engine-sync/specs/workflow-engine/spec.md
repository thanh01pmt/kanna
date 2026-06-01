## ADDED Requirements

### Requirement: Real-time Projection Synchronization
The Kanna server and client SHALL establish a real-time data sync channel using WebSockets to broadcast workflow run projections, ensuring the right sidebar and tracking panel show live updates without requiring manual page refreshes.

#### Scenario: Real-time Workflow Snapshot Update
- **WHEN** a client subscribes to the `project-workflow` topic for a project
- **AND** the database workflow state is updated (such as when a node status changes or a new event is recorded)
- **THEN** the server SHALL push a revised `project-workflow` snapshot to the subscribed client
- **AND** the client store SHALL ingest the snapshot and update the workflow UI.
