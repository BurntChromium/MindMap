# Performance Checklist

This checklist tracks the practical work needed to make the app feel faster under normal use.

## Done So Far

- [x] Cache the active canvas state in the client so switching back to a canvas restores nodes and edges immediately.
- [x] Keep per-canvas snapshots in memory for the current session.
- [x] Revalidate cached canvas data in the background after rendering from cache.
- [x] Use optimistic UI updates for writes where the local state already knows the intended result.
- [x] Filter search results against the active canvas nodes already in memory.
- [x] Remove the `/api/search` round-trip for normal keyword and tag filtering on the current canvas.

## 1. Avoid Unnecessary DB Trips

- [ ] Keep the server search route only if we add global or cross-canvas search later.

## 2. Make Discovery Local First

- [ ] Measure search latency after the client-side filter lands.

## 3. Add the Right Database Indexes

- [ ] Add an index on `node_tags(tag_id)` if query plans show it helps.
- [ ] Revisit whether SQLite FTS5 is worth it for title/body search if the data set grows.
- [ ] Prefer query-plan-driven indexes over blanket additions.

## 4. Reduce Render Churn

- [ ] Measure how much time is spent rebuilding flow node data in the graph adapter.
- [ ] Avoid recomputing derived node data more often than needed.
- [ ] Look for opportunities to update only the changed nodes instead of remapping the whole canvas.
- [ ] Profile XYFlow rendering cost on larger canvases.

## 5. Keep Mutations Feeling Instant

- [ ] Verify rollback behavior only where a failed write would leave the UI inconsistent.

## 6. Verify With Measurements

- [ ] Capture a baseline for canvas load time.
- [ ] Capture a baseline for search/filter latency on the active canvas.
- [ ] Capture a baseline for large-canvas drag performance.
- [ ] Re-run the same measurements after each optimization.

## Notes

- Generic backend caching is not the first thing to reach for here.
- The biggest gains so far have come from client-side caching, local filtering, optimistic updates, and a few well-placed indexes.
- If the app grows beyond the current single-user workflow, search and cache strategy should be revisited with that shape in mind.
