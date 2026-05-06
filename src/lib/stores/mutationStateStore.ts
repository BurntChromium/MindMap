import { writable } from 'svelte/store';

export type MutationPhase = 'loading' | 'syncing' | 'synced' | 'failed';

type MutationState = {
	loadCount: number;
	writeCount: number;
	lastError: string | null;
	lastSuccessAt: number | null;
};

function derivePhase(state: MutationState): MutationPhase {
	if (state.loadCount > 0) {
		return 'loading';
	}

	if (state.writeCount > 0) {
		return 'syncing';
	}

	if (state.lastError) {
		return 'failed';
	}

	return 'synced';
}

function createMutationStateStore() {
	const store = writable<MutationState>({
		loadCount: 0,
		writeCount: 0,
		lastError: null,
		lastSuccessAt: null,
	});

	const { subscribe, update } = store;

	function bumpLoad(delta: number, success?: boolean, error?: string) {
		update((state) => {
			const next: MutationState = {
				...state,
				loadCount: Math.max(0, state.loadCount + delta),
			};

			if (success === true) {
				next.lastError = null;
				next.lastSuccessAt = Date.now();
			}

			if (success === false) {
				next.lastError = error ?? 'Load failed';
			}

			return next;
		});
	}

	function bumpWrite(delta: number, success?: boolean, error?: string) {
		update((state) => {
			const next: MutationState = {
				...state,
				writeCount: Math.max(0, state.writeCount + delta),
			};

			if (success === true) {
				next.lastError = null;
				next.lastSuccessAt = Date.now();
			}

			if (success === false) {
				next.lastError = error ?? 'Write failed';
			}

			return next;
		});
	}

	return {
		subscribe: (
			run: (value: MutationState & { phase: MutationPhase }) => void,
		) => subscribe((state) => run({ ...state, phase: derivePhase(state) })),
		beginLoad() {
			bumpLoad(1);
		},
		finishLoad(success = true, error?: string) {
			bumpLoad(-1, success, error);
		},
		beginWrite() {
			bumpWrite(1);
		},
		finishWrite(success = true, error?: string) {
			bumpWrite(-1, success, error);
		},
		clearError() {
			update((state) => ({ ...state, lastError: null }));
		},
	};
}

export const mutationStateStore = createMutationStateStore();
