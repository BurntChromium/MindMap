import { writable } from 'svelte/store';

export type NodeUiState = {
	editingNodeId: string | null;
	expandedNodeIds: Record<string, true>;
	discardPrompt: NodeEditDiscardPrompt | null;
};

export type NodeMode = 'compact' | 'view' | 'edit';

export type NodeEditDiscardField = 'title' | 'tag' | 'body';

export type NodeEditDiscardPrompt = {
	nodeId: string;
	field: NodeEditDiscardField;
};

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
		discardPrompt: null,
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
				discardPrompt: null,
			}));
		},

		endEdit(id: string) {
			update((state) => ({
				editingNodeId: state.editingNodeId === id ? null : state.editingNodeId,
				expandedNodeIds: state.expandedNodeIds,
				discardPrompt:
					state.discardPrompt?.nodeId === id ? null : state.discardPrompt,
			}));
		},

		endEditCollapsed(id: string) {
			update((state) => {
				const expandedNodeIds = { ...state.expandedNodeIds };
				delete expandedNodeIds[id];

				return {
					editingNodeId: state.editingNodeId === id ? null : state.editingNodeId,
					expandedNodeIds,
					discardPrompt:
						state.discardPrompt?.nodeId === id ? null : state.discardPrompt,
				};
			});
		},

		requestDiscardPrompt(nodeId: string, field: NodeEditDiscardField) {
			update((state) => {
				if (state.editingNodeId !== nodeId) {
					return state;
				}

				return {
					...state,
					discardPrompt: {
						nodeId,
						field,
					},
				};
			});
		},

		clearDiscardPrompt() {
			update((state) => ({
				...state,
				discardPrompt: null,
			}));
		},

		clear() {
			set({ editingNodeId: null, expandedNodeIds: {}, discardPrompt: null });
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
