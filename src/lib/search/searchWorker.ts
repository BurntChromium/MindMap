import {
	searchDocuments,
	tokenizeSearchQuery,
	type SearchCorpusSnapshot,
	type SearchDocument,
	type SearchQuery,
	type SearchResult,
} from './searchCore';
import {
	type SearchChange,
	type SearchRequest,
	type SearchResponse,
} from './searchProvider';
import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';

type WorkerRequest =
	| { type: 'replaceCorpus'; snapshot: SearchCorpusSnapshot }
	| { type: 'applyChanges'; changes: SearchChange[] }
	| { type: 'search'; request: SearchRequest }
	| { type: 'dispose' };

type IndexedDocument = {
	document: SearchDocument;
};

class WorkerSearchIndex {
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

			this.removeDocument(change.document.id);
			this.addDocument(change.document);
		}

		this.revision += 1;
	}

	search(request: SearchRequest): SearchResponse {
		const queryTokens = tokenizeSearchQuery(request.query);
		const normalizedTag = request.tag ? normalizeTagName(request.tag) : '';

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

		const results = searchDocuments(
			Array.from(candidateIds)
				.map((id) => this.documents.get(id)?.document)
				.filter((document): document is SearchDocument => Boolean(document)),
			{
				query: request.query,
				tag: request.tag,
				limit: request.limit,
			},
		);

		return {
			requestId: request.requestId,
			canvasId: request.canvasId,
			corpusRevision: this.revision,
			results,
		};
	}

	private addDocument(document: SearchDocument) {
		const normalizedTags = normalizeTagList(document.tags ?? []);
		const indexed: IndexedDocument = {
			document: {
				...document,
				tags: normalizedTags,
			},
		};

		this.documents.set(document.id, indexed);

		for (const token of [
			...tokenizeSearchQuery(document.title ?? ''),
			...tokenizeSearchQuery(document.body ?? ''),
			...normalizedTags.flatMap((tag) => tokenizeSearchQuery(tag)),
		]) {
			const ids = this.documentsByToken.get(token) ?? new Set<string>();
			ids.add(document.id);
			this.documentsByToken.set(token, ids);
		}

		for (const tag of normalizedTags) {
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

		const normalizedTags = normalizeTagList(indexed.document.tags ?? []);
		const tokens = [
			...tokenizeSearchQuery(indexed.document.title ?? ''),
			...tokenizeSearchQuery(indexed.document.body ?? ''),
			...normalizedTags.flatMap((tag) => tokenizeSearchQuery(tag)),
		];

		for (const token of tokens) {
			const ids = this.documentsByToken.get(token);

			if (!ids) {
				continue;
			}

			ids.delete(id);

			if (!ids.size) {
				this.documentsByToken.delete(token);
			}
		}

		for (const tag of normalizedTags) {
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

const index = new WorkerSearchIndex();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	try {
		const message = event.data;

		if (message.type === 'replaceCorpus') {
			index.replaceCorpus(message.snapshot);
			self.postMessage({ type: 'ready' });
			return;
		}

		if (message.type === 'applyChanges') {
			index.applyChanges(message.changes);
			self.postMessage({ type: 'ready' });
			return;
		}

		if (message.type === 'search') {
			self.postMessage({
				type: 'response',
				payload: index.search(message.request),
			});
			return;
		}

		if (message.type === 'dispose') {
			self.close();
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Search worker failed.';
		self.postMessage({ type: 'error', message });
	}
};
