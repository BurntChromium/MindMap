import { appDataClient } from '$lib/appDataClient';
import { normalizeTagList } from '$lib/tagUtils';
import type {
	SearchCorpusSnapshot,
	SearchDocument,
	SearchResult,
} from './searchCore';
import { createSearchHitIdSet, tokenizeSearchQuery } from './searchCore';

export type SearchChange =
	| {
			type: 'upsert';
			document: SearchDocument;
	  }
	| {
			type: 'delete';
			id: string;
	  };

export type SearchRequest = {
	requestId: number;
	canvasId: string;
	corpusRevision: number;
	query: string;
	tag: string | null;
	limit?: number;
};

export type SearchResponse = {
	requestId: number;
	canvasId: string;
	corpusRevision: number;
	results: SearchResult[];
};

export interface SearchProvider {
	replaceCorpus(snapshot: SearchCorpusSnapshot): Promise<void>;
	applyChanges(changes: SearchChange[]): Promise<void>;
	search(request: SearchRequest): Promise<SearchResponse>;
	dispose(): Promise<void>;
}

type IndexedDocument = {
	document: SearchDocument;
	titleTokens: Set<string>;
	bodyTokens: Set<string>;
	tagTokens: Set<string>;
	allTokens: Set<string>;
	normalizedTags: string[];
};

function tokenizeField(value: string) {
	return new Set(tokenizeSearchQuery(value));
}

function indexDocument(document: SearchDocument): IndexedDocument {
	const normalizedTags = normalizeTagList(document.tags ?? []);
	const titleTokens = tokenizeField(document.title ?? '');
	const bodyTokens = tokenizeField(document.body ?? '');
	const tagTokens = new Set(
		normalizedTags.flatMap((tag) => tokenizeSearchQuery(tag)),
	);
	const allTokens = new Set([...titleTokens, ...bodyTokens, ...tagTokens]);

	return {
		document: {
			...document,
			tags: normalizedTags,
		},
		titleTokens,
		bodyTokens,
		tagTokens,
		allTokens,
		normalizedTags,
	};
}

function scoreDocument(indexed: IndexedDocument, queryTokens: string[], tag: string | null) {
	let score = 0;

	for (const token of queryTokens) {
		if (indexed.titleTokens.has(token)) {
			score += 300;
		} else if (indexed.tagTokens.has(token)) {
			score += 200;
		} else if (indexed.bodyTokens.has(token)) {
			score += 100;
		}
	}

	if (tag) {
		score += 25;
	}

	if (queryTokens.length > 0 && queryTokens.every((token) => indexed.titleTokens.has(token))) {
		score += 50;
	}

	return score;
}

function compareResults(left: SearchResult, right: SearchResult) {
	if (right.score !== left.score) {
		return right.score - left.score;
	}

	const leftCreatedAt = typeof left.created_at === 'number' ? left.created_at : null;
	const rightCreatedAt = typeof right.created_at === 'number' ? right.created_at : null;

	if (leftCreatedAt !== null && rightCreatedAt !== null && leftCreatedAt !== rightCreatedAt) {
		return leftCreatedAt - rightCreatedAt;
	}

	const titleComparison = left.title.localeCompare(right.title);

	if (titleComparison !== 0) {
		return titleComparison;
	}

	return left.id.localeCompare(right.id);
}

class IndexedSearchStore {
	private readonly documents = new Map<string, IndexedDocument>();
	private readonly documentsByToken = new Map<string, Set<string>>();
	private readonly documentsByTag = new Map<string, Set<string>>();
	private canvasId: string | null = null;
	private revision = 0;

	replaceCorpus(snapshot: SearchCorpusSnapshot) {
		this.documents.clear();
		this.documentsByToken.clear();
		this.documentsByTag.clear();
		this.canvasId = snapshot.canvasId;
		this.revision = snapshot.revision;

		for (const document of snapshot.documents) {
			this.addDocument(document);
		}
	}

	applyChanges(changes: SearchChange[]) {
		for (const change of changes) {
			if (change.type === 'delete') {
				this.removeDocument(change.id);
				continue;
			}

			this.upsertDocument(change.document);
		}

		this.revision += 1;
	}

	search(request: SearchRequest): SearchResponse {
		const queryTokens = tokenizeSearchQuery(request.query);
		const normalizedTag = request.tag ? normalizeTagList([request.tag])[0] ?? '' : '';

		if (!queryTokens.length && !normalizedTag) {
			return {
				requestId: request.requestId,
				canvasId: request.canvasId,
				corpusRevision: this.revision,
				results: [],
			};
		}

		if (this.canvasId !== request.canvasId) {
			return {
				requestId: request.requestId,
				canvasId: request.canvasId,
				corpusRevision: this.revision,
				results: [],
			};
		}

		let candidateIds: Set<string> | null = null;

		for (const token of queryTokens) {
			const ids = this.documentsByToken.get(token);

			if (!ids) {
				candidateIds = new Set();
				break;
			}

			if (!candidateIds) {
				candidateIds = new Set(ids);
				continue;
			}

			for (const candidateId of Array.from(candidateIds)) {
				if (!ids.has(candidateId)) {
					candidateIds.delete(candidateId);
				}
			}
		}

		if (!candidateIds) {
			candidateIds = new Set(this.documents.keys());
		}

		if (normalizedTag) {
			const taggedIds = this.documentsByTag.get(normalizedTag) ?? new Set<string>();

			for (const candidateId of Array.from(candidateIds)) {
				if (!taggedIds.has(candidateId)) {
					candidateIds.delete(candidateId);
				}
			}
		}

		const results = Array.from(candidateIds)
			.map((id) => this.documents.get(id))
			.filter((document): document is IndexedDocument => Boolean(document))
			.map((indexed) => ({
				...indexed.document,
				tags: indexed.normalizedTags,
				score: scoreDocument(indexed, queryTokens, normalizedTag || null),
			}))
			.sort(compareResults);

		return {
			requestId: request.requestId,
			canvasId: request.canvasId,
			corpusRevision: this.revision,
			results:
				typeof request.limit === 'number' && request.limit >= 0
					? results.slice(0, request.limit)
					: results,
		};
	}

	private upsertDocument(document: SearchDocument) {
		this.removeDocument(document.id);
		this.addDocument(document);
	}

	private addDocument(document: SearchDocument) {
		const indexed = indexDocument(document);
		this.documents.set(document.id, indexed);

		for (const token of indexed.allTokens) {
			const ids = this.documentsByToken.get(token) ?? new Set<string>();
			ids.add(document.id);
			this.documentsByToken.set(token, ids);
		}

		for (const tag of indexed.normalizedTags) {
			const ids = this.documentsByTag.get(tag) ?? new Set<string>();
			ids.add(document.id);
			this.documentsByTag.set(tag, ids);
		}
	}

	private removeDocument(id: string) {
		const indexed = this.documents.get(id);

		if (!indexed) {
			return;
		}

		for (const token of indexed.allTokens) {
			const ids = this.documentsByToken.get(token);

			if (!ids) {
				continue;
			}

			ids.delete(id);

			if (!ids.size) {
				this.documentsByToken.delete(token);
			}
		}

		for (const tag of indexed.normalizedTags) {
			const ids = this.documentsByTag.get(tag);

			if (!ids) {
				continue;
			}

			ids.delete(id);

			if (!ids.size) {
				this.documentsByTag.delete(tag);
			}
		}

		this.documents.delete(id);
	}
}

class SyncSearchProvider implements SearchProvider {
	private readonly store = new IndexedSearchStore();

	async replaceCorpus(snapshot: SearchCorpusSnapshot) {
		this.store.replaceCorpus(snapshot);
	}

	async applyChanges(changes: SearchChange[]) {
		this.store.applyChanges(changes);
	}

	async search(request: SearchRequest) {
		return this.store.search(request);
	}

	async dispose() {
		return undefined;
	}
}

type WorkerRequest =
	| { type: 'replaceCorpus'; snapshot: SearchCorpusSnapshot }
	| { type: 'applyChanges'; changes: SearchChange[] }
	| { type: 'search'; request: SearchRequest }
	| { type: 'dispose' };

type WorkerResponse =
	| { type: 'ready' }
	| { type: 'error'; message: string }
	| { type: 'response'; payload: SearchResponse };

class WorkerSearchProvider implements SearchProvider {
	private readonly worker: Worker;
	private readonly pending = new Map<number, {
		resolve: (value: SearchResponse) => void;
		reject: (reason?: unknown) => void;
	}>();

	constructor() {
		this.worker = new Worker(
			new URL('./searchWorker.ts', import.meta.url),
			{ type: 'module' },
		);

		this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
			const message = event.data;

			if (message.type === 'ready') {
				return;
			}

			if (message.type === 'error') {
				for (const pending of this.pending.values()) {
					pending.reject(new Error(message.message));
				}
				this.pending.clear();
				return;
			}

			const pending = this.pending.get(message.payload.requestId);

			if (!pending) {
				return;
			}

			this.pending.delete(message.payload.requestId);
			pending.resolve(message.payload);
		});

		this.worker.addEventListener('error', (event) => {
			const error = event.error instanceof Error ? event.error : new Error(event.message);

			for (const pending of this.pending.values()) {
				pending.reject(error);
			}
			this.pending.clear();
		});
	}

	async replaceCorpus(snapshot: SearchCorpusSnapshot) {
		this.worker.postMessage({ type: 'replaceCorpus', snapshot } satisfies WorkerRequest);
	}

	async applyChanges(changes: SearchChange[]) {
		this.worker.postMessage({ type: 'applyChanges', changes } satisfies WorkerRequest);
	}

	search(request: SearchRequest) {
		return new Promise<SearchResponse>((resolve, reject) => {
			this.pending.set(request.requestId, { resolve, reject });
			this.worker.postMessage({ type: 'search', request } satisfies WorkerRequest);
		});
	}

	async dispose() {
		this.worker.postMessage({ type: 'dispose' } satisfies WorkerRequest);
		this.worker.terminate();
	}
}

class BackendSearchProvider implements SearchProvider {
	private latestCorpus: SearchCorpusSnapshot | null = null;

	async replaceCorpus(snapshot: SearchCorpusSnapshot) {
		this.latestCorpus = snapshot;
	}

	async applyChanges(changes: SearchChange[]) {
		if (!this.latestCorpus) {
			return;
		}

		const documents = new Map(
			this.latestCorpus.documents.map((document) => [document.id, document]),
		);

		for (const change of changes) {
			if (change.type === 'delete') {
				documents.delete(change.id);
				continue;
			}

			documents.set(change.document.id, change.document);
		}

		this.latestCorpus = {
			...this.latestCorpus,
			revision: this.latestCorpus.revision + 1,
			documents: Array.from(documents.values()),
		};
	}

	async search(request: SearchRequest) {
		const response = (await appDataClient.searchNodes({
			canvasId: request.canvasId,
			query: request.query,
			tag: request.tag,
		})) as Array<SearchDocument & { score?: number }>;

		return {
			requestId: request.requestId,
			canvasId: request.canvasId,
			corpusRevision: request.corpusRevision,
			results: response.map((document) => ({
				...document,
				tags: normalizeTagList(document.tags ?? []),
				score: typeof document.score === 'number' ? document.score : 0,
			})),
		};
	}

	async dispose() {
		return undefined;
	}
}

export function createSyncSearchProvider(): SearchProvider {
	return new SyncSearchProvider();
}

export function createWorkerSearchProvider(): SearchProvider {
	if (typeof Worker === 'undefined') {
		return createSyncSearchProvider();
	}

	try {
		return new WorkerSearchProvider();
	} catch {
		return createSyncSearchProvider();
	}
}

export function createBackendSearchProvider(): SearchProvider {
	return new BackendSearchProvider();
}

export function createSearchProvider() {
	return createWorkerSearchProvider();
}

export function getSearchHitIdsFromResults(results: SearchResult[]) {
	return createSearchHitIdSet(results);
}
