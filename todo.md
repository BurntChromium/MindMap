# Mindmap Todo

This file is organized to keep the shared context small between work chunks.
Each stage should be treated as a natural stop point: finish the stage, verify it, then start a fresh task for the next stage.

## Coding Tips

- Confirm the current app behavior for the area being changed.
- Read the relevant tests and existing patterns before editing.
- Keep changes scoped to the stage only.
- Preserve unrelated user work.
- After code changes, run `npm run check` and `npm test`.

## Stage 0: A Settings Panel (DONE)

We're adding a lot of features that would cram the single-panel UI. Similar to how the right hand panel is tabbed, we should make the left-hand panel tabbed.
- Canvas tab
- Database tab (move all the database configuration and buttons in here)

Stage 0 is to set up this tab UI and move the appropriate buttons and interfaces into it so that we can expand on it later.

## Stage 1: Data safety and recovery (DONE)

Goal: make the desktop app hard to lose data with, and easy to recover when something goes wrong.

- [x] Add automatic backup snapshots for the SQLite database.
    - [x] Add a setting to specify a folder to use for snapshots - can use the same UI flow as we do for the database path
- [x] Add a restore flow for the most recent backup.
- [x] Add a visible recovery action in the desktop UI.
- [x] Clarify what happens on import, export, and rename failures.
- [x] Add tests for successful backup/restore and failure recovery.

Why this stage matters:
- This is the highest-value desktop-app work because the app is a local note store and data loss is the worst failure mode.
- It directly builds on the existing SQLite import/export and file-renaming support.

Context boundary:
- Keep the database file layout, import/export flow, and recovery behavior in context.
- After this stage, clear the implementation details and start a new task for search.

## Stage 2: Search and retrieval quality (DONE)

Goal: make finding notes fast and reliable as notebooks grow.

- [x] ~~Replace substring search with a ranked SQLite-backed search approach.~~ Use a ranked local-first search provider with a shared core and backend adapter.
- [x] Add better result ranking for titles, bodies, and tags.
- [x] Make search feel responsive on larger notebooks.
- [x] Add tests for ranking and tag-filter combinations.

Why this stage matters:
- Search is one of the primary daily-value loops in a notes app.
- The current search path is functional but simple, so it is a strong candidate for a focused upgrade.

Context boundary:
- Keep only the search schema, query code, and related tests in context.
- After this stage, clear search implementation details before starting editor work.

## Stage 2.5: Visual Semantics Tweak

Right now we use dashed lines to represent all associative edges (mentioning an entity). We should split that up: a "direct" mention (this note body references another entity which exists as its own note -- `is_entity` is True) uses the dashed edge. Two notes that simply both mention the same entity get a dotted line instead. 

Suppose we have Smaug, Dragon, and Shire nodes. Smaug is an entity node. If Dragon mentions `[[Smaug]]` then we draw a dashed line between dragon and smaug. If both Smaug and Dragon mention the `[[Shire]]` then there's a dotted line between them.

- [ ] Visual distinction between types of entity references

## Stage 3: Capture and edit workflow

Goal: reduce friction when users create and refine notes.

- [ ] Remove temporary editing workarounds and tighten the edit state model.
- [ ] Make node creation faster from keyboard and mouse.
- [ ] Reduce mode-switching overhead between preview, view, and edit states.
- [ ] Improve first-run guidance for creating a notebook and capturing a first note.
- [ ] Add tests for the edit flow and keyboard interactions that matter most.

Why this stage matters:
- A note app wins when capture feels effortless.
- The current docs already hint that the edit workflow still has rough edges.

Context boundary:
- Keep the editing interaction model, keyboard shortcuts, and node state code in context.
- After this stage, clear the UI details and start a desktop-ergonomics task.

## Stage 4: Desktop ergonomics

Goal: make the app feel like a first-class desktop file-based tool.

- [ ] Add an "open data folder" action.
- [ ] Add a "copy database path" action.
- [ ] Improve database-file conflict messages and validation feedback.
- [ ] Add a simple recent-databases or last-opened hint if useful.
- [ ] Add tests for the file-path handling and conflict cases.

Why this stage matters:
- Desktop users think in files, folders, and recovery paths.
- This app already stores its data locally, so these affordances fit the product.

Context boundary:
- Keep the file-path and database-settings behavior in context.
- After this stage, clear the desktop-ergonomics details before any release work.

## Stage 5: Productionization and release polish

Goal: make the desktop app easier to ship and safer to upgrade.

- [ ] Improve startup resilience and error reporting.
- [ ] Verify release steps and packaging assumptions.
- [ ] Check for crashes or data issues in the Tauri path.
- [ ] Add tests or smoke checks for the release-sensitive paths.
- [ ] Update release notes or the user guide where behavior changed.

Why this stage matters:
- For a local-first desktop app, productionization means fewer surprises and fewer support burdens.
- This is lower priority than data safety and search, but it matters once the core UX is stable.

Context boundary:
- Keep release flow and runtime stability in context only when working this stage.
- Otherwise, start fresh with the narrower feature area you are changing.

## Suggested Execution Order

1. Stage 1: Data safety and recovery
2. Stage 2: Search and retrieval quality
3. Stage 3: Capture and edit workflow
4. Stage 4: Desktop ergonomics
5. Stage 5: Productionization and release polish
