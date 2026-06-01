## Why

Users editing Markdown curriculum documents (including Marp slides) in the Kanna workspace currently lack a native way to preview standard Markdown formatting and present/test slide decks interactively. Adding a slide presentation and markdown viewer directly in the Kanna client sidebar enhances the developer experience and eliminates the need to rely on external viewers.

To ensure this slide viewer is highly reusable in other projects, we will build it as a separate workspace package (`packages/slide-viewer`) within our monorepo.

## What Changes

- Create a new monorepo workspace package `packages/slide-viewer` containing the core slide-rendering, Marp-parsing, and navigation logic.
- Add a new right sidebar panel type `"slides"` to `rightSidebarStore`.
- Implement a `MarkdownSlideViewer` panel component in the client UI that imports and uses the `@kanna/slide-viewer` package.
- Provide a slide presentation rendering capability supporting standard Marp directives (`---` slide breaks, `paginate`, background splits).
- Provide slide navigation controls (Next, Previous, slide index indicator) in the panel.
- Support standard Markdown rendering with syntax highlighting for code blocks and clickable/zoomable images.

## Capabilities

### New Capabilities
- `markdown-slide-viewer`: Defines the behavior of rendering standard markdown documents and presenting Marp slides inside the Kanna workspace, including navigation controls, custom slide styling, and interactive component support.

### Modified Capabilities
<!-- None -->

## Impact

- `packages/slide-viewer/*`: New workspace package exposing the slide viewer, parser, styles, and react components.
- `apps/client/src/client/stores/rightSidebarStore.ts`: Extend the `rightPanel` union type to support `"slides"`.
- `apps/client/src/client/app/ChatPage/index.tsx`: Include toggle controls and render the new slide panel in the right sidebar.
- `apps/client/src/client/components/chat-ui/ChatNavbar.tsx`: Add a toolbar button to toggle the slide viewer panel.
- New dependencies in `apps/client/package.json` for importing `@kanna/slide-viewer`.
