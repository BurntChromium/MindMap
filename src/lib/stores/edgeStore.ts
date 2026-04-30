import { writable } from 'svelte/store';

export type Edge = {
  id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
};

function createEdgeStore() {
  const { subscribe, set, update } = writable<{
    edges: Map<string, Edge>;
  }>({
    edges: new Map()
  });

  return {
    subscribe,

    async load(canvasId: string) {
      const res = await fetch(`/api/edges?canvasId=${canvasId}`);
      const data: Edge[] = await res.json();

      const map = new Map<string, Edge>();
      for (const edge of data) {
        map.set(edge.id, edge);
      }

      set({ edges: map });
    },

    async create(canvasId: string, source: string, target: string) {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasId, source, target })
      });

      const { id } = await res.json();

      const newEdge: Edge = {
        id,
        canvas_id: canvasId,
        source_node_id: source,
        target_node_id: target
      };

      update((state) => {
        state.edges.set(id, newEdge);
        return state;
      });
    },

    async remove(id: string) {
      await fetch(`/api/edges?id=${id}`, { method: 'DELETE' });

      update((state) => {
        state.edges.delete(id);
        return state;
      });
    }
  };
}

export const edgeStore = createEdgeStore();
