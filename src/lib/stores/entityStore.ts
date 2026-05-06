import { writable } from 'svelte/store';
import { appDataClient } from '$lib/appDataClient';

export type Entity = {
	id: string;
	canvas_id: string;
	title: string;
	title_key: string;
	primary_node_id: string | null;
	mention_count: number;
	created_at: number;
	updated_at: number;
};

export type EntityMention = {
	id: string;
	canvas_id: string;
	entity_id: string;
	node_id: string;
	reference_text: string;
	title: string;
	title_key: string;
	start_index: number;
	end_index: number;
	created_at: number;
	updated_at: number;
};

type EntityStoreState = {
	entities: Entity[];
	mentions: EntityMention[];
	activeCanvasId: string | null;
};

function createEntityStore() {
	const { subscribe, set } = writable<EntityStoreState>({
		entities: [],
		mentions: [],
		activeCanvasId: null,
	});

	const cacheByCanvasId = new Map<
		string,
		{ entities: Entity[]; mentions: EntityMention[] }
	>();
	let loadToken = 0;

	function cloneEntity(entity: Entity): Entity {
		return { ...entity };
	}

	function cloneMention(mention: EntityMention): EntityMention {
		return { ...mention };
	}

	function snapshotPayload(entities: Entity[], mentions: EntityMention[]) {
		return {
			entities: entities.map(cloneEntity),
			mentions: mentions.map(cloneMention),
		};
	}

	function setState(
		entities: Entity[],
		mentions: EntityMention[],
		activeCanvasId: string | null,
	) {
		set({
			entities: entities.map(cloneEntity),
			mentions: mentions.map(cloneMention),
			activeCanvasId,
		});

		if (activeCanvasId) {
			cacheByCanvasId.set(activeCanvasId, snapshotPayload(entities, mentions));
		}
	}

	return {
		subscribe,

		hydrate(
			entities: Entity[],
			mentions: EntityMention[],
			activeCanvasId: string | null = null,
		) {
			setState(entities, mentions, activeCanvasId);
		},

		async load(canvasId: string) {
			if (!canvasId) {
				setState([], [], null);
				return false;
			}

			const cached = cacheByCanvasId.get(canvasId);
			const requestToken = ++loadToken;

			if (cached) {
				setState(cached.entities, cached.mentions, canvasId);
			} else {
				setState([], [], canvasId);
			}

			try {
				const data = (await appDataClient.loadEntities(canvasId)) as Partial<{
					entities: Entity[];
					mentions: EntityMention[];
				}>;

				if (requestToken !== loadToken) {
					return false;
				}

				const entities = Array.isArray(data.entities) ? data.entities : [];
				const mentions = Array.isArray(data.mentions) ? data.mentions : [];
				cacheByCanvasId.set(canvasId, snapshotPayload(entities, mentions));
				setState(entities, mentions, canvasId);
				return true;
			} catch {
				if (requestToken !== loadToken) {
					return false;
				}

				if (!cached) {
					setState([], [], canvasId);
				}

				return false;
			}
		},
	};
}

export const entityStore = createEntityStore();
