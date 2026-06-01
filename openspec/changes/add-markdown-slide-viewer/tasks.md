## 1. Backend Protocol & Message Handlers

- [x] 1.1 Update `packages/shared/src/protocol.ts` to add `"project.listMarkdownFiles"` and `"project.readMarkdownFile"` command schemas.
- [x] 1.2 Implement the `"project.listMarkdownFiles"` case in `packages/server/src/ws-router.ts` that recursively scans for `.md` and `.markdown` files in the active project.
- [x] 1.3 Implement the `"project.readMarkdownFile"` case in `packages/server/src/ws-router.ts` to read and return the file content.

## 2. Monorepo Package Setup: `@kanna/slide-viewer`

- [x] 2.1 Create the directory structure `packages/slide-viewer` with its own `package.json`, `tsconfig.json` defining standard workspace package config.
- [x] 2.2 Implement the lightweight Marp parser in `packages/slide-viewer/src/utils/marpParser.ts`.
- [x] 2.3 Implement the `SlidePage` rendering component in `packages/slide-viewer/src/components/SlidePage.tsx`.
- [x] 2.4 Implement the main `SlideViewer` component in `packages/slide-viewer/src/components/SlideViewer.tsx` supporting document view, paginated presentation view, slide-by-slide transitions, and keyboard/mouse slide controls.
- [x] 2.5 Implement the zoomable `ImageModal` component in `packages/slide-viewer/src/components/ImageModal.tsx`.
- [x] 2.6 Implement style definitions in `packages/slide-viewer/src/styles/slide-viewer.css` supporting uncovering transitions, pagination, gaia/uncover themes, and layout rules.
- [x] 2.7 Expose the package exports in `packages/slide-viewer/src/index.ts`.

## 3. Right Sidebar Store Extension

- [x] 3.1 Update `apps/client/src/client/stores/rightSidebarStore.ts` to support `"slides"` in the `rightPanel` type union and create default visibility states.

## 4. Layout & Sidebar Integration

- [x] 4.1 Reference the `@kanna/slide-viewer` package dependency in `apps/client/package.json` and run `pnpm install` to link workspace packages.
- [x] 4.2 Create the `MarkdownSlideViewer` panel component at `apps/client/src/client/components/chat-ui/MarkdownSlideViewer.tsx` which wraps the `@kanna/slide-viewer` component.
- [x] 4.3 Update `apps/client/src/client/components/chat-ui/ChatNavbar.tsx` to add a slide presentation toggle button.
- [x] 4.4 Update `apps/client/src/client/app/ChatPage/index.tsx` to hook up the slide viewer panel toggle callback and render the `MarkdownSlideViewer` inside the right sidebar pane.

## 5. Verification

- [x] 5.1 Build the monorepo using `pnpm build` to verify type safety and compilation across all packages.
- [x] 5.2 Validate the OpenSpec change using strict validation.

## 6. Monorepo Package Setup: `@kanna/tree-view`

- [x] 6.1 Create the directory structure `packages/tree-view` with its own `package.json` and `tsconfig.json` defining standard workspace package config.
- [x] 6.2 Implement path parser utility that builds a nested tree from an array of relative paths.
- [x] 6.3 Implement collapsible, interactive React folder tree component in `packages/tree-view/src/components/FileTree.tsx`.
- [x] 6.4 Expose the package exports in `packages/tree-view/src/index.ts`.

## 7. Tree View Integration & UI Update

- [x] 7.1 Reference the `@kanna/tree-view` package dependency in `apps/client/package.json` and run `pnpm install` to link workspace packages.
- [x] 7.2 Refactor `apps/client/src/client/components/chat-ui/MarkdownSlideViewer.tsx` to feature a resizable/collapsible left pane containing the file tree and a right pane displaying the slide viewer, replacing the simple dropdown.
