import { writable } from 'svelte/store';

function createNodeUiStore() {
  const { subscribe, set, update } = writable<{
    editingNodeId: string | null;
    expandedNodeIds: Record<string, true>;
  }>({
    editingNodeId: null,
    expandedNodeIds: {}
  });

  return {
    subscribe,

    beginEdit(id: string) {
      update((state) => ({
        editingNodeId: id,
        expandedNodeIds: {
          ...state.expandedNodeIds,
          [id]: true
        }
      }));
    },

    endEdit(id: string) {
      update((state) => ({
        editingNodeId: state.editingNodeId === id ? null : state.editingNodeId,
        expandedNodeIds: state.expandedNodeIds
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
          expandedNodeIds
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
          expandedNodeIds
        };
      });
    }
  };
}

export const nodeUiStore = createNodeUiStore();
