# TODO

- [ ] Show an in-app confirmation when database export succeeds, including the saved file location.
- [ ] Check whether node position updates are debounced before syncing to the backend/SQLite database, especially for keyboard-driven movement.
- [ ] Replace the `Shift+E` edit-node shortcut with a different binding so capital `E` input is not intercepted.
- [ ] Make the `build:desktop` env flags Windows-compatible so Tauri build/package works outside POSIX shells. (currently uses inline Unix env assignment)
