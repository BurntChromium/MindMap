# Mindmap

A Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

## Usage

### Major UI Pieces

- Left panel: browse, create, rename, switch, and delete canvases.
- Center canvas: create nodes, connect them with edges, drag them around, and edit node content.
- Right panel: search by keyword, filter by tag, inspect selected nodes, and apply bulk tag edits.

### Keyboard Commands

- `N`: create a new node
- `C`: toggle the left canvas panel
- `F`: toggle the right search panel
- `Cmd/Ctrl+A`: select all nodes on the active canvas
- `Cmd/Ctrl+C`: copy the current selection
- `Cmd/Ctrl+X`: cut the current selection
- `Cmd/Ctrl+V`: paste the copied fragment
- `Cmd/Ctrl+D`: duplicate the current selection
- `Cmd/Ctrl+Shift+D`: duplicate the selected subtree

Keyboard shortcuts are disabled while typing in text inputs, textareas, and other editable fields.
