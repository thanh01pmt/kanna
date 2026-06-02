## 1. Sharing Model
- [ ] 1.1 Add share identifiers/tokens for workflow definitions or versions.
- [ ] 1.2 Add import lineage metadata for shared workflows.
- [ ] 1.3 Enforce private workflow isolation without a valid share ID.

## 2. Import by ID
- [ ] 2.1 Add command/API to resolve shared workflow metadata by ID.
- [ ] 2.2 Add command/API to import a shared workflow into the current user's catalog.
- [ ] 2.3 Preserve source owner/version metadata on imported copies.

## 3. Official/Marketplace Publishing
- [ ] 3.1 Add official/global publish request and approval state.
- [ ] 3.2 Add marketplace metadata fields for category, tags, author, compatibility, and summary.
- [ ] 3.3 Make approved official global workflows visible to all users.

## 4. UI
- [ ] 4.1 Add share workflow action in Settings catalog.
- [ ] 4.2 Add import-by-ID flow with manifest summary and confirmation.
- [ ] 4.3 Add official/global publishing review state for authorized users.
- [ ] 4.4 Show source lineage and update availability for imported workflows.

## 5. Verification
- [ ] 5.1 Test private workflows are hidden from other users.
- [ ] 5.2 Test import by valid share ID and reject invalid/revoked IDs.
- [ ] 5.3 Test official approval makes workflow globally visible.
- [ ] 5.4 Validate OpenSpec and run relevant tests.
