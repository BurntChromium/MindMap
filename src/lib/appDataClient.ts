import {
	buildBulkPositionsBody,
	buildBulkTagsBody,
	buildCanvasCreateBody,
	buildCanvasPatchBody,
	buildEdgeCreateBody,
	buildGraphFragmentBody,
	buildNodeCreateBody,
	buildNodePatchBody,
} from '$lib/mutationPayloads';

type JsonValue =
	| Record<string, unknown>
	| Array<unknown>
	| string
	| number
	| boolean
	| null;
type BinaryValue = ArrayBuffer;

export type AppDataBackupSettings = {
	backupDirectoryPath: string;
	backupIntervalMinutes: number;
	backupRetentionCount: number;
};

export type AppDataBackupStatus = {
	latestBackupFileName: string | null;
	latestBackupCreatedAt: number | null;
	backupCount: number;
};

async function requestJson<T>(
	input: RequestInfo | URL,
	init?: RequestInit,
	fetchImpl: typeof fetch = fetch,
): Promise<T> {
	const response =
		init === undefined ? await fetchImpl(input) : await fetchImpl(input, init);

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
	fetchImpl: typeof fetch = fetch,
): Promise<BinaryValue> {
	const response =
		init === undefined ? await fetchImpl(input) : await fetchImpl(input, init);

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
	updateDatabaseSettings: (input: {
		databaseFileName: string;
	}) => Promise<JsonValue>;
	updateBackupSettings: (input: AppDataBackupSettings) => Promise<JsonValue>;
	pickBackupDirectory: (input?: {
		defaultPath?: string;
	}) => Promise<string | null>;
	createBackupSnapshot: () => Promise<JsonValue>;
	restoreLatestBackup: () => Promise<JsonValue>;
	loadCanvases: () => Promise<JsonValue>;
	createCanvas: (input: { id: string; name: string }) => Promise<JsonValue>;
	renameCanvas: (input: { id: string; name: string }) => Promise<JsonValue>;
	deleteCanvas: (input: { id: string }) => Promise<JsonValue>;

	loadNodes: (canvasId: string) => Promise<JsonValue>;
	createNode: (
		input: Parameters<typeof buildNodeCreateBody>[0],
	) => Promise<JsonValue>;
	updateNode: (
		input: Parameters<typeof buildNodePatchBody>[0],
	) => Promise<JsonValue>;
	deleteNode: (input: { id: string }) => Promise<JsonValue>;
	bulkUpdateNodeTags: (
		input: Array<{ id: string; tags: string[] }>,
	) => Promise<JsonValue>;
	bulkUpdateNodePositions: (
		input: Array<{ id: string; x: number; y: number }>,
	) => Promise<JsonValue>;

	loadEdges: (canvasId: string) => Promise<JsonValue>;
	createEdge: (
		input: Parameters<typeof buildEdgeCreateBody>[0],
	) => Promise<JsonValue>;
	deleteEdge: (input: { id: string }) => Promise<JsonValue>;

	loadEntities: (canvasId: string) => Promise<JsonValue>;
	searchNodes: (input: {
		canvasId: string;
		query: string;
		tag?: string | null;
	}) => Promise<JsonValue>;
	mutateGraphFragment: (
		input: Parameters<typeof buildGraphFragmentBody>[0],
	) => Promise<JsonValue>;
	exportDatabase: () => Promise<BinaryValue>;
	importDatabase: (input: BinaryValue) => Promise<JsonValue>;
};

export type AppDataTauriBridge = {
	core: {
		invoke: <T>(command: string, args?: unknown) => Promise<T>;
	};
};

function createFetchClient(): AppDataClient {
	return {
		loadInitialPageData: (fetchImpl) =>
			requestJson('/api/page-data', undefined, fetchImpl),
		updateDatabaseSettings: (input) =>
			requestJson('/api/database-settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			}),
		updateBackupSettings: (input) =>
			requestJson('/api/database-backups', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			}),
		pickBackupDirectory: async () => null,
		createBackupSnapshot: () =>
			requestJson('/api/database-backups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'snapshot' }),
			}),
		restoreLatestBackup: () =>
			requestJson('/api/database-backups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restore-latest' }),
			}),
		loadCanvases: () => requestJson('/api/canvases'),
		createCanvas: (input) =>
			requestJson('/api/canvases', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildCanvasCreateBody(input)),
			}),
		renameCanvas: (input) =>
			requestJson('/api/canvases', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildCanvasPatchBody(input)),
			}),
		deleteCanvas: (input) =>
			requestJson(`/api/canvases?id=${input.id}`, { method: 'DELETE' }),

		loadNodes: (canvasId) => requestJson(`/api/nodes?canvasId=${canvasId}`),
		createNode: (input) =>
			requestJson('/api/nodes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildNodeCreateBody(input)),
			}),
		updateNode: (input) =>
			requestJson('/api/nodes', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildNodePatchBody(input)),
			}),
		deleteNode: (input) =>
			requestJson(`/api/nodes?id=${input.id}`, { method: 'DELETE' }),
		bulkUpdateNodeTags: (input) =>
			requestJson('/api/nodes/bulk-tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildBulkTagsBody(input)),
			}),
		bulkUpdateNodePositions: (input) =>
			requestJson('/api/nodes/bulk-position', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildBulkPositionsBody(input)),
			}),

		loadEdges: (canvasId) => requestJson(`/api/edges?canvasId=${canvasId}`),
		createEdge: (input) =>
			requestJson('/api/edges', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildEdgeCreateBody(input)),
			}),
		deleteEdge: (input) =>
			requestJson(`/api/edges?id=${input.id}`, { method: 'DELETE' }),

		loadEntities: (canvasId) =>
			requestJson(`/api/entities?canvasId=${canvasId}`),
		searchNodes: ({ canvasId, query, tag }) =>
			requestJson(
				`/api/search?canvasId=${canvasId}&query=${encodeURIComponent(query)}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`,
			),
		mutateGraphFragment: (input) =>
			requestJson('/api/graph-fragments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildGraphFragmentBody(input)),
			}),
		exportDatabase: () => requestBytes('/api/database'),
		importDatabase: (input) =>
			requestJson('/api/database', {
				method: 'POST',
				headers: { 'Content-Type': 'application/octet-stream' },
				body: input,
			}),
	};
}

function createTauriClient(bridge: AppDataTauriBridge): AppDataClient {
	const invokeWithInput = <T>(command: string, input: unknown) =>
		bridge.core.invoke<T>(command, { input });

	return {
		loadInitialPageData: () => bridge.core.invoke('load_initial_page_data'),
		updateDatabaseSettings: (input) =>
			invokeWithInput('update_database_settings', input),
		updateBackupSettings: (input) =>
			invokeWithInput('update_backup_settings', input),
		pickBackupDirectory: (input) =>
			invokeWithInput('pick_backup_directory', input ?? {}),
		createBackupSnapshot: () => bridge.core.invoke('create_backup_snapshot'),
		restoreLatestBackup: () => bridge.core.invoke('restore_latest_backup'),
		loadCanvases: () => bridge.core.invoke('load_canvases'),
		createCanvas: (input) => invokeWithInput('create_canvas', input),
		renameCanvas: (input) => invokeWithInput('rename_canvas', input),
		deleteCanvas: (input) => invokeWithInput('delete_canvas', input),

		loadNodes: (canvasId) => invokeWithInput('load_nodes', { canvasId }),
		createNode: (input) =>
			invokeWithInput('create_node', buildNodeCreateBody(input)),
		updateNode: (input) =>
			invokeWithInput('update_node', buildNodePatchBody(input)),
		deleteNode: (input) => invokeWithInput('delete_node', input),
		bulkUpdateNodeTags: (input) =>
			invokeWithInput('bulk_update_node_tags', { nodes: input }),
		bulkUpdateNodePositions: (input) =>
			invokeWithInput('bulk_update_node_positions', { nodes: input }),

		loadEdges: (canvasId) => invokeWithInput('load_edges', { canvasId }),
		createEdge: (input) => invokeWithInput('create_edge', input),
		deleteEdge: (input) => invokeWithInput('delete_edge', input),

		loadEntities: (canvasId) => invokeWithInput('load_entities', { canvasId }),
		searchNodes: (input) => invokeWithInput('search_nodes', input),
		mutateGraphFragment: (input) =>
			invokeWithInput('mutate_graph_fragment', input),
		exportDatabase: () => bridge.core.invoke('export_database'),
		importDatabase: (input) => bridge.core.invoke('import_database', input),
	};
}

function getTauriBridge() {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.__TAURI__ ?? null;
}

function createDefaultClient() {
	const bridge = getTauriBridge();

	if (bridge) {
		return createTauriClient(bridge);
	}

	return createFetchClient();
}

let activeClient: AppDataClient = createDefaultClient();
let activeClientIsDefault = true;

function syncRuntimeClient() {
	if (!activeClientIsDefault) {
		return activeClient;
	}

	const nextClient = createDefaultClient();

	if (nextClient !== activeClient) {
		activeClient = nextClient;
	}

	return activeClient;
}

export function getAppDataClient() {
	return syncRuntimeClient();
}

export function setAppDataClient(client: AppDataClient) {
	activeClient = client;
	activeClientIsDefault = false;
}

export const appDataClient = {
	loadInitialPageData: (fetchImpl?: typeof fetch) =>
		syncRuntimeClient().loadInitialPageData(fetchImpl),
	updateDatabaseSettings: (input: { databaseFileName: string }) =>
		syncRuntimeClient().updateDatabaseSettings(input),
	updateBackupSettings: (input: AppDataBackupSettings) =>
		syncRuntimeClient().updateBackupSettings(input),
	pickBackupDirectory: (input?: { defaultPath?: string }) =>
		syncRuntimeClient().pickBackupDirectory(input),
	createBackupSnapshot: () => syncRuntimeClient().createBackupSnapshot(),
	restoreLatestBackup: () => syncRuntimeClient().restoreLatestBackup(),
	loadCanvases: () => syncRuntimeClient().loadCanvases(),
	createCanvas: (input: { id: string; name: string }) =>
		syncRuntimeClient().createCanvas(input),
	renameCanvas: (input: { id: string; name: string }) =>
		syncRuntimeClient().renameCanvas(input),
	deleteCanvas: (input: { id: string }) =>
		syncRuntimeClient().deleteCanvas(input),
	loadNodes: (canvasId: string) => syncRuntimeClient().loadNodes(canvasId),
	createNode: (input: Parameters<typeof buildNodeCreateBody>[0]) =>
		syncRuntimeClient().createNode(input),
	updateNode: (input: Parameters<typeof buildNodePatchBody>[0]) =>
		syncRuntimeClient().updateNode(input),
	deleteNode: (input: { id: string }) => syncRuntimeClient().deleteNode(input),
	bulkUpdateNodeTags: (input: Array<{ id: string; tags: string[] }>) =>
		syncRuntimeClient().bulkUpdateNodeTags(input),
	bulkUpdateNodePositions: (
		input: Array<{ id: string; x: number; y: number }>,
	) => syncRuntimeClient().bulkUpdateNodePositions(input),
	loadEdges: (canvasId: string) => syncRuntimeClient().loadEdges(canvasId),
	createEdge: (input: Parameters<typeof buildEdgeCreateBody>[0]) =>
		syncRuntimeClient().createEdge(input),
	deleteEdge: (input: { id: string }) => syncRuntimeClient().deleteEdge(input),
	loadEntities: (canvasId: string) =>
		syncRuntimeClient().loadEntities(canvasId),
	searchNodes: (input: {
		canvasId: string;
		query: string;
		tag?: string | null;
	}) => syncRuntimeClient().searchNodes(input),
	mutateGraphFragment: (input: Parameters<typeof buildGraphFragmentBody>[0]) =>
		syncRuntimeClient().mutateGraphFragment(input),
	exportDatabase: () => syncRuntimeClient().exportDatabase(),
	importDatabase: (input: BinaryValue) =>
		syncRuntimeClient().importDatabase(input),
};
