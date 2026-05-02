import { get, writable } from 'svelte/store';
import { createClientId } from '$lib/clientId';
import { buildCanvasCreateBody, buildCanvasPatchBody } from '$lib/mutationPayloads';
import { historyStore } from '$lib/stores/historyStore';
import { mutationStateStore } from '$lib/stores/mutationStateStore';

export type Canvas = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

function createCanvasStore() {
  const store = writable<{
    canvases: Canvas[];
    activeCanvasId: string | null;
  }>({
    canvases: [],
    activeCanvasId: null
  });
  const { subscribe, set, update } = store;

  function snapshotState(state = get(store)) {
    return {
      canvases: state.canvases.map((canvas) => ({ ...canvas })),
      activeCanvasId: state.activeCanvasId
    };
  }

  return {
    subscribe,

    hydrate(canvases: Canvas[], activeCanvasId: string | null) {
      set({
        canvases,
        activeCanvasId
      });
    },

    async load() {
      mutationStateStore.beginLoad();
      try {
        const res = await fetch('/api/canvases');
        const canvases = await res.json();

        set({
          canvases,
          activeCanvasId: canvases[0]?.id ?? null
        });
        mutationStateStore.finishLoad(true);
        return true;
      } catch (error) {
        mutationStateStore.finishLoad(false, `Failed to load canvases: ${String(error)}`);
        console.error(error);
        return false;
      }
    },

    async create(name: string, providedId?: string) {
      const id = providedId ?? createClientId('canvas');
      const timestamp = Date.now();
      const previous = snapshotState();
      const newCanvas: Canvas = {
        id,
        name,
        created_at: timestamp,
        updated_at: timestamp
      };
      mutationStateStore.beginWrite();

      update((state) => ({
        canvases: [newCanvas, ...state.canvases],
        activeCanvasId: id
      }));

      try {
        const res = await fetch('/api/canvases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCanvasCreateBody({ id, name }))
        });

        if (!res.ok) {
          throw new Error(`Create canvas failed with ${res.status}`);
        }

        if (!historyStore.isReplaying()) {
          historyStore.record({
            label: 'Create canvas',
            undo: async () => canvasStore.remove(id),
            redo: async () => canvasStore.create(name, id)
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        mutationStateStore.finishWrite(false, `Create canvas failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    },

    async rename(id: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) {
        return false;
      }

      const previous = snapshotState();
      const existing = previous.canvases.find((canvas) => canvas.id === id);
      mutationStateStore.beginWrite();

      update((state) => ({
        ...state,
        canvases: state.canvases.map((canvas) =>
          canvas.id === id
            ? {
                ...canvas,
                name: trimmed
              }
            : canvas
        )
      }));

      try {
        const res = await fetch('/api/canvases', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCanvasPatchBody({ id, name: trimmed }))
        });

        if (!res.ok) {
          throw new Error(`Rename canvas failed with ${res.status}`);
        }

        if (existing && !historyStore.isReplaying()) {
          historyStore.record({
            label: 'Rename canvas',
            undo: async () => canvasStore.rename(id, existing.name),
            redo: async () => canvasStore.rename(id, trimmed)
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        mutationStateStore.finishWrite(false, `Rename canvas failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    },

    async remove(id: string) {
      const previous = snapshotState();
      const filtered = previous.canvases.filter((c) => c.id !== id);
      const activeCanvasId =
        previous.activeCanvasId === id ? filtered[0]?.id ?? null : previous.activeCanvasId;
      const removedCanvas = previous.canvases.find((canvas) => canvas.id === id);
      mutationStateStore.beginWrite();

      set({
        canvases: filtered,
        activeCanvasId
      });

      try {
        const res = await fetch(`/api/canvases?id=${id}`, { method: 'DELETE' });

        if (!res.ok) {
          throw new Error(`Delete canvas failed with ${res.status}`);
        }

        if (removedCanvas && !historyStore.isReplaying()) {
          historyStore.record({
            label: 'Delete canvas',
            undo: async () => canvasStore.create(removedCanvas.name, removedCanvas.id),
            redo: async () => canvasStore.remove(removedCanvas.id)
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        mutationStateStore.finishWrite(false, `Delete canvas failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    },

    setActive(id: string) {
      update((state) => ({
        ...state,
        activeCanvasId: id
      }));
    }
  };
}

export const canvasStore = createCanvasStore();
