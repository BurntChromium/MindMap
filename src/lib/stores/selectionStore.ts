import { writable } from 'svelte/store';

function normalizeIds(ids: Iterable<string>) {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const id of ids) {
		if (!id || seen.has(id)) {
			continue;
		}

		seen.add(id);
		normalized.push(id);
	}

	return normalized;
}

function createSelectionStore() {
	const { subscribe, set, update } = writable<string[]>([]);

	return {
		subscribe,

		setSelection(ids: Iterable<string>) {
			set(normalizeIds(ids));
		},

		selectNode(id: string) {
			set(id ? [id] : []);
		},

		toggleNode(id: string) {
			update((selectedIds) => {
				const next = selectedIds.includes(id)
					? selectedIds.filter((currentId) => currentId !== id)
					: [...selectedIds, id];

				return normalizeIds(next);
			});
		},

		selectAll(ids: Iterable<string>) {
			set(normalizeIds(ids));
		},

		clear() {
			set([]);
		},
	};
}

export const selectionStore = createSelectionStore();
