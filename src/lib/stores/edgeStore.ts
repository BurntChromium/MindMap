import { get, writable } from 'svelte/store';

export type Edge = {
  id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
};

function createEdgeStore() {
  const store = writable<{
    edges: Map<string, Edge>;
    activeCanvasId: string | null;
  }>({
    edges: new Map(),
    activeCanvasId: null
  });
  const { subscribe, set, update } = store;
  const cacheByCanvasId = new Map<string, Edge[]>();
  let loadToken = 0;

  function cloneEdge(edge: Edge): Edge {
    return { ...edge };
  }

  function snapshotEdges(edges: Map<string, Edge>) {
    return Array.from(edges.values()).map(cloneEdge);
  }

  function edgesToMap(edges: Edge[]) {
    const map = new Map<string, Edge>();

    for (const edge of edges) {
      map.set(edge.id, cloneEdge(edge));
    }

    return map;
  }

  function snapshotState(state = get(store)) {
    return {
      edges: edgesToMap(snapshotEdges(state.edges)),
      activeCanvasId: state.activeCanvasId
    };
  }

  function syncCache(state = get(store)) {
    if (!state.activeCanvasId) {
      return;
    }

    cacheByCanvasId.set(state.activeCanvasId, snapshotEdges(state.edges));
  }

  return {
    subscribe,

    hydrate(edges: Edge[], activeCanvasId: string | null = null) {
      set({
        edges: edgesToMap(edges),
        activeCanvasId
      });

      if (activeCanvasId) {
        cacheByCanvasId.set(activeCanvasId, edges.map(cloneEdge));
      }
    },

    async load(canvasId: string) {
      const current = get(store);
      const cached = cacheByCanvasId.get(canvasId);
      const requestToken = ++loadToken;

      if (current.activeCanvasId && current.activeCanvasId !== canvasId) {
        cacheByCanvasId.set(current.activeCanvasId, snapshotEdges(current.edges));
      }

      if (cached) {
        set({
          edges: edgesToMap(cached),
          activeCanvasId: canvasId
        });
      } else if (current.activeCanvasId !== canvasId) {
        set({
          edges: new Map(),
          activeCanvasId: canvasId
        });
      }

      try {
        const res = await fetch(`/api/edges?canvasId=${canvasId}`);
        const data: Edge[] = await res.json();

        if (requestToken !== loadToken) {
          return;
        }

        cacheByCanvasId.set(canvasId, data.map(cloneEdge));
        set({
          edges: edgesToMap(data),
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

    async create(canvasId: string, source: string, target: string) {
      const id = `e-${source}-${target}`;
      const newEdge: Edge = {
        id,
        canvas_id: canvasId,
        source_node_id: source,
        target_node_id: target
      };
      const previous = snapshotState();

      update((state) => {
        state.edges.set(id, newEdge);
        state.activeCanvasId = canvasId;
        return state;
      });
      syncCache();

      try {
        const res = await fetch('/api/edges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, canvasId, source, target })
        });

        if (!res.ok) {
          throw new Error(`Create edge failed with ${res.status}`);
        }
      } catch (error) {
        set(previous);
        syncCache(previous);
        console.error(error);
        return;
      }
    },

    async remove(id: string) {
      const previous = snapshotState();

      update((state) => {
        state.edges.delete(id);
        return state;
      });

      syncCache();

      try {
        const res = await fetch(`/api/edges?id=${id}`, { method: 'DELETE' });

        if (!res.ok) {
          throw new Error(`Delete edge failed with ${res.status}`);
        }
      } catch (error) {
        set(previous);
        syncCache(previous);
        console.error(error);
      }
    }
  };
}

export const edgeStore = createEdgeStore();
