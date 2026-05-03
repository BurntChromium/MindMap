# TODO

- [x] Show an in-app confirmation when database export succeeds, including the saved file location.
- [x] Check whether node position updates are debounced before syncing to the backend/SQLite database, especially for keyboard-driven movement.
- [x] Replace the `Shift+E` edit-node shortcut with a different binding so capital `E` input is not intercepted.
- [x] Make the `build:desktop` env flags Windows-compatible so Tauri build/package works outside POSIX shells. (currently uses inline Unix env assignment)
