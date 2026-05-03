import { describe, expect, it } from 'vitest';
import { getCanvasBoundsCenter } from './canvasCenter';

describe('getCanvasBoundsCenter', () => {
  it('returns the midpoint of a rectangular node bounds box', () => {
    expect(getCanvasBoundsCenter({ x: 120, y: 80, width: 400, height: 240 })).toEqual({
      x: 320,
      y: 200
    });
  });
});
