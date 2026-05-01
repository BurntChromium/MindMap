import { writable } from 'svelte/store';

export type Canvas = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

function createCanvasStore() {
  const { subscribe, set, update } = writable<{
    canvases: Canvas[];
    activeCanvasId: string | null;
  }>({
    canvases: [],
    activeCanvasId: null
  });

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
      const res = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      const canvas = await res.json();

      update((state) => ({
        canvases: [canvas, ...state.canvases],
        activeCanvasId: canvas.id
      }));
    },

    async remove(id: string) {
      await fetch(`/api/canvases?id=${id}`, { method: 'DELETE' });

      update((state) => {
        const filtered = state.canvases.filter((c) => c.id !== id);

        return {
          canvases: filtered,
          activeCanvasId: filtered[0]?.id ?? null
        };
      });
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
