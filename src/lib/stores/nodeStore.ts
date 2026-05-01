import { writable } from 'svelte/store';

export type Node = {
  id: string;
  canvas_id: string;
  title: string;
  body: string;
  tags: string[];
  x: number;
  y: number;
  collapsed: number;
};

function createNodeStore() {
  const { subscribe, set, update } = writable<{
    nodes: Map<string, Node>;
  }>({
    nodes: new Map()
  });

  return {
    subscribe,

    hydrate(nodes: Node[]) {
      const map = new Map<string, Node>();
      for (const node of nodes) {
        map.set(node.id, node);
      }

      set({ nodes: map });
    },

    async load(canvasId: string) {
      const res = await fetch(`/api/nodes?canvasId=${canvasId}`);
      const data: Array<Node & { tags?: unknown }> = await res.json();

      const map = new Map<string, Node>();
      for (const node of data) {
        map.set(node.id, {
          ...node,
          tags: Array.isArray(node.tags) ? node.tags : []
        });
      }

      set({ nodes: map });
    },

    async create(canvasId: string, x = 0, y = 0) {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasId, x, y })
      });

      const { id } = await res.json();

      const newNode: Node = {
        id,
        canvas_id: canvasId,
        title: 'New Node',
        body: '',
        tags: [],
        x,
        y,
        collapsed: 0
      };

      update((state) => {
        state.nodes.set(id, newNode);
        return state;
      });
    },

    async updateNode(partial: Partial<Node> & { id: string }) {
      // optimistic update
      update((state) => {
        const existing = state.nodes.get(partial.id);
        if (existing) {
          state.nodes.set(partial.id, { ...existing, ...partial });
        }
        return state;
      });

      await fetch('/api/nodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial)
      });
    },

    async remove(id: string) {
      await fetch(`/api/nodes?id=${id}`, { method: 'DELETE' });

      update((state) => {
        state.nodes.delete(id);
        return state;
      });
    }
  };
}

export const nodeStore = createNodeStore();
