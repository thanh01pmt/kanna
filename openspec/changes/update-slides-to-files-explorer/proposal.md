# Change: Update Slides to Files Explorer

## Why
The Kanna UI has a "Slides" sidebar panel which is primarily used as a project file explorer and markdown viewer. The name "Slides" is misleading for a general file previewer, the tree view cannot be collapsed by the user smoothly, and it lacks tabbed browsing for multiple files. We need to rename "Slides" to "Files", support collapsible panels, and implement multiple open tabs similar to Codex's UX.

## What Changes
- **Rename** "Slides" to "Files" everywhere in the UI (launcher cards, titles, actions, and states).
- **Collapsible Tree View**: Support smooth collapsing/expanding of the tree view panel inside the Files panel.
- **Multiple Tabs**: Implement a tabbed interface at the top of the file viewer to support opening and switching between multiple files.
- **Collapse All button**: Add a "Collapse All" button to collapse all expanded directories in the tree.

## Impact
- Specs: `markdown-slide-viewer`
- Code:
  - `apps/client/src/client/stores/rightSidebarStore.ts`
  - `apps/client/src/client/app/ChatPage/index.tsx`
  - `apps/client/src/client/components/chat-ui/ChatNavbar.tsx`
  - `apps/client/src/client/components/chat-ui/MarkdownSlideViewer.tsx` (optionally rename or adapt inside it)
  - `packages/tree-view/src/components/FileTree.tsx`
