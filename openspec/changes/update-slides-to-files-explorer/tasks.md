## 1. Preparation & Renaming
- [ ] 1.1 Update `rightSidebarStore.ts` to replace `"slides"` with `"files"` state keys and handlers.
- [ ] 1.2 Update `ChatNavbar.tsx` to support the new `"files"` panel toggles.
- [ ] 1.3 Update `ChatPage/index.tsx` sidebar launcher list, replacing the `"Slides"` card with `"Files"` card (with a folder icon, new description, and update triggers).

## 2. Collapsible Tree View & Collapse All
- [ ] 2.1 Add `collapsible={true}` and make the tree view panel inside `MarkdownSlideViewer` collapsible via resizable handle drag.
- [ ] 2.2 Add an explicit "Collapse All" button at the top of `FileTree.tsx` to collapse all folders at once.

## 3. Multiple Tab Bar & Breadcrumbs
- [ ] 3.1 Refactor the `MarkdownSlideViewer` component to manage multiple open files (tabs) instead of a single selected file.
- [ ] 3.2 Implement a premium tab bar and breadcrumb trail at the top of the file content pane to mimic the Codex UX.
