# Mind Map Production Roadmap

This document tracks the path from a working MVP to a production-ready tool. It is organized by user benefit first, then by the plumbing work needed to support those features without painting us into a corner.

## Current Baseline

Already in place:

- canvases, nodes, edges, and SQLite persistence
- node drag/drop and edge creation/deletion
- locked/unlocked node editing
- title and body editing
- node tags with create, remove, display, and persistence

This means the next work is about making the app easier to navigate, faster to use at scale, and more durable.

## Stage 1: UX Tweaks (Done)

- Make tags visible in the compact mode (the default, unexpanded state)
- We have 3 states: compact, view, and edit. Let's be sure that this is reflected in the code and our assumptions/documentation. 
- Compact means the default node card with title plus tags.
- View means the expanded read-only node card.
- Edit means the expanded editor state with mutable title, body, and tags.

## Stage 2: Find Things Quickly (Done)

User benefit:

- locate a node by keyword or tag instead of scanning the whole graph
- cut across edges and graph structure when looking for ideas
- use the map as an information space, not just a drawing board

Feature work:

- Tags get colors auto-assigned (e.g. all uses of `#lore` get the same color)
    - Pastel palette
- right-hand search and filter panel
- tag-based filtering and highlighting
    - Click on a tag to mark all nodes with that tag (probably apply that tag's color to the relevant nodes' background, but with a high transparency to avoid being too flashy). Click the tag again to remove the coloration.
- keyword search across title and body
- saved or repeatable filters later if needed

Plumbing to support it:

- add query helpers for nodes, tags, and node-tag joins
- keep search predicates server-safe and reusable
- index the data shapes we will filter on most often
- separate transient filter state from persisted content

## Stage 3: Edit at Scale

User benefit:

- change multiple nodes without repetitive manual edits
- keep tags and metadata consistent across related ideas
- move from single-node editing to project-level editing

Feature work:

- multi-select (shift click)
- bulk add/remove tags
- copy, cut, and paste nodes
- duplicate node and subtree actions where they make sense
- keyboard-driven selection and batch operations

Plumbing to support it:

- selection store or equivalent shared selection model
- batch persistence endpoints or transactional write helpers
- undo-friendly mutation shapes
- clearer ownership of optimistic updates versus committed state

## Stage 4: Make the Data Portable

User benefit:

- back up a project
- move a project between environments
- recover from mistakes without relying on a browser session

Feature work:

- import/export
- portable snapshot format for canvases, nodes, edges, and tags
- optional CSV or JSON export depending on the use case

Plumbing to support it:

- schema versioning for exported data
- import validation and conflict handling
- explicit migration path for stored snapshots
- consistent IDs or remapping rules during import

## Stage 5: Make the Editor Trustworthy

User benefit:

- fewer accidental data losses
- predictable saves
- confidence using the tool for real projects

Feature work:

- undo/redo
- clearer save indicators when writes are in flight or failed
    - A simple "synced" badge in the canvas could solve this (or "syncing", "synced", "failed" or whatever)
- stronger keyboard shortcuts
- better empty, loading, and error states

Plumbing to support it:

- a mutation log or action history
- shared validation for client and server payloads
- API response consistency across CRUD endpoints
- tests for stores, adapters, and server routes

## Stage 6: Make It Fast Enough

User benefit:

- usable on larger maps without stutter
- stable interaction even with many nodes
- lower cost of search, filtering, and batch updates

Feature work:

- graph performance tuning
- lazy rendering or virtualization where it matters
- cheaper search/filter updates
- reduced re-renders in heavy editing sessions

Plumbing to support it:

- derived indexes for common lookups
- less store churn during drag and batch edits
- profiling hooks for bottlenecks
- load testing against larger datasets

## Notes

- Tags are already implemented at the node level, but tag management as a first-class system still needs search, filtering, and bulk editing before it feels complete.
- The current editing model is explicit save on check, which is a good base for productionization because it gives us clearer mutation boundaries.
- Rich text, references, and collaboration remain later-stage features and should be added only after the navigation and data-handling path is solid.
