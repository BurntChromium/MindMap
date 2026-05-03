# Mindmap

A Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

See [USER_GUIDE.md](./USER_GUIDE.md) for the app layout and keyboard shortcuts.

## Build Commands

- `npm run build`: build the web app
- `npm run build:desktop`: build the static frontend used by Tauri
- `npm run tauri dev`: run the app in the Tauri desktop shell
- `npm run tauri build`: bundle the Tauri desktop app
The generated desktop build outputs are ignored by git, so you can rebuild locally without polluting the working tree.
