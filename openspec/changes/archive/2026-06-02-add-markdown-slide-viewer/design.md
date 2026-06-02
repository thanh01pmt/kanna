## Context

Users edit curriculum documentation (typically written in Markdown, including Marp-compatible slide presentations) inside Kanna projects. Currently, there is no way to preview these files interactively within the Kanna workspace.

This design introduces a Sidebar Panel (`"slides"`) on the client that can fetch markdown files from the active project using new WebSocket commands, parse them into standard markdown pages (Marp slide deck) or a single document, and render them with rich styling, code highlighting, and zoomable images.

To make the viewer easily reusable across other apps/projects, we will implement the core slide parsing and rendering UI inside a dedicated monorepo package `packages/slide-viewer` (packaged as `@kanna/slide-viewer`).

## Goals / Non-Goals

**Goals:**
- Add a new right sidebar panel mode `"slides"` alongside Git and Browser.
- Introduce WebSocket commands to list all Markdown files in the active project and read their content.
- Implement `@kanna/slide-viewer` under `packages/slide-viewer` containing the core slide-rendering, parsing, navigation, and theme CSS.
- Support both a continuous Document View and a paginated Slide Presentation View.
- Build a slide renderer that parses Marp horizontal rules (`---`) and supports basic directives (`theme`, `bg`, `color`).
- Provide controls to customize the presentation theme, aspect ratio, text scaling, and light/dark appearance.
- Standardize slide navigation via UI buttons and keyboard shortcuts (Arrow keys, Space).
- Integrate lazy-loaded/clean syntax highlighting for code blocks and a zoomable Image Modal.

**Non-Goals:**
- Creating a full WYSIWYG Markdown editor (read-only preview is sufficient).
- Complete reproduction of every complex Marp HTML plugin; basic directives and standard Markdown are the primary focus.

## Design Alignment with `DESIGN.md`

The Slide Viewer component and panel will adhere strictly to Kanna's design primitives:
1. **Color Tokens**: Surface colors will use standard Tailwind CSS styles using HSL variables (e.g. `bg-background`, `bg-card`, `border-border`, `text-foreground`). Focus states, buttons, and logo elements will use the coral accent logo color (`var(--logo)`).
2. **Typography**: Mono fonts inside slide code blocks and inline code items will resolve to `"Roboto Mono"`. Layout buttons and settings headings will resolve to the default sans-serif font family.
3. **Shapes & Radii**: Interactive control buttons will use `rounded-full` or `rounded-md` depending on context. Control menus use `rounded-xl` and segmented tabs use Kanna's `.inline-flex .rounded-lg .border .p-[3px]` structure.
4. **Theme Configuration Settings**:
   - **Slide Theme**: A drop-down selection supporting `default` (clean slate), `gaia` (classic warmth), and `uncover` (centered modern titles).
   - **Aspect Ratio**: Controls to toggle between `16:9` widescreen and `4:3` classic ratios.
   - **Text Scale**: Options to scale slide text content dynamically (80%, 100%, 120%).
   - **Appearance Mode**: Options to match Kanna's system theme (`auto`), force light backgrounds, or force dark backgrounds for presentation slides.

## Decisions

### 1. File Listing & Reading via WebSocket
We will add two new commands to `ClientCommand`:
- `project.listMarkdownFiles`: returns an array of relative paths of `.md` / `.markdown` files.
- `project.readMarkdownFile`: reads the contents of the given file path.

*Alternative considered:* Relying on client-side HTTP file requests.
*Reason for choice:* The Kanna workspace is run locally, and the socket connection already provides secure project-relative file operations.

### 2. Extracted Package `@kanna/slide-viewer`
We will set up `packages/slide-viewer` with the following structure:
- `src/components/SlideViewer.tsx`: The main React component that handles switching between document mode and presentation mode, navigation state, settings popover for themes, and viewport rendering.
- `src/components/SlidePage.tsx`: Component to render a single slide page.
- `src/components/ImageModal.tsx`: Zoomable image overlay.
- `src/utils/marpParser.ts`: Lightweight Marp metadata/directive and slide separator parser.
- `src/styles/slide-viewer.css`: Custom CSS themes for slides (gaia, uncover, default).

*Reason for choice:* Keeps the Kanna application bundle clean and allows the slide rendering system to be shared directly with other packages/apps.

### 3. Client-Side Markdown & Slide Parsing
Instead of importing the heavy `@marp-team/marp-core` package, our parser will:
1. Splits markdown content by horizontal rules (`---` as slide breaks).
2. Parses basic frontmatter / directives (e.g. `marp: true`, `theme: <theme>`, `bg: <color/gradient>`).
3. Renders each slide content using standard React markdown renderers.

*Alternative considered:* Full `@marp-team/marp-core` integration.
*Reason for choice:* Client-side rendering is faster, requires no heavy polyfills, and fits perfectly into Kanna's existing UI architecture.

## Risks / Trade-offs

- **[Risk] Deep directories take too long to list** → **[Mitigation]** Limit the directory traversal to a depth of 5 and exclude common directories like `node_modules`, `.git`, `.turbo`, `dist`, `build`.
- **[Risk] Path references to local assets (e.g. images) fail to load** → **[Mitigation]** Re-write markdown image source URLs to point to local assets through the existing client static serving or websocket file download/URL mechanisms.
