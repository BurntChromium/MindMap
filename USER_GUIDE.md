# Mindmap User Guide

Mindmap is a Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

## Major UI Pieces

- Left panel: browse, create, rename, switch, and delete canvases.
- Center canvas: create nodes, connect them with edges, drag them around, and edit node content.
    - Node cards: compact, view, and edit states, with lock/unlock behavior to prevent accidental edits.
- Right panel: search by keyword, filter by tag, inspect selected nodes, and apply bulk tag edits.

### Quick Guide

When you first download the app:
1. Create a new canvas in the left-hand panel.
2. Create a new node (use the button or press `n`)
3. Give the node a title, maybe a tag or two, and some text for the body. (Very limited Markdown features are supported.)
    - You can apply **bold** text with asterisks like `**this**`
    - You can apply _italic_ text with underscores like `_this_`
    - You can create a hyperlink with brackets and parens like this: `[text to show](http://your-address-here.whatever)`
    - You can mention an entity with double-brackets like `[[this]]`
    - _Be aware that your styling won't be visible until you use `view` mode! In edit mode, you'll see the raw text._

Notes are always in one of three states or modes: `preview` mode (small), `view` mode (read with formatting applied), and `edit` mode (make changes).

Entities are an important concept for linking ideas. Entities are people, places, things, objects, or whatever you want! You can optionally designate individual notes as Entity notes to make them easier to find. Whenever you reference an entity, Mindmap will link those mentions via dashed lines (even if no "root" Entity card exists.)

You can search via free text, tags, or entities from the right-hand panel.

## Keyboard Commands

### Current

- `N`: create a new node
- `C`: toggle the left canvas panel
- `F`: toggle the right search panel
- `-`: zoom out
- `=`: zoom in
- `E`: begin editing the currently selected node when exactly one node is selected
- `V`: toggle the currently selected node between compact and view mode when exactly one node is selected and it is not being edited
- `Tab` in edit mode: move through the node's editable fields
- `Backspace` or `Delete`: delete the current selection
- `Cmd/Ctrl+A`: select all nodes on the active canvas
- `Cmd/Ctrl+C`: copy the current selection
- `Cmd/Ctrl+X`: cut the current selection
- `Cmd/Ctrl+V`: paste the copied fragment
- `w` in edit mode: focus the title field for the current node
- `Cmd/Ctrl+Z`: undo the last canvas mutation
- `Cmd/Ctrl+Shift+Z`: redo the last undone canvas mutation
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
- `Esc`: contextually escape current action: clear selection, prompt to discard node edits, close the quick search bar, or exit tag editing
- `Y` / `N`: confirm or cancel the discard prompt when editing a node
- `Space`: toggle the focused node in or out of the current selection
- `Tab`: cycle focus through visible nodes or search results

Keyboard shortcuts are disabled while typing in text inputs, textareas, selects, and other editable fields.

Note: `w` is the temporary workaround for jumping to the title field from edit mode until the edit-entry focus path is made reliable again.
