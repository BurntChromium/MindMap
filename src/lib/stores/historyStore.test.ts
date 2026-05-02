import { afterEach, describe, expect, it, vi } from 'vitest';
import { historyStore } from './historyStore';

function snapshot() {
  let current: any;
  const unsubscribe = historyStore.subscribe((value) => {
    current = value;
  });
  unsubscribe();
  return current;
}

afterEach(() => {
  historyStore.clear();
});

describe('historyStore', () => {
  it('replays undo and redo entries', async () => {
    const undo = vi.fn(() => {
      expect(historyStore.isReplaying()).toBe(true);
      return true;
    });
    const redo = vi.fn(() => {
      expect(historyStore.isReplaying()).toBe(true);
      return true;
    });

    historyStore.record({
      label: 'Update node',
      undo,
      redo
    });

    expect(snapshot().undoCount).toBe(1);
    expect(snapshot().redoCount).toBe(0);

    await historyStore.undo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(snapshot().undoCount).toBe(0);
    expect(snapshot().redoCount).toBe(1);

    await historyStore.redo();
    expect(redo).toHaveBeenCalledTimes(1);
    expect(snapshot().undoCount).toBe(1);
    expect(snapshot().redoCount).toBe(0);
  });
});

