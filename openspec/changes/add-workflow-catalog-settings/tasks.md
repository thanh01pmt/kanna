## 1. Schema and Store
- [x] 1.1 Add owner, visibility, and lifecycle metadata to workflow definition/version storage.
- [x] 1.2 Update workflow store methods to list catalog workflows by user scope plus official global visibility.
- [x] 1.3 Add commands/API for workflow catalog list, version list, import validation, and publish version.

## 2. Manifest Import
- [x] 2.1 Extend workflow schema to represent frontmatter inputs, outputs, artifacts, entrypoint/role, flow, and execution hints.
- [x] 2.2 Update the Markdown workflow extractor to prefer frontmatter declarations and mark body-discovered additions as inferred.
- [x] 2.3 Emit validation warnings for body references to undeclared artifacts and errors for missing required metadata.

## 3. Settings UI
- [x] 3.1 Add Settings > Workflows catalog list.
- [x] 3.2 Add workflow import/review/publish UI in Settings.
- [x] 3.3 Add version history display for a workflow definition.

## 4. Verification
- [x] 4.1 Add focused tests for catalog filtering and version publishing.
- [x] 4.2 Add import parser tests for declared, inferred, and invalid workflow Markdown.
- [x] 4.3 Validate OpenSpec and run relevant type/tests.
