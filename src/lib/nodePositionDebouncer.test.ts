import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodePositionDebouncer } from './nodePositionDebouncer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createNodePositionDebouncer', () => {
  it('keeps the latest position for each node until the debounce flushes', async () => {
    const applyUpdates = vi.fn().mockResolvedValue(undefined);
    const onFlushSettled = vi.fn();
    const debouncer = createNodePositionDebouncer(applyUpdates, 100, onFlushSettled);

    debouncer.queue([{ id: 'node-1', x: 10, y: 20 }]);
    debouncer.queue([
      { id: 'node-1', x: 34, y: 48 },
      { id: 'node-2', x: 5, y: 6 }
    ]);

    expect(debouncer.getPendingPosition('node-1', { x: 0, y: 0 })).toEqual({ x: 34, y: 48 });
    expect(debouncer.getPendingPosition('node-2', { x: 0, y: 0 })).toEqual({ x: 5, y: 6 });
    expect(applyUpdates).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(applyUpdates).toHaveBeenCalledTimes(1);
    expect(applyUpdates).toHaveBeenCalledWith([
      { id: 'node-1', x: 34, y: 48 },
      { id: 'node-2', x: 5, y: 6 }
    ]);
    expect(onFlushSettled).toHaveBeenCalledWith([
      { id: 'node-1', x: 34, y: 48 },
      { id: 'node-2', x: 5, y: 6 }
    ]);
  });
});
