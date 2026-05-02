import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import * as backend from '../src/lib/server/appData';
import { initSchema } from '../src/lib/server/schema';

type AppDataRequest = {
  method: string;
  payload?: unknown;
};

function ensureDbPath() {
  if (!process.env.MINDMAP_DB_PATH) {
    process.env.MINDMAP_DB_PATH = join(app.getPath('userData'), 'mindmap.db');
  }
}

async function loadBackend() {
  ensureDbPath();
  initSchema();
  return backend;
}

async function handleAppData(request: AppDataRequest) {
  const backend = await loadBackend();

  switch (request.method) {
    case 'loadCanvases':
      return backend.getCanvases();
    case 'loadInitialPageData':
      return backend.getInitialPageData();
    case 'createCanvas':
      return backend.createCanvas(request.payload as Parameters<typeof backend.createCanvas>[0]);
    case 'renameCanvas':
      return backend.renameCanvas(request.payload as Parameters<typeof backend.renameCanvas>[0]);
    case 'deleteCanvas':
      return backend.deleteCanvas((request.payload as { id: string }).id);
    case 'loadNodes':
      return backend.getNodesByCanvasId((request.payload as { canvasId: string }).canvasId);
    case 'createNode':
      return backend.createNode(request.payload as Parameters<typeof backend.createNode>[0]);
    case 'updateNode':
      return backend.updateNode(request.payload as Parameters<typeof backend.updateNode>[0]);
    case 'deleteNode':
      return backend.deleteNode((request.payload as { id: string }).id);
    case 'bulkUpdateNodeTags':
      return backend.bulkUpdateNodeTags(request.payload as Parameters<typeof backend.bulkUpdateNodeTags>[0]);
    case 'bulkUpdateNodePositions':
      return backend.bulkUpdateNodePositions(
        request.payload as Parameters<typeof backend.bulkUpdateNodePositions>[0]
      );
    case 'loadEdges':
      return backend.getEdgesByCanvasId((request.payload as { canvasId: string }).canvasId);
    case 'createEdge':
      return backend.createEdge(request.payload as Parameters<typeof backend.createEdge>[0]);
    case 'deleteEdge':
      return backend.deleteEdge((request.payload as { id: string }).id);
    case 'loadEntities':
      return {
        entities: backend.getEntitiesByCanvasId((request.payload as { canvasId: string }).canvasId),
        mentions: backend.getEntityMentionsByCanvasId(
          (request.payload as { canvasId: string }).canvasId
        )
      };
    case 'searchNodes':
      return backend.searchNodes(request.payload as Parameters<typeof backend.searchNodes>[0]);
    case 'mutateGraphFragment':
      return backend.pasteGraphFragment(request.payload as Parameters<typeof backend.pasteGraphFragment>[0]);
    case 'exportDatabase':
      return backend.exportDatabase();
    case 'importDatabase':
      return backend.importDatabase(request.payload as Parameters<typeof backend.importDatabase>[0]);
    default:
      throw new Error(`Unsupported app-data method: ${request.method}`);
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: join(app.getAppPath(), 'dist-electron/preload.cjs')
    }
  });

  if (process.env.ELECTRON_START_URL) {
    void window.loadURL(process.env.ELECTRON_START_URL);
    return;
  }

  void window.loadFile(join(app.getAppPath(), 'build/desktop/index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('mindmap:app-data', async (_event, request: AppDataRequest) => {
    return handleAppData(request);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
