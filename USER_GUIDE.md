# Mindmap User Guide

Mindmap is a Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

## Major UI Pieces

- Left panel: browse, create, rename, switch, and delete canvases.
- Center canvas: create nodes, connect them with edges, drag them around, and edit node content.
- Right panel: search by keyword, filter by tag, inspect selected nodes, and apply bulk tag edits.
- Node cards: compact, view, and edit states, with lock/unlock behavior to prevent accidental edits.

## Keyboard Commands

### Current

- `N`: create a new node
- `C`: toggle the left canvas panel
- `F`: toggle the right search panel
- `Backspace` or `Delete`: delete the current selection
- `Cmd/Ctrl+A`: select all nodes on the active canvas
- `Cmd/Ctrl+C`: copy the current selection
- `Cmd/Ctrl+X`: cut the current selection
- `Cmd/Ctrl+V`: paste the copied fragment
- `Cmd/Ctrl+D`: duplicate the current selection
- `Cmd/Ctrl+Shift+D`: duplicate the selected subtree
- `/`: open the quick search bar on the canvas
- `Arrow keys`: move the selected node or nodes around the canvas
- `Shift + Arrow`: move the selected node or nodes by a larger step
- `h/j/k/l`: move the view around the canvas
- `Alt/Option + Arrow`: jump focus to the nearest node in that direction
- `Shift + Alt/Option + Arrow`: jump focus and add the jumped-to node to the selection
- `Alt/Option + h/j/k/l`: optional Vim-style alias for jump focus
- `t`: open or focus tag editing for the current selection
- `Esc`: clear selection, close the quick search bar, or exit tag editing
- `Space`: toggle the focused node in or out of the current selection
- `Tab`: cycle focus through visible nodes or search results

Keyboard shortcuts are disabled while typing in text inputs, textareas, selects, and other editable fields.
