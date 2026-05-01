import { get, writable } from 'svelte/store';
import { createClientId } from '$lib/clientId';

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
      const res = await fetch('/api/canvases');
      const canvases = await res.json();

      set({
        canvases,
        activeCanvasId: canvases[0]?.id ?? null
      });
    },

    async create(name: string) {
      const id = createClientId('canvas');
      const timestamp = Date.now();
      const previous = snapshotState();
      const newCanvas: Canvas = {
        id,
        name,
        created_at: timestamp,
        updated_at: timestamp
      };

      update((state) => ({
        canvases: [newCanvas, ...state.canvases],
        activeCanvasId: id
      }));

      try {
        const res = await fetch('/api/canvases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name })
        });

        if (!res.ok) {
          throw new Error(`Create canvas failed with ${res.status}`);
        }
      } catch (error) {
        set(previous);
        console.error(error);
        return;
      }
    },

    async rename(id: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }

      const previous = snapshotState();

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
          body: JSON.stringify({ id, name: trimmed })
        });

        if (!res.ok) {
          throw new Error(`Rename canvas failed with ${res.status}`);
        }
      } catch (error) {
        set(previous);
        console.error(error);
      }
    },

    async remove(id: string) {
      const previous = snapshotState();
      const filtered = previous.canvases.filter((c) => c.id !== id);
      const activeCanvasId =
        previous.activeCanvasId === id ? filtered[0]?.id ?? null : previous.activeCanvasId;

      set({
        canvases: filtered,
        activeCanvasId
      });

      try {
        const res = await fetch(`/api/canvases?id=${id}`, { method: 'DELETE' });

        if (!res.ok) {
          throw new Error(`Delete canvas failed with ${res.status}`);
        }
      } catch (error) {
        set(previous);
        console.error(error);
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
