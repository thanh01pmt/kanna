## 1. Sharing Model
- [x] 1.1 Add share identifiers/tokens for workflow definitions or versions.
- [x] 1.2 Add import lineage metadata for shared workflows.
- [x] 1.3 Enforce private workflow isolation without a valid share ID.

## 2. Import by ID
- [x] 2.1 Add command/API to resolve shared workflow metadata by ID.
- [x] 2.2 Add command/API to import a shared workflow into the current user's catalog.
- [x] 2.3 Preserve source owner/version metadata on imported copies.

## 3. Official/Marketplace Publishing
- [x] 3.1 Add official/global publish request and approval state.
- [x] 3.2 Add marketplace metadata fields for category, tags, author, compatibility, and summary.
- [x] 3.3 Make approved official global workflows visible to all users.

## 4. UI
- [x] 4.1 Add share workflow action in Settings catalog.
- [x] 4.2 Add import-by-ID flow with manifest summary and confirmation.
- [x] 4.3 Add official/global publishing review state for authorized users.
- [x] 4.4 Show source lineage and update availability for imported workflows.

## 5. Verification
- [x] 5.1 Test private workflows are hidden from other users.
- [x] 5.2 Test import by valid share ID and reject invalid/revoked IDs.
- [x] 5.3 Test official approval makes workflow globally visible.
- [x] 5.4 Validate OpenSpec and run relevant tests.

