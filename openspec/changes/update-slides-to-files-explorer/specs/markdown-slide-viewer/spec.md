## ADDED Requirements
### Requirement: Multiple File Tabs
The system SHALL support opening multiple files simultaneously in a tabbed interface within the file explorer panel.

#### Scenario: Open file in a new tab
- **WHEN** the user selects a file from the tree view that is not currently open
- **THEN** the system SHALL open the file in a new tab and make it the active tab.

#### Scenario: Switch active tab
- **WHEN** the user clicks on an open tab in the tab bar
- **THEN** the system SHALL render the content of that tab's file.

#### Scenario: Close tab
- **WHEN** the user clicks the close icon on an open tab
- **THEN** the system SHALL remove the tab from the tab bar and select another open tab if available.

## MODIFIED Requirements
### Requirement: File Explorer Panel Toggling
The system SHALL allow users to toggle the Files and Markdown Viewer panel from Kanna's chat navigation header.

#### Scenario: Open files viewer panel
- **WHEN** the user clicks the files icon in the chat navigation header
- **THEN** the right sidebar panel SHALL expand and display the files and markdown viewer.

#### Scenario: Close files viewer panel
- **WHEN** the user clicks the close button in the files viewer sidebar or clicks the files icon while the viewer is active
- **THEN** the right sidebar panel SHALL collapse or toggle back to its previous state.

### Requirement: Project File Tree View Navigation
The system SHALL display all project files in a hierarchical tree view component, allowing users to collapse or expand folders, view file icons, and select a file to preview. The tree view panel itself SHALL support collapsing.

#### Scenario: Expand and collapse directories in Tree View
- **WHEN** the user clicks on a directory node in the project file tree
- **THEN** the system SHALL toggle its expansion state, showing or hiding its child elements.

#### Scenario: Select file to preview
- **WHEN** the user clicks on a file node in the project file tree
- **THEN** the system SHALL request the file content from the server and open it in a tab inside the file viewer.

#### Scenario: Collapse Tree View Panel
- **WHEN** the user drags the tree view panel resizable handle to minimum width or clicks the collapse button
- **THEN** the tree view panel SHALL collapse, maximizing the file preview area.
