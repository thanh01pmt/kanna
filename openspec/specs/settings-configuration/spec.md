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

