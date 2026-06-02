## 1. Ownership Model
- [x] 1.1 Extend artifact definitions with ownership class and owner workflow metadata.
- [x] 1.2 Validate that canonical artifacts have a single owner workflow.
- [x] 1.3 Route non-owner edits of canonical artifacts into review/repair requests.

## 2. Lock Model
- [x] 2.1 Add lock state for file, directory, and glob scopes.
- [x] 2.2 Acquire locks before start/repair actions that may write artifacts.
- [x] 2.3 Release locks on completion and mark locks recoverable on interruption.

## 3. Conflict Detection
- [x] 3.1 Detect same canonical artifact write conflicts.
- [x] 3.2 Detect overlapping file/directory/glob scope conflicts.
- [x] 3.3 Allow shared append-only artifacts when explicitly declared.

## 4. UI
- [x] 4.1 Show blocked-by-lock and conflict reasons in workflow readiness/start surfaces.
- [x] 4.2 Add conflict resolution UI for owner conflicts and overlapping scopes.
- [x] 4.3 Add interrupted lock recovery action.

## 5. Verification
- [x] 5.1 Test canonical owner validation and non-owner repair routing.
- [x] 5.2 Test lock acquire/release/recovery behavior.
- [x] 5.3 Test conflict detection for overlapping scopes.
- [x] 5.4 Validate OpenSpec and run relevant tests.
