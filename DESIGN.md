# Kanna Code Web UI Design System

## Overview

**Kanna** (or `kanna-code`) is a beautiful, developer-centric Web UI for **Claude Code** (Anthropic's terminal-based coding assistant). The application is built using React, TypeScript, Vite, and Tailwind CSS. It connects to a local daemon/server via WebSocket, creating a unified workspace.

Unlike Anthropic's marketing website design (which relies on warm tinted cream backgrounds and Tiempos serif fonts), Kanna is designed specifically as an IDE-grade visual wrapper. The interface runs on **vibrant, slate-based dark and light modes** accented by a signature **warm coral brand color** (`--logo` / `@theme inline juicy` / `oklch(71.2% 0.194 13.428)`).

The layout organizes the developer's workspace into a multi-panel resizable structure. It includes a left navigation panel, a center conversational transcript, a bottom-anchored xterm.js terminal drawer, and a collapsible right panel for Git diff management and web previewing.

**Key Characteristics:**
- **Flexible Dark & Light Modes**: Seamless dark and light themes using slate-charcoal and slate-white foundations.
- **Warm Coral Brand Accent**: Coral logo accent (`oklch(71.2% 0.194 13.428)`) used on logo icons, primary active buttons (juicy), and destructive status markers.
- **Branded Typography**: Bricolage Grotesque Variable for wordmark branding, paired with a custom loaded sans-serif "Body" font for UI copy, and Roboto Mono for terminals and code editors.
- **Resizable Multi-Panel Shell**: Uses `react-resizable-panels` to coordinate a flexible desktop layout that collapses gracefully into mobile overlays.
- **Visual Feedback & Micro-animations**: Soft blur-in transitions, typewriter cursor blinking, custom empty-state flower pop-ins, and shiny text indicator animations.

---

## Colors

### Brand & Accent
- **Coral / Logo Accent** (`--logo` — `oklch(71.2% 0.194 13.428)`): The signature Kanna warm coral. Used for the brand flower icon, the `juicy` button variant, destructive actions, and active status/error indicators.
- **Accent Emerald / Connected** (`--chart-2` — `160 60% 45%`): Used for connected socket status dots.
- **Accent Amber / Warning** (`--chart-1` — `24.6 95% 53.1%`): Used for warning and connecting status dots.

### Surface
- **Background** (`--background`): Standard workspace floor. In light mode, pure white (`0 0% 100%`); in dark mode, dark slate-charcoal (`223 4% 13%`).
- **Card** (`--card`): Content blocks and side panel boxes. In light mode, pure white (`0 0% 100%`); in dark mode, charcoal (`231 4% 16%`).
- **Popover** (`--popover`): Dropdown menus and tooltip boxes. In light mode, pure white (`0 0% 100%`); in dark mode, dark slate-charcoal (`223 4% 13%`).
- **Muted** (`--muted`): Panel tabs and inactive tracks. In light mode, light grey (`210 20% 97%`); in dark mode, warm charcoal (`223 4% 18.5%`).
- **Accent** (`--accent`): Hover background color. In light mode, light grey (`240 4.8% 95.9%`); in dark mode, warm charcoal (`240 2% 19%`).
- **Border** (`--border`): Panel divider and grid lines. In light mode, light grey (`214 20% 90%`); in dark mode, medium charcoal (`220 2.5% 23.5%`).
- **Input** (`--input`): Form field outline border. In light mode, light grey (`240 5.9% 90%`); in dark mode, warm charcoal (`240 4% 19%`).

### Text
- **Foreground** (`--foreground`): Primary content text. In light mode, dark slate (`240 10% 3.9%`); in dark mode, off-white (`0 0% 98%`).
- **Muted Foreground** (`--muted-foreground`): Secondary headers, descriptions, and file paths. In light mode, slate grey (`215 16% 47%`); in dark mode, light grey (`240 2.5% 64.9%`).
- **Primary Foreground** (`--primary-foreground`): Text on primary buttons. In light mode, white (`0 0% 98%`); in dark mode, dark slate-charcoal (`240 2% 10%`).

### Semantic
- **Success / Green** (`--chart-2`): Connected socket status, successful task completions, staging checkmarks.
- **Warning / Orange** (`--chart-1`): Connecting socket status, warning alerts.
- **Error / Coral** (`var(--logo)`): Socket disconnection, action failures, code error reports.

---

## Typography

### Font Family
The system utilizes three distinct font families:
- **Bricolage Grotesque Variable** (with fallback `sans-serif`): Used exclusively for the Kanna brand wordmark with font-weight `800` (class `.font-logo`).
- **Body** (with fallback `sans-serif`): Custom loaded font for all UI text, settings controls, chat bubble copy, and navigation labels.
- **Roboto Mono** (with fallback `monospace`): Custom loaded monospace font for xterm terminal drawers, code block views, git diff files, and inline code items.

### Hierarchy

| Token | CSS Class / Property | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `Logo Wordmark` | `.font-logo text-base` or `text-md` | 800 | 1.0 | 0 | Left sidebar branding name |
| `Title Large` | `text-2xl` | 600 (semibold) | 1.0 | -0.5px | Card titles, lock screen headers |
| `Title Medium` | `text-base` or `text-sm` | 500 (medium) | 1.4 | 0 | Chat message headers, file path paths |
| `Body Medium` | `text-sm` | 400 (regular) | 1.55 | 0 | Default running text, conversational logs |
| `Caption` | `text-xs` | 500 / 400 | 1.4 | 0 | Timestamps, secondary descriptions, shortcut tags |
| `Badge Small` | `text-[11px]` | 700 / 600 | 1.0 | 0.5px | DEV labels, git change categories, size labels |
| `Code / Pre` | `font-mono text-sm` | 400 | 1.6 | 0 | Code blocks in transcript |
| `Terminal` | `font-mono text-xs` | 400 | 1.2 | 0 | Live xterm.js shell display |
| `Button Text` | `text-sm` | 500 | 1.0 | 0 | Interactive buttons and tabs |

---

## Layout

### Spacing System
- **Base Unit**: 4px (standard Tailwind spacing system).
- **Common Layout Spacings**: 
  - `p-1` (4px) / `p-2` (8px): Button details, inner icon containers, list items.
  - `p-3` (12px) / `p-4` (16px): Sidebar items, input forms, minor modals.
  - `p-6` (24px): Standard card containers, dialogue bodies.
- **Workspace Panel padding**: The outer frame runs a default margin of `m-2` (8px) on desktop with `rounded-2xl` (16px) corners to host the workspace neatly.

### Panel & Shell Layout (Desktop)
The layout runs a 3-column resizable master layout using `react-resizable-panels`:
1. **Left Sidebar Panel**: Pinned sidebar for projects and settings.
   - Draggable width limits: Min `220px` to Max `520px` (Default `275px`).
2. **Center Panel (Chat & Terminal)**: Vertical resizable panel group.
   - Top part: `ChatTranscriptViewport`.
   - Bottom part: `TerminalWorkspaceShell`.
3. **Right Sidebar Panel (Git / Browser)**: Collapsible sidebar for secondary actions.
   - Drag boundaries: Min `20%` to Max `80%` of viewport width.

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| **Flat** | Transparent background, border-0 | Chat navbar background, layout roots |
| **Soft Border** | 1px `var(--border)` border line | Divider rulers, panel frames, list borders |
| **Workspace Card** | `bg-card` surface | Settings pages, project list containers |
| **Contrast Card** | `bg-background` inside `bg-card` | Message file attachment cards, diff files list |
| **Floating Popover** | `bg-popover border border-border shadow-md` | Dialog overlays, context menus, tooltips |
| **Backdrop Blur** | `bg-background/85 backdrop-blur-md border` | Hover buttons, file attachment preview chips, hotkey tooltips |

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4px | Inline small buttons, checklist checkboxes |
| `rounded-[4px]` | 4px | Segmented control active tab items |
| `rounded-md` | 6px | Action icons, settings input forms, tooltips |
| `rounded-lg` | 8px | Diff file cards, segmented control wrappers, context menu items |
| `rounded-xl` | 12px | Sidebar elements, file attachment chips, dialogs, popovers |
| `rounded-2xl` | 16px | Workspace panel container, outer panel layouts |
| `rounded-full` | 9999px | Standard action buttons (`Button`), pill badges |

---

## Components

### Card Primitives

#### `ProjectCard`
- **Selector/Class**: `.border-border bg-card hover:bg-muted/50 rounded-lg px-4 py-3 border`
- **Description**: Displays local directories added as projects in the `LocalProjectsPage` dashboard. Has a hover border transition (`hover:border-primary/30`) and a layout layout with action folders.

#### `InfoCard`
- **Selector/Class**: `.bg-card border border-border rounded-2xl p-4`
- **Description**: A wrapper layout card containing workspace info fields, project descriptions, and settings metadata.

#### `DiffFileCard`
- **Selector/Class**: `.rounded-lg border border-border bg-background`
- **Description**: Rendered inside the Git panel. Hosts an individual changed file, displaying its path, change type (modified, untracked, deleted), staging checkboxes, and collapsible diff patches.

#### `AttachmentImageCard`
- **Selector/Class**: `.rounded-xl border border-border/80 bg-background/85 shadow-sm backdrop-blur-md`
- **Description**: Thumbnail representation of image files attached to the chat composer or diff lists. Shows a gradient overlay (`from-black/75 to-transparent`) and text descriptions upon hover.

#### `AttachmentFileCard`
- **Selector/Class**: `.rounded-xl border border-border bg-background/85 p-1 pr-3`
- **Description**: Inline representation of non-image files (PDFs, JSON, CSVs) attached to prompts. Features file-specific icon tags based on file extension.

---

### Inputs & Forms

- **`Input`**: Standard text input field. Classes: `flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none`. Features placeholder styling and disabled states (`disabled:cursor-not-allowed disabled:opacity-50`).
- **`Textarea`**: Standard multi-line input field. Shares similar styles with `Input` but adjusts padding to `px-2.5 py-2`.

---

### Modals & Overlays (Z-Index: 50)

- **`DialogOverlay`**: Fixed full-screen backdrop using `bg-black/50` with fade-in animations (`data-[state=open]:animate-in fade-in-0`).
- **`DialogContent`**: Centered modal container using `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl`. Includes zoom and slide animations (`zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]`). Sizes range from `sm` (`max-w-sm`) to `lg` (`max-w-lg`).
- **`DialogHeader` / `DialogFooter`**: Header includes `border-b border-border p-4`. Footer includes `border-t border-border bg-background p-2 rounded-b-xl`.

---

### Context Menus & Popovers

- **`ContextMenuContent` / `PopoverContent`**: Floating context layers positioned at `z-50`. Uses `rounded-xl border border-border bg-background shadow-lg` with fade and zoom animations. Context menus use tight padding (`p-1`), while Popovers use standard padding (`p-4`).
- **`ContextMenuItem`**: Interactive menu rows using `rounded-lg px-3 py-2 text-xs font-medium`.

---

### Tabs & Filters

- **`SegmentedControl`**: Inline tab switcher. The container uses `inline-flex items-center rounded-lg border border-border p-[3px]`. Active tabs use `bg-white dark:bg-muted border-slate-300 dark:border-white/10`. Inactive tabs remain transparent.

---

### Tooltips & Hotkeys

- **`TooltipContent`**: Basic hover labels using `rounded-md bg-card text-card-foreground border border-border px-3 py-1.5 text-xs`.
- **`HotkeyTooltipContent`**: Specialized tooltip for displaying keyboard shortcuts, adding a blur effect (`backdrop-blur-md`) and tighter padding (`p-0.5 text-[11px]`).
- **`Kbd`**: Keyboard shortcut visual indicators using `rounded border border-border/60 bg-muted/50 px-1.5 font-mono text-[11px] font-medium`.

---

### Workspace Shell Components

#### `KannaSidebar` (Left Sidebar)
- Hosts the flower logo, brand name, "New project" button, project directories, session history, and Settings buttons.
- Features hotkey numbers overlays that display on hover/hold modifiers to support rapid keyboard navigation.

#### `ChatNavbar` (Top Toolbar)
- Displays active file paths, connection alerts, git branch tags, and panel controls (Terminal toggle, Git sidebar toggle, Browser toggle).

#### `ChatTranscriptViewport` (Center Chat Area)
- Lists conversational chat balloons. Contains the custom empty-state flower and typing indicators.

#### `ChatInputDock` (Composer)
- Positioned floating at the bottom center. Holds the textarea input field, file upload arrays, active provider selection list, and cancel actions.

#### `TerminalWorkspaceShell` (Terminal Pane)
- Embedded xterm.js instance terminal. Implements a customized layout theme with transparent backgrounds to prevent color mismatch.

#### `GitPanel` (Right Sidebar)
- Incorporates code version management: Unified and Split code diffs (`@pierre/diffs/react`), commit inputs, AI commit message generators, and remote fetch/pull/push options.

---

## Transitions & Animations

Kanna uses Tailwind animations to provide responsive, high-fidelity feedback:

1. **Terminal & Sidebar Toggles**: Slides drawers open/closed with transitions mapping `opacity` (`0` to `1`) and `filter` (`blur(5px)` to `blur(0)`) using a `350ms` cubic-bezier timing.
2. **Empty State Flower Pop-in**: Flower icon triggers a custom pop-in effect (`kanna-empty-state-flower-in` keyframes) on layout load, scaling from `0.1` to `1` with blur clearing.
3. **Empty State Text Blur**: Conversational empty states fade and clear blur values (`kanna-empty-state-text-in` keyframes) to reveal headings.
4. **Typewriter Cursor Blinking**: Typwriter block cursor (`.kanna-typewriter-cursor`) blinks iteratively (`kanna-cursor-blink`) and fades out (`kanna-cursor-fade-out`) on typing completion.
5. **Shiny Text Gradient**: A sweeping gradient effect (`animate-shiny-text`) highlights active AI thought tasks.
6. **Slow Spin**: `animate-spin-slow` (1.5s linear) for background loading icons.

---

## Do's and Don'ts

### Do
- Always use variables (`hsl(var(--background))`, `var(--color-border)`, etc.) instead of hardcoded hex values to support dark/light mode seamlessly.
- Enforce the rounded-full standard for standalone buttons to keep the friendly, bubbly action-state aesthetic.
- Wrap diff details and terminal workspaces in `"Roboto Mono"` to maintain layout alignment.
- Allow components to resize dynamically within the panel system; preserve mobile drawer overlay overrides.

### Don't
- Do not introduce custom canvas/surface shades outside the main HSL background variables.
- Do not bypass the resizable-panel boundaries by absolute positioning panels over the workspace (except on mobile hamburger drawer limits).
- Avoid mixing Copernicus serif typography from legacy marketing pages; Kanna strictly uses Bricolage Grotesque for brand labels and custom sans-serif for UI copy.

---

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| **Mobile** | `< 768px` | Left sidebar hides behind a hamburger overlay; right sidebar transforms into a full-height overlay; workspace margin narrows |
| **Tablet** | `768px - 1024px` | Standard panel layouts; right sidebar width locks to a smaller default ratio |
| **Desktop** | `> 1024px` | Full multi-panel horizontal/vertical resizing; layout margins set to `m-2` |

### Touch Targets
- Action button tags maintain a minimum height of `h-9` (`36px`) or `h-10` (`40px`).
- Input forms and textareas set a minimum font-size of `16px` to prevent automatic iOS zoom-in behaviors.
- Close overlays and header buttons provide responsive click targets with padding extensions.

### Collapsing Strategy
- Mobile triggers toggle side drawers via slide-out transitions rather than hiding elements immediately.
- Code blocks inside transcripts do not wrap code lines. Instead, they maintain code legibility through horizontal scroll boundaries.

---

## Known Gaps

- **Font Licensing**: Bricolage Grotesque and the custom Body typography are loaded locally; ensure font files exist in the `/fonts` distribution folder.
- **Terminal Rendering bounds**: Headless terminal operations and xterm window layouts require dynamic size refreshes on panel resizing.
