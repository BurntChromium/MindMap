# Mindmap

A Svelte and SQLite app for building mind maps and linked notebooks on a shared canvas.

See [USER_GUIDE.md](./USER_GUIDE.md) for the app layout and keyboard shortcuts.

## Build Commands

- `npm run build`: build the web app
- `npm run build:desktop`: build the desktop static app and the Electron main/preload bundle
- `npm run electron:package`: build the desktop app and package it with electron-builder
- `npm run electron:package:win`: package a Windows build from Docker

## Windows Builds On WSL2

The Docker-based route emits a normal Windows installer or portable executable, depending on the Electron Builder target you ask for. You build it inside the container on WSL2, then run the resulting Windows artifact on Windows normally.

For this project the recommended command is:

- `npm run electron:package:win`

That uses the `electronuserland/builder:wine` image, mounts the repo into `/project`, and writes the Windows build output into `release/`.

You might need to configure permissions:
```sh
sudo usermod -aG docker $USER
newgrp docker // avoid logging out and in
```

Two caveats:

- Windows builds from Linux only work reliably if native dependencies can be rebuilt or prebuilt for the target platform.
- `better-sqlite3` is a native dependency, so if the build ever fails here the next thing to check is whether that package has a suitable prebuilt binary for the Electron/Windows combination.

The generated desktop build outputs are ignored by git, so you can rebuild locally without polluting the working tree.
