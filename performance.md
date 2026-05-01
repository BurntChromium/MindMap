# Performance Checklist

This checklist tracks the practical work needed to make the app feel faster under normal use.

## 1. Avoid Unnecessary DB Trips

- [ ] Cache the active canvas state in the client so switching back to a canvas restores nodes and edges immediately.
- [ ] Keep per-canvas snapshots in memory for the current session.
- [ ] Revalidate cached canvas data in the background after rendering from cache.
- [ ] Use optimistic UI updates for writes where the local state already knows the intended result.

## 2. Make Discovery Local First

- [ ] Filter search results against the active canvas nodes already in memory.
- [ ] Remove the `/api/search` round-trip for normal keyword and tag filtering on the current canvas.
- [ ] Keep the server search route only if it is needed later for global or cross-canvas search.
- [ ] Measure search latency after the client-side filter lands.

## 3. Add the Right Database Indexes

- [ ] Add an index on `node_tags(node_id)`.
- [ ] Add an index on `node_tags(tag_id)`.
- [ ] Add an index on `tags(name)`.
- [ ] Revisit whether SQLite FTS5 is worth it for title/body search if the data set grows.

## 4. Reduce Render Churn

- [ ] Measure how much time is spent rebuilding flow node data in the graph adapter.
- [ ] Avoid recomputing derived node data more often than needed.
- [ ] Look for opportunities to update only the changed nodes instead of remapping the whole canvas.
- [ ] Profile XYFlow rendering cost on larger canvases.

## 5. Keep Mutations Feeling Instant

- [ ] Make canvas rename optimistic in the store.
- [ ] Make edge create and delete optimistic in the store.
- [ ] Keep node create, update, and tag edits optimistic.
- [ ] Add rollback behavior only where a failed write would leave the UI inconsistent.

## 6. Verify With Measurements

- [ ] Capture a baseline for canvas load time.
- [ ] Capture a baseline for search response time.
- [ ] Capture a baseline for large-canvas drag performance.
- [ ] Re-run the same measurements after each optimization.

## Notes

- Generic backend caching is not the first thing to reach for here.
- The biggest gains are likely to come from client-side caching, local filtering, optimistic updates, and a few well-placed indexes.
- If the app grows beyond the current single-user workflow, search and cache strategy should be revisited with that shape in mind.
