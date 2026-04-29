# Mind Mapping Tool – Design Document (MVP)

## 1. Purpose

A graph-based creative tool for organizing ideas (DnD campaigns, novels, game narratives) using nodes and connections on a large canvas. Nodes support lightweight text content and tagging.

This document defines the MVP architecture, constraints, and implementation checklist.

---

## 2. Core Principles

* Single TypeScript stack (client + server)
* Thin backend, logic-heavy frontend
* Fast iteration over completeness
* Graph-first data model
* Minimal UI friction

---

## 3. Tech Stack

### Frontend

* SvelteKit (TypeScript)
* Xyflow (`@xyflow/svelte`)

### Backend

* SvelteKit server routes (`+server.ts`)
* SQLite via `better-sqlite3`

### Tooling

* npm
* ESLint + Prettier
* Vitest (testing)

---

## 4. High-Level Architecture

### Client Responsibilities

* UI rendering
* Graph state (nodes, edges)
* Node editing
* Tag handling
* Optimistic updates
* Debounced persistence

### Server Responsibilities

* Data persistence (SQLite)
* Basic validation
* CRUD endpoints

---

## 5. Data Model

### Canvas

* id
* name
* createdAt
* updatedAt

### Node

* id
* canvasId
* title
* body
* x, y (position)
* collapsed (boolean)
* color (optional)
* createdAt
* updatedAt

### Edge

* id
* canvasId
* sourceNodeId
* targetNodeId

### Tag

* id
* name (unique)
* color

### NodeTag (join)

* nodeId
* tagId

---

## 6. Database Schema (SQLite)

* canvases
* nodes
* edges
* tags
* node_tags

(Defined in implementation phase)

---

## 7. Frontend Structure

```
/src
  /lib
    /stores
      canvasStore.ts
      nodeStore.ts
      selectionStore.ts
    /graph
      graphAdapter.ts
    /editor
      nodeEditor.ts
  /routes
    +page.svelte
    /api
      /canvases
      /nodes
      /edges
      /tags
```

---

## 8. State Management

Use Svelte stores.

### canvasStore

* list of canvases
* active canvas

### nodeStore

* nodes (Map)
* edges
* derived Xyflow graph

### selectionStore

* selected node IDs
* multi-select behavior

---

## 9. Data Flow

### Initial Load

1. Fetch canvases
2. Select active canvas
3. Fetch nodes + edges + tags

### Persistence Strategy

#### Immediate Writes

* create/delete node
* create/delete edge

#### Debounced Writes (300–800ms)

* node movement
* title edits
* body edits
* tag updates

---

## 10. Node Editing Model

### Interaction Modes

* Default: read-only
* Edit mode:

  * double-click OR unlock icon

### Text Editing

* `contenteditable`
* Support:

  * bold
  * italics

### Internal References

* Syntax: `[[Node Title]]`
* Parsed via regex
* Click navigates to target node

---

## 11. Graph Integration (Xyflow)

Adapter layer converts:

* internal Node → FlowNode
* internal Edge → FlowEdge

Custom node component:

* title
* tags
* expandable body

---

## 12. API Design

### Canvases

* GET /api/canvases
* POST /api/canvases
* DELETE /api/canvases/:id

### Nodes

* GET /api/nodes?canvasId=
* POST /api/nodes
* PATCH /api/nodes/:id
* DELETE /api/nodes/:id

### Edges

* POST /api/edges
* DELETE /api/edges/:id

### Tags

* GET /api/tags
* POST /api/tags

---

## 13. Persistence Model

* Client is source of truth during session
* Server stores snapshots
* No conflict resolution (single-user assumption)

---

## 14. Testing Strategy (MVP)

### Unit Tests

* store logic
* graph transformations

### Integration Tests

* API endpoints

Tool: Vitest

---

## 15. MVP Feature Checklist

### Project Setup

* [x] Initialize SvelteKit project
* [x] Install dependencies
* [ ] Configure linting/formatting

---

### Database

* [x] Create SQLite schema
* [x] Initialize DB connection module

---

### Backend API

* [x] Canvases endpoints (create/list is defined)
* [ ] Nodes endpoints (create is defined, at least)
* [ ] Edges endpoints
* [ ] Tags endpoints

---

### Canvas (UI)

* [ ] Render Xyflow canvas
* [ ] Add "+" node creation button
* [ ] Implement node positioning

---

### Nodes

* [ ] Create node
* [ ] Delete node
* [ ] Edit title
* [ ] Edit body
* [ ] Expand/collapse node

---

### Edges

* [ ] Connect nodes
* [ ] Delete edges

---

### Tags

* [ ] Add tags to node
* [ ] Remove tags
* [ ] Store tag relationships

---

### Persistence

* [ ] Fetch initial data
* [ ] Save node changes (debounced)
* [ ] Save edges (immediate)

---

### Left Panel

* [ ] List canvases
* [ ] Create canvas
* [ ] Delete canvas
* [ ] Switch canvas

---

### UX Basics

* [ ] Prevent accidental edits (lock/edit mode)
* [ ] Basic keyboard delete
* [ ] Node selection

---

## 16. Known Deferrals (Post-MVP)

* Right panel (search, queries)
* Import/export
* Advanced text editor
* Multi-select editing
* Tag color management UI
* Performance optimization for large graphs
* Collaboration / multi-user support

---

## 17. Open Questions

* Should node titles be unique within a canvas? (affects reference linking)
* How strict should tag normalization be?
* Do we allow orphan tags?
* Should references auto-create missing nodes?
