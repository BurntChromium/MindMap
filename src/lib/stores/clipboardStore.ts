import { writable } from 'svelte/store';
import type { ClipboardFragmentV1 } from '$lib/graph/clipboard';

export type ClipboardState = {
	fragment: ClipboardFragmentV1 | null;
	pasteCount: number;
};

function createClipboardStore() {
	const { subscribe, set, update } = writable<ClipboardState>({
		fragment: null,
		pasteCount: 0,
	});

	return {
		subscribe,

		setFragment(fragment: ClipboardFragmentV1) {
			set({
				fragment,
				pasteCount: 0,
			});
		},

		incrementPasteCount() {
			update((state) => ({
				...state,
				pasteCount: state.pasteCount + 1,
			}));
		},

		clear() {
			set({
				fragment: null,
				pasteCount: 0,
			});
		},
	};
}

export const clipboardStore = createClipboardStore();
