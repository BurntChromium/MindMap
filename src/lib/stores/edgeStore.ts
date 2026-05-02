import { get, writable } from 'svelte/store';
import { appDataClient } from '$lib/appDataClient';
import { buildEdgeCreateBody } from '$lib/mutationPayloads';
import { historyStore } from '$lib/stores/historyStore';
import { mutationStateStore } from '$lib/stores/mutationStateStore';

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
      mutationStateStore.beginLoad();

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
        const data = (await appDataClient.loadEdges(canvasId)) as Edge[];

        if (requestToken !== loadToken) {
          mutationStateStore.finishLoad(true);
          return false;
        }

        cacheByCanvasId.set(canvasId, data.map(cloneEdge));
        set({
          edges: edgesToMap(data),
          activeCanvasId: canvasId
        });
        mutationStateStore.finishLoad(true);
        return true;
      } catch {
        if (requestToken !== loadToken) {
          mutationStateStore.finishLoad(true);
          return false;
        }

        if (!cached && current.activeCanvasId === canvasId) {
          syncCache();
        }

        mutationStateStore.finishLoad(false, `Failed to load edges for ${canvasId}`);
        return false;
      }
    },

    async create(canvasId: string, source: string, target: string, providedId?: string) {
      const id = providedId ?? `e-${source}-${target}`;
      const newEdge: Edge = {
        id,
        canvas_id: canvasId,
        source_node_id: source,
        target_node_id: target
      };
      const previous = snapshotState();
      mutationStateStore.beginWrite();

      update((state) => {
        state.edges.set(id, newEdge);
        state.activeCanvasId = canvasId;
        return state;
      });
      syncCache();

      try {
        await appDataClient.createEdge(buildEdgeCreateBody({ id, canvasId, source, target }));

        if (!historyStore.isReplaying()) {
          historyStore.record({
            label: 'Create edge',
            undo: async () => edgeStore.remove(id),
            redo: async () => edgeStore.create(canvasId, source, target, id)
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        mutationStateStore.finishWrite(false, `Create edge failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    },

    async remove(id: string) {
      const previous = snapshotState();
      const removedEdge = previous.edges.get(id);
      mutationStateStore.beginWrite();

      update((state) => {
        state.edges.delete(id);
        return state;
      });

      syncCache();

      try {
        await appDataClient.deleteEdge({ id });

        if (removedEdge && !historyStore.isReplaying()) {
          historyStore.record({
            label: 'Delete edge',
            undo: async () =>
              edgeStore.create(
                removedEdge.canvas_id,
                removedEdge.source_node_id,
                removedEdge.target_node_id,
                removedEdge.id
              ),
            redo: async () => edgeStore.remove(removedEdge.id)
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        mutationStateStore.finishWrite(false, `Delete edge failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    }
  };
}

export const edgeStore = createEdgeStore();
