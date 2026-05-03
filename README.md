# Mindmap

A Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

See [USER_GUIDE.md](./USER_GUIDE.md) for the app layout and keyboard shortcuts.

## Build Commands

- `npm run dev`: run the web app in the browser
- `npm run tauri dev`: run the desktop app in Tauri for development
- `npm run build`: build the web app for production
- `npm run build:desktop`: build the static frontend used by Tauri
- `npm run tauri build`: bundle the Tauri desktop app for release
The generated desktop build outputs are ignored by git, so you can rebuild locally without polluting the working tree.
