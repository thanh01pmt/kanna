# agent-orchestration Specification

## Purpose
TBD - created by archiving change add-agent-providers. Update Purpose after archive.
## Requirements
### Requirement: Supported Agent Providers
Kanna SHALL support integration with the following agent providers:
- `claude` (In-process SDK)
- `codex` (Child process via JSON-RPC)
- `antigravity` (Child process via JSONL streaming)
- `pi` (Child process via JSONL streaming)

#### Scenario: Provider Selection
- **WHEN** a user starts a chat in a project discovered via Antigravity or Pi
- **THEN** Kanna utilizes the respective CLI runtime (`agy` or `pi`) to stream responses and manage tool calls.

