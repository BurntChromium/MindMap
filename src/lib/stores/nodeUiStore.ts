import { writable } from 'svelte/store';

function createNodeUiStore() {
  const { subscribe, set, update } = writable<{
    editingNodeId: string | null;
  }>({
    editingNodeId: null
  });

  return {
    subscribe,

    beginEdit(id: string) {
      set({ editingNodeId: id });
    },

    endEdit(id: string) {
      update((state) => ({
        editingNodeId: state.editingNodeId === id ? null : state.editingNodeId
      }));
    },

    clear() {
      set({ editingNodeId: null });
    }
  };
}

export const nodeUiStore = createNodeUiStore();
