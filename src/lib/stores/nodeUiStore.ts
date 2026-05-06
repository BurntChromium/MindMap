import { writable } from 'svelte/store';

export type NodeUiState = {
	editingNodeId: string | null;
	expandedNodeIds: Record<string, true>;
};

export type NodeMode = 'compact' | 'view' | 'edit';

// Compact = default summary state, view = expanded read-only, edit = expanded editor.
export function getNodeMode(state: NodeUiState, id: string): NodeMode {
	if (state.editingNodeId === id) {
		return 'edit';
	}

	return state.expandedNodeIds[id] ? 'view' : 'compact';
}

function createNodeUiStore() {
	const { subscribe, set, update } = writable<NodeUiState>({
		editingNodeId: null,
		expandedNodeIds: {},
	});

	return {
		subscribe,

		beginEdit(id: string) {
			update((state) => ({
				editingNodeId: id,
				expandedNodeIds: {
					...state.expandedNodeIds,
					[id]: true,
				},
			}));
		},

		endEdit(id: string) {
			update((state) => ({
				editingNodeId: state.editingNodeId === id ? null : state.editingNodeId,
				expandedNodeIds: state.expandedNodeIds,
			}));
		},

		clear() {
			set({ editingNodeId: null, expandedNodeIds: {} });
		},

		toggleExpanded(id: string) {
			update((state) => {
				const expandedNodeIds = { ...state.expandedNodeIds };

				if (expandedNodeIds[id]) {
					delete expandedNodeIds[id];
				} else {
					expandedNodeIds[id] = true;
				}

				return {
					...state,
					expandedNodeIds,
				};
			});
		},

		setExpanded(id: string, expanded: boolean) {
			update((state) => {
				const expandedNodeIds = { ...state.expandedNodeIds };

				if (expanded) {
					expandedNodeIds[id] = true;
				} else {
					delete expandedNodeIds[id];
				}

				return {
					...state,
					expandedNodeIds,
				};
			});
		},
	};
}

export const nodeUiStore = createNodeUiStore();
