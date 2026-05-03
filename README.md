# Mindmap

A Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

See [USER_GUIDE.md](./USER_GUIDE.md) for the app layout and keyboard shortcuts.
See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Build

### Commands

- `npm run dev`: run the web app in the browser
- `npm run tauri dev`: run the desktop app in Tauri for development
- `npm run build`: build the web app for production
- `npm run build:desktop`: build the static frontend used by Tauri
- `npm run tauri build`: bundle the Tauri desktop app for release
The generated desktop build outputs are ignored by git, so you can rebuild locally without polluting the working tree.

### Desktop Prerequisites

To build the desktop app you generally need:

- Node.js and npm for the frontend build and package scripts
- Rust and Cargo for the Tauri backend in `src-tauri`
- Platform-specific native tooling required by Tauri:
  - Windows: Microsoft C++ Build Tools and WebView2
  - macOS: Xcode, or Xcode Command Line Tools for desktop-only builds
  - Linux: WebKitGTK plus the native libraries Tauri requires for your distro

The repo uses bundled SQLite libraries, so you do not need a separate system SQLite install for the normal desktop build path.

### Database Paths

- `npm run dev` uses `dev.db`
- `npm run build` plus `npm run preview` uses `mindmap.db`
- `MINDMAP_DB_PATH` overrides either default when set
