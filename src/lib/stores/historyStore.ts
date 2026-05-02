import { writable } from 'svelte/store';

export type HistoryEntry = {
  label: string;
  undo: () => Promise<boolean | void> | boolean | void;
  redo: () => Promise<boolean | void> | boolean | void;
};

type HistoryState = {
  undoCount: number;
  redoCount: number;
  lastLabel: string | null;
  replaying: boolean;
};

function createHistoryStore() {
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let replayDepth = 0;
  const store = writable<HistoryState>({
    undoCount: 0,
    redoCount: 0,
    lastLabel: null,
    replaying: false
  });
  const { subscribe, set } = store;

  function syncState(lastLabel: string | null = null) {
    set({
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      lastLabel,
      replaying: replayDepth > 0
    });
  }

  async function runEntry(entry: HistoryEntry, runner: 'undo' | 'redo') {
    replayDepth += 1;
    syncState(entry.label);

    try {
      const result = await entry[runner]();
      return result !== false;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      replayDepth = Math.max(0, replayDepth - 1);
      syncState(entry.label);
    }
  }

  return {
    subscribe,

    record(entry: HistoryEntry) {
      if (replayDepth > 0) {
        return;
      }

      undoStack.push(entry);
      redoStack.length = 0;
      syncState(entry.label);
    },

    async undo() {
      const entry = undoStack.pop();

      if (!entry) {
        syncState(null);
        return false;
      }

      const success = await runEntry(entry, 'undo');

      if (!success) {
        undoStack.push(entry);
        syncState(entry.label);
        return false;
      }

      redoStack.push(entry);
      syncState(entry.label);
      return true;
    },

    async redo() {
      const entry = redoStack.pop();

      if (!entry) {
        syncState(null);
        return false;
      }

      const success = await runEntry(entry, 'redo');

      if (!success) {
        redoStack.push(entry);
        syncState(entry.label);
        return false;
      }

      undoStack.push(entry);
      syncState(entry.label);
      return true;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      syncState(null);
    },

    isReplaying() {
      return replayDepth > 0;
    }
  };
}

export const historyStore = createHistoryStore();
