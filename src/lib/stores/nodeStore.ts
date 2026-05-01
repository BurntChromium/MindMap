import { get, writable } from 'svelte/store';
import { createClientId } from '$lib/clientId';

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
  const store = writable<{
    nodes: Map<string, Node>;
    activeCanvasId: string | null;
  }>({
    nodes: new Map(),
    activeCanvasId: null
  });
  const { subscribe, set, update } = store;
  const cacheByCanvasId = new Map<string, Node[]>();
  let loadToken = 0;

  function cloneNode(node: Node): Node {
    return {
      ...node,
      tags: [...node.tags]
    };
  }

  function snapshotNodes(nodes: Map<string, Node>) {
    return Array.from(nodes.values()).map(cloneNode);
  }

  function nodesToMap(nodes: Node[]) {
    const map = new Map<string, Node>();

    for (const node of nodes) {
      map.set(node.id, cloneNode(node));
    }

    return map;
  }

  function snapshotState(state = get(store)) {
    return {
      nodes: nodesToMap(snapshotNodes(state.nodes)),
      activeCanvasId: state.activeCanvasId
    };
  }

  function syncCache(state = get(store)) {
    if (!state.activeCanvasId) {
      return;
    }

    cacheByCanvasId.set(state.activeCanvasId, snapshotNodes(state.nodes));
  }

  function replaceState(nodes: Node[], activeCanvasId: string | null) {
    set({
      nodes: nodesToMap(nodes),
      activeCanvasId
    });

    if (activeCanvasId) {
      cacheByCanvasId.set(activeCanvasId, nodes.map(cloneNode));
    }
  }

  return {
    subscribe,

    hydrate(nodes: Node[], activeCanvasId: string | null = null) {
      replaceState(nodes, activeCanvasId);
    },

    async load(canvasId: string) {
      const current = get(store);
      const cached = cacheByCanvasId.get(canvasId);
      const requestToken = ++loadToken;

      if (current.activeCanvasId && current.activeCanvasId !== canvasId) {
        cacheByCanvasId.set(current.activeCanvasId, snapshotNodes(current.nodes));
      }

      if (cached) {
        set({
          nodes: nodesToMap(cached),
          activeCanvasId: canvasId
        });
      } else if (current.activeCanvasId !== canvasId) {
        set({
          nodes: new Map(),
          activeCanvasId: canvasId
        });
      }

      try {
        const res = await fetch(`/api/nodes?canvasId=${canvasId}`);
        const data: Array<Node & { tags?: unknown }> = await res.json();

        if (requestToken !== loadToken) {
          return;
        }

        const normalized = data.map((node) => ({
          ...node,
          tags: Array.isArray(node.tags) ? node.tags : []
        }));

        cacheByCanvasId.set(canvasId, normalized.map(cloneNode));
        set({
          nodes: nodesToMap(normalized),
          activeCanvasId: canvasId
        });
      } catch {
        if (requestToken !== loadToken) {
          return;
        }

        if (!cached && current.activeCanvasId === canvasId) {
          syncCache();
        }
      }
    },

    async create(canvasId: string, x = 0, y = 0) {
      const id = createClientId('node');
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
      const previous = snapshotState();

      update((state) => {
        state.nodes.set(id, newNode);
        state.activeCanvasId = canvasId;
        return state;
      });
      syncCache();

      try {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, canvasId, x, y })
        });

        if (!res.ok) {
          throw new Error(`Create node failed with ${res.status}`);
        }

        cacheByCanvasId.set(canvasId, snapshotNodes(get(store).nodes));
      } catch (error) {
        set(previous);
        syncCache(previous);
        console.error(error);
        return;
      }
    },

    async updateNode(partial: Partial<Node> & { id: string }) {
      const previous = snapshotState();

      update((state) => {
        const existing = state.nodes.get(partial.id);
        if (existing) {
          state.nodes.set(partial.id, { ...existing, ...partial });
        }
        return state;
      });

      try {
        const response = await fetch('/api/nodes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial)
        });

        if (!response.ok) {
          throw new Error(`Update node failed with ${response.status}`);
        }
      } catch (error) {
        set(previous);
        syncCache(previous);
        console.error(error);
        return;
      }

      syncCache();
    },

    async remove(id: string) {
      const previous = snapshotState();

      update((state) => {
        state.nodes.delete(id);
        return state;
      });

      syncCache();

      try {
        const res = await fetch(`/api/nodes?id=${id}`, { method: 'DELETE' });

        if (!res.ok) {
          throw new Error(`Delete node failed with ${res.status}`);
        }
      } catch (error) {
        set(previous);
        syncCache(previous);
        console.error(error);
        return;
      }
    }
  };
}

export const nodeStore = createNodeStore();
