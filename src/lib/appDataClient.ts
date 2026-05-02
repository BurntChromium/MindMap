import {
  buildBulkPositionsBody,
  buildBulkTagsBody,
  buildCanvasCreateBody,
  buildCanvasPatchBody,
  buildEdgeCreateBody,
  buildGraphFragmentBody,
  buildNodeCreateBody,
  buildNodePatchBody
} from '$lib/mutationPayloads';

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;
type BinaryValue = ArrayBuffer;

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const response = init === undefined ? await fetchImpl(input) : await fetchImpl(input, init);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error === 'string'
        ? body.error
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function requestBytes(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch
): Promise<BinaryValue> {
  const response = init === undefined ? await fetchImpl(input) : await fetchImpl(input, init);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error === 'string'
        ? body.error
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return await response.arrayBuffer();
}

export type AppDataClient = {
  loadInitialPageData: (fetchImpl?: typeof fetch) => Promise<JsonValue>;
  loadCanvases: () => Promise<JsonValue>;
  createCanvas: (input: { id: string; name: string }) => Promise<JsonValue>;
  renameCanvas: (input: { id: string; name: string }) => Promise<JsonValue>;
  deleteCanvas: (input: { id: string }) => Promise<JsonValue>;

  loadNodes: (canvasId: string) => Promise<JsonValue>;
  createNode: (input: Parameters<typeof buildNodeCreateBody>[0]) => Promise<JsonValue>;
  updateNode: (input: Parameters<typeof buildNodePatchBody>[0]) => Promise<JsonValue>;
  deleteNode: (input: { id: string }) => Promise<JsonValue>;
  bulkUpdateNodeTags: (input: Array<{ id: string; tags: string[] }>) => Promise<JsonValue>;
  bulkUpdateNodePositions: (input: Array<{ id: string; x: number; y: number }>) => Promise<JsonValue>;

  loadEdges: (canvasId: string) => Promise<JsonValue>;
  createEdge: (input: Parameters<typeof buildEdgeCreateBody>[0]) => Promise<JsonValue>;
  deleteEdge: (input: { id: string }) => Promise<JsonValue>;

  loadEntities: (canvasId: string) => Promise<JsonValue>;
  searchNodes: (input: { canvasId: string; query: string; tag?: string | null }) => Promise<JsonValue>;
  mutateGraphFragment: (input: Parameters<typeof buildGraphFragmentBody>[0]) => Promise<JsonValue>;
  exportDatabase: () => Promise<BinaryValue>;
  importDatabase: (input: BinaryValue) => Promise<JsonValue>;
};

export type AppDataIpcBridge = {
  invoke: <T>(channel: string, request: { method: string; payload?: unknown }) => Promise<T>;
};

function createFetchClient(): AppDataClient {
  return {
    loadInitialPageData: (fetchImpl) => requestJson('/api/page-data', undefined, fetchImpl),
    loadCanvases: () => requestJson('/api/canvases'),
    createCanvas: (input) =>
      requestJson('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCanvasCreateBody(input))
      }),
    renameCanvas: (input) =>
      requestJson('/api/canvases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCanvasPatchBody(input))
      }),
    deleteCanvas: (input) => requestJson(`/api/canvases?id=${input.id}`, { method: 'DELETE' }),

    loadNodes: (canvasId) => requestJson(`/api/nodes?canvasId=${canvasId}`),
    createNode: (input) =>
      requestJson('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNodeCreateBody(input))
      }),
    updateNode: (input) =>
      requestJson('/api/nodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildNodePatchBody(input))
      }),
    deleteNode: (input) => requestJson(`/api/nodes?id=${input.id}`, { method: 'DELETE' }),
    bulkUpdateNodeTags: (input) =>
      requestJson('/api/nodes/bulk-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBulkTagsBody(input))
      }),
    bulkUpdateNodePositions: (input) =>
      requestJson('/api/nodes/bulk-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBulkPositionsBody(input))
      }),

    loadEdges: (canvasId) => requestJson(`/api/edges?canvasId=${canvasId}`),
    createEdge: (input) =>
      requestJson('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEdgeCreateBody(input))
      }),
    deleteEdge: (input) => requestJson(`/api/edges?id=${input.id}`, { method: 'DELETE' }),

    loadEntities: (canvasId) => requestJson(`/api/entities?canvasId=${canvasId}`),
    searchNodes: ({ canvasId, query, tag }) =>
      requestJson(`/api/search?canvasId=${canvasId}&query=${encodeURIComponent(query)}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`),
    mutateGraphFragment: (input) =>
      requestJson('/api/graph-fragments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGraphFragmentBody(input))
      }),
    exportDatabase: () => requestBytes('/api/database'),
    importDatabase: (input) =>
      requestJson('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: input
      })
  };
}

export function createIpcAppDataClient(bridge: AppDataIpcBridge): AppDataClient {
  return {
    loadInitialPageData: () =>
      bridge.invoke('mindmap:app-data', { method: 'loadInitialPageData' }),
    loadCanvases: () => bridge.invoke('mindmap:app-data', { method: 'loadCanvases' }),
    createCanvas: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'createCanvas', payload: input }),
    renameCanvas: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'renameCanvas', payload: input }),
    deleteCanvas: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'deleteCanvas', payload: input }),

    loadNodes: (canvasId) =>
      bridge.invoke('mindmap:app-data', { method: 'loadNodes', payload: { canvasId } }),
    createNode: (input) => bridge.invoke('mindmap:app-data', { method: 'createNode', payload: input }),
    updateNode: (input) => bridge.invoke('mindmap:app-data', { method: 'updateNode', payload: input }),
    deleteNode: (input) => bridge.invoke('mindmap:app-data', { method: 'deleteNode', payload: input }),
    bulkUpdateNodeTags: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'bulkUpdateNodeTags', payload: input }),
    bulkUpdateNodePositions: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'bulkUpdateNodePositions', payload: input }),

    loadEdges: (canvasId) =>
      bridge.invoke('mindmap:app-data', { method: 'loadEdges', payload: { canvasId } }),
    createEdge: (input) => bridge.invoke('mindmap:app-data', { method: 'createEdge', payload: input }),
    deleteEdge: (input) => bridge.invoke('mindmap:app-data', { method: 'deleteEdge', payload: input }),

    loadEntities: (canvasId) =>
      bridge.invoke('mindmap:app-data', { method: 'loadEntities', payload: { canvasId } }),
    searchNodes: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'searchNodes', payload: input }),
    mutateGraphFragment: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'mutateGraphFragment', payload: input }),
    exportDatabase: () => bridge.invoke('mindmap:app-data', { method: 'exportDatabase' }),
    importDatabase: (input) =>
      bridge.invoke('mindmap:app-data', { method: 'importDatabase', payload: input })
  };
}

function createDefaultClient() {
  if (typeof window !== 'undefined' && window.mindmapDesktop) {
    return createIpcAppDataClient(window.mindmapDesktop);
  }

  return createFetchClient();
}

let activeClient: AppDataClient = createDefaultClient();

export function getAppDataClient() {
  return activeClient;
}

export function setAppDataClient(client: AppDataClient) {
  activeClient = client;
}

export const appDataClient = {
  loadInitialPageData: (fetchImpl?: typeof fetch) => activeClient.loadInitialPageData(fetchImpl),
  loadCanvases: () => activeClient.loadCanvases(),
  createCanvas: (input: { id: string; name: string }) => activeClient.createCanvas(input),
  renameCanvas: (input: { id: string; name: string }) => activeClient.renameCanvas(input),
  deleteCanvas: (input: { id: string }) => activeClient.deleteCanvas(input),
  loadNodes: (canvasId: string) => activeClient.loadNodes(canvasId),
  createNode: (input: Parameters<typeof buildNodeCreateBody>[0]) => activeClient.createNode(input),
  updateNode: (input: Parameters<typeof buildNodePatchBody>[0]) => activeClient.updateNode(input),
  deleteNode: (input: { id: string }) => activeClient.deleteNode(input),
  bulkUpdateNodeTags: (input: Array<{ id: string; tags: string[] }>) =>
    activeClient.bulkUpdateNodeTags(input),
  bulkUpdateNodePositions: (input: Array<{ id: string; x: number; y: number }>) =>
    activeClient.bulkUpdateNodePositions(input),
  loadEdges: (canvasId: string) => activeClient.loadEdges(canvasId),
  createEdge: (input: Parameters<typeof buildEdgeCreateBody>[0]) => activeClient.createEdge(input),
  deleteEdge: (input: { id: string }) => activeClient.deleteEdge(input),
  loadEntities: (canvasId: string) => activeClient.loadEntities(canvasId),
  searchNodes: (input: { canvasId: string; query: string; tag?: string | null }) =>
    activeClient.searchNodes(input),
  mutateGraphFragment: (input: Parameters<typeof buildGraphFragmentBody>[0]) =>
    activeClient.mutateGraphFragment(input),
  exportDatabase: () => activeClient.exportDatabase(),
  importDatabase: (input: BinaryValue) => activeClient.importDatabase(input)
};
