I want to design a tool for mind mapping (a DnD campaign, novel, or video game story). I've tried the common tools out there, none have what I want. I have some local AI agents who can take on small clean up work, but I need a powerful LLM like you to get started. 

Concept: an infinitely scalable canvas (or something reasonably large, haha) where you can have "nodes" for ideas, and draw connections between them. Nodes can be expanded into simple documents (a few paragraphs worth of text usually)

## User Stories/UX (eventual future state)

### Core Layout
- Large central canvas where you can create, edit, and link nodes together (few buttons: just a "+" for new nodes, an export button to convert your DB to a portable format like CSV, and an import button)
- Collapsible left panel for browsing or creating new projects (canvases)
- Collapsible right panel for doing meta-interactions: keyword searching through nodes, maybe an "SQL query" style interface, mass editing of properties nodes (like multi-select/shift-click)

### Imagined Interactions
- Nodes have titles. These are what you see by default when you're not "focusing" on a node.
- Nodes have tags (#NPC) and can be color-coded with pale, pastel colors (that should have low alpha). Tags can have their own color-coding (more vibrant colors, higher alpha)
- Nodes have bodies, which support very basic text editing. Bold, italics, hyperlinks, and "references" (if I do something like Keyword(Smaug) it makes it so I can click on "Smaug" and jump to that node -- important that we don't have to have a custom text markup here, very open to ideas on how to implement)
- I can expand/collapse nodes to show or hide their content. However, we have to click to edit (maybe a "lock/unlock" emblem) to avoid accidental edits.

Right panel stuff:
- Basic keyword search, node "hits" get outlined in an obvious color
- Advanced queries (mix of keywords, tags, and so on)
- Find-and-replace (rename "Smaug" to "Angry Lizard")
- Multi-select (shift-click) to apply search, find/replace, etc. only to certain nodes. Also allows for adding or removing tags to all selected nodes.
- Keyboard shortcuts (ctrl-a to select everything, ctrl-c, ctrl-x, and ctrl-v for copy, cut, paste, etc.)
