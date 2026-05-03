import { describe, expect, it } from 'vitest';
import { getCanvasBoundsCenter, getNodeFocusPoint } from './canvasCenter';

describe('getCanvasBoundsCenter', () => {
  it('returns the midpoint of a rectangular node bounds box', () => {
    expect(getCanvasBoundsCenter({ x: 120, y: 80, width: 400, height: 240 })).toEqual({
      x: 320,
      y: 200
    });
  });
});

describe('getNodeFocusPoint', () => {
  it('centers compact nodes on their middle', () => {
    expect(getNodeFocusPoint({ x: 120, y: 80 }, 'compact')).toEqual({
      x: 210,
      y: 136
    });
  });

  it('biases edit nodes to the right while keeping them vertically centered', () => {
    expect(getNodeFocusPoint({ x: 120, y: 80 }, 'edit')).toEqual({
      x: 420,
      y: 188
    });
  });
});
