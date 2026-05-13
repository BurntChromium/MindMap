import { get, writable } from 'svelte/store';
import { appDataClient } from '$lib/appDataClient';
import { createClientId } from '$lib/clientId';
import {
	hasTopicTitleConflict,
	normalizeTopicTitle,
	resolveUniqueTopicTitle,
} from '$lib/topicTitles';
import { historyStore } from '$lib/stores/historyStore';
import { mutationStateStore } from '$lib/stores/mutationStateStore';

export type Topic = {
	id: string;
	canvas_id: string;
	title: string;
	x: number;
	y: number;
	width: number;
	height: number;
};

function createTopicStore() {
	const store = writable<{
		topics: Map<string, Topic>;
		activeCanvasId: string | null;
	}>({
		topics: new Map(),
		activeCanvasId: null,
	});
	const { subscribe, set, update } = store;
	const cacheByCanvasId = new Map<string, Topic[]>();
	let loadToken = 0;

	function cloneTopic(topic: Topic): Topic {
		return { ...topic };
	}

	function topicsToMap(topics: Topic[]) {
		const map = new Map<string, Topic>();

		for (const topic of topics) {
			map.set(topic.id, cloneTopic(topic));
		}

		return map;
	}

	function snapshotTopics(topics: Map<string, Topic>) {
		return Array.from(topics.values()).map(cloneTopic);
	}

	function snapshotState(state = get(store)) {
		return {
			topics: topicsToMap(snapshotTopics(state.topics)),
			activeCanvasId: state.activeCanvasId,
		};
	}

	function syncCache(state = get(store)) {
		if (!state.activeCanvasId) {
			return;
		}

		cacheByCanvasId.set(state.activeCanvasId, snapshotTopics(state.topics));
	}

	function replaceState(topics: Topic[], activeCanvasId: string | null) {
		set({
			topics: topicsToMap(topics),
			activeCanvasId,
		});

		if (activeCanvasId) {
			cacheByCanvasId.set(activeCanvasId, topics.map(cloneTopic));
		}
	}

	return {
		subscribe,

		hydrate(topics: Topic[], activeCanvasId: string | null = null) {
			replaceState(topics, activeCanvasId);
		},

		async load(canvasId: string) {
			const current = get(store);
			const cached = cacheByCanvasId.get(canvasId);
			const requestToken = ++loadToken;
			mutationStateStore.beginLoad();

			if (current.activeCanvasId && current.activeCanvasId !== canvasId) {
				cacheByCanvasId.set(
					current.activeCanvasId,
					snapshotTopics(current.topics),
				);
			}

			if (cached) {
				set({
					topics: topicsToMap(cached),
					activeCanvasId: canvasId,
				});
			} else if (current.activeCanvasId !== canvasId) {
				set({
					topics: new Map(),
					activeCanvasId: canvasId,
				});
			}

			try {
				const data = (await appDataClient.loadTopics(canvasId)) as Array<Topic>;

				if (requestToken !== loadToken) {
					mutationStateStore.finishLoad(true);
					return false;
				}

				cacheByCanvasId.set(canvasId, data.map(cloneTopic));
				set({
					topics: topicsToMap(data),
					activeCanvasId: canvasId,
				});
				mutationStateStore.finishLoad(true);
				return true;
			} catch {
				if (requestToken !== loadToken) {
					mutationStateStore.finishLoad(true);
					return false;
				}

				if (!cached && current.activeCanvasId === canvasId) {
					syncCache();
				}

				mutationStateStore.finishLoad(
					false,
					`Failed to load topics for ${canvasId}`,
				);
				return false;
			}
		},

		async create(
			canvasId: string,
			input?: Partial<Pick<Topic, 'id' | 'title' | 'x' | 'y' | 'width' | 'height'>>,
		) {
			const current = get(store);
			const currentTopics = Array.from(current.topics.values());
			const id = input?.id ?? createClientId('topic');
			const title = resolveUniqueTopicTitle(currentTopics, input?.title);
			const width = typeof input?.width === 'number' ? input.width : 280;
			const height = typeof input?.height === 'number' ? input.height : 180;
			const newTopic: Topic = {
				id,
				canvas_id: canvasId,
				title,
				x: typeof input?.x === 'number' ? input.x : 0,
				y: typeof input?.y === 'number' ? input.y : 0,
				width,
				height,
			};
			const previous = snapshotState();
			mutationStateStore.beginWrite();

			update((state) => {
				state.topics.set(id, newTopic);
				state.activeCanvasId = canvasId;
				return state;
			});

			try {
				const responseBody = (await appDataClient.createTopic({
					id,
					canvasId,
					title: newTopic.title,
					x: newTopic.x,
					y: newTopic.y,
					width: newTopic.width,
					height: newTopic.height,
				})) as { title?: string } | null;
				const resolvedTitle =
					typeof responseBody?.title === 'string'
						? responseBody.title
						: newTopic.title;

				if (resolvedTitle !== newTopic.title) {
					update((state) => {
						const existing = state.topics.get(id);

						if (existing) {
							state.topics.set(id, {
								...existing,
								title: resolvedTitle,
							});
						}

						return state;
					});
				}

				cacheByCanvasId.set(canvasId, snapshotTopics(get(store).topics));
				if (!historyStore.isReplaying()) {
					historyStore.record({
						label: 'Create topic',
						undo: async () => {
							await topicStore.remove(id);
						},
						redo: async () =>
							void (await topicStore.create(canvasId, {
								id,
								title: resolvedTitle,
								x: newTopic.x,
								y: newTopic.y,
								width: newTopic.width,
								height: newTopic.height,
							})),
					});
				}
				mutationStateStore.finishWrite(true);
				return id;
			} catch (error) {
				set(previous);
				syncCache(previous);
				const message = error instanceof Error ? error.message : String(error);
				mutationStateStore.finishWrite(
					false,
					`Create topic failed with ${message}`,
				);
				return null;
			}
		},

		async update(
			input: Partial<Pick<Topic, 'title' | 'x' | 'y' | 'width' | 'height'>> & {
				id: string;
			},
		) {
			const current = get(store);
			const existing = current.topics.get(input.id);

			if (!existing) {
				return false;
			}

			const previous = snapshotState();
			const nextTopic: Topic = {
				...existing,
				title: input.title ?? existing.title,
				x: typeof input.x === 'number' ? input.x : existing.x,
				y: typeof input.y === 'number' ? input.y : existing.y,
				width: typeof input.width === 'number' ? input.width : existing.width,
				height: typeof input.height === 'number' ? input.height : existing.height,
			};
			const normalizedTitle = input.title ? normalizeTopicTitle(input.title) : '';

			if (
				normalizedTitle &&
				hasTopicTitleConflict(
					Array.from(current.topics.values()),
					normalizedTitle,
					input.id,
				)
			) {
				mutationStateStore.finishWrite(
					false,
					`A topic titled "${normalizedTitle}" already exists in this canvas.`,
				);
				return false;
			}
			mutationStateStore.beginWrite();

			update((state) => {
				state.topics.set(input.id, nextTopic);
				return state;
			});
			syncCache();

			try {
				await appDataClient.updateTopic({
					id: input.id,
					title: input.title,
					x: input.x,
					y: input.y,
					width: input.width,
					height: input.height,
				});

				if (!historyStore.isReplaying()) {
					historyStore.record({
						label: 'Update topic',
						undo: async () => {
							await topicStore.update({
								id: input.id,
								title: existing.title,
								x: existing.x,
								y: existing.y,
								width: existing.width,
								height: existing.height,
							});
						},
						redo: async () => {
							await topicStore.update({
								id: input.id,
								title: nextTopic.title,
								x: nextTopic.x,
								y: nextTopic.y,
								width: nextTopic.width,
								height: nextTopic.height,
							});
						},
					});
				}

				mutationStateStore.finishWrite(true);
				return true;
			} catch (error) {
				set(previous);
				syncCache(previous);
				mutationStateStore.finishWrite(
					false,
					`Update topic failed with ${String(error)}`,
				);
				return false;
			}
		},

		async remove(id: string) {
			const previous = snapshotState();
			const removedTopic = previous.topics.get(id);
			mutationStateStore.beginWrite();

			update((state) => {
				state.topics.delete(id);
				return state;
			});
			syncCache();

			try {
				await appDataClient.deleteTopic({ id });

				if (removedTopic && !historyStore.isReplaying()) {
					historyStore.record({
						label: 'Delete topic',
						undo: async () => {
							await topicStore.create(removedTopic.canvas_id, {
								id: removedTopic.id,
								title: removedTopic.title,
								x: removedTopic.x,
								y: removedTopic.y,
								width: removedTopic.width,
								height: removedTopic.height,
							});
						},
						redo: async () => {
							await topicStore.remove(removedTopic.id);
						},
					});
				}

				mutationStateStore.finishWrite(true);
				return true;
			} catch (error) {
				set(previous);
				syncCache(previous);
				mutationStateStore.finishWrite(
					false,
					`Delete topic failed with ${String(error)}`,
				);
				return false;
			}
		},
	};
}

export const topicStore = createTopicStore();
