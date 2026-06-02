# Capability: Markdown Slide Viewer

## Purpose
This capability defines the markdown and slide preview surface used by Kanna to inspect project markdown files, render Marp-style slide decks, and navigate project markdown content from a tree view.

## Requirements
### Requirement: Slide and Markdown Viewer Panel Toggling
The system SHALL allow users to toggle the Slide and Markdown Viewer panel from Kanna's chat navigation header.

#### Scenario: Open slide viewer panel
- **WHEN** the user clicks the slide icon in the chat navigation header
- **THEN** the right sidebar panel SHALL expand and display the slide and markdown viewer.

#### Scenario: Close slide viewer panel
- **WHEN** the user clicks the close button in the slide viewer sidebar or clicks the slide icon while the viewer is active
- **THEN** the right sidebar panel SHALL collapse or toggle back to its previous state.

### Requirement: Rendering Markdown Documents
The system SHALL parse and render the currently selected markdown file or attachment using standard markdown conventions, including syntax highlighting for code blocks and zoomable image view overlays.

#### Scenario: Render raw markdown with code blocks
- **WHEN** a standard markdown file is active and the viewer is in document mode
- **THEN** the system SHALL render formatted headings, lists, tables, and code blocks with syntax highlighting.

#### Scenario: Render interactive images
- **WHEN** the user clicks an image inside the rendered markdown document
- **THEN** the system SHALL open a zoomable modal overlay allowing the user to view the image in high detail.

### Requirement: Slide Presentation Mode
The system SHALL support presenting Marp slides by parsing horizontal rules (`---`) as slide boundaries and providing navigation controls to navigate between individual slides.

#### Scenario: Navigate through slide deck
- **WHEN** the user opens a markdown file containing Marp slide directives and horizontal rules
- **THEN** the system SHALL render the active slide in full-width slide aspect ratio and show page index navigation controls.

### Requirement: Theme and Layout Adjustments
The system SHALL allow users to adjust slide theme, aspect ratio, text scale, and light/dark appearance mode from a settings menu.

#### Scenario: Toggle presentation aspect ratio
- **WHEN** the user changes the aspect ratio setting to 4:3
- **THEN** the active slide presentation container SHALL resize to a 4:3 aspect ratio.

#### Scenario: Switch slide theme
- **WHEN** the user selects the "gaia" theme in the viewer theme selector
- **THEN** the system SHALL style the slides with the gaia layout and color presets.

#### Scenario: Adjust text scale
- **WHEN** the user changes the text scale setting to 120%
- **THEN** the font size of the slide content SHALL scale proportionally.

### Requirement: Project File Tree View Navigation
The system SHALL display all project markdown files in a hierarchical tree view component, allowing users to collapse or expand folders, view file icons, and select a file to preview.

#### Scenario: Expand and collapse directories in Tree View
- **WHEN** the user clicks on a directory node in the project file tree
- **THEN** the system SHALL toggle its expansion state, showing or hiding its child elements.

#### Scenario: Select file to preview
- **WHEN** the user clicks on a markdown file node in the project file tree
- **THEN** the system SHALL request the file content from the server and render the file in the slide/document viewer area.
