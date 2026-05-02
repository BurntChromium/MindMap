import { describe, expect, it } from 'vitest';
import { getNearestNodeInDirection } from './navigation';

describe('navigation helpers', () => {
  it('finds the nearest node in each direction', () => {
    expect(
      getNearestNodeInDirection(
        [
          { id: 'origin', x: 100, y: 100 },
          { id: 'left-close', x: 40, y: 110 },
          { id: 'left-far', x: 20, y: 105 }
        ],
        'origin',
        'left'
      )
    ).toBe('left-close');

    expect(
      getNearestNodeInDirection(
        [
          { id: 'origin', x: 100, y: 100 },
          { id: 'right-close', x: 180, y: 95 },
          { id: 'right-far', x: 220, y: 130 }
        ],
        'origin',
        'right'
      )
    ).toBe('right-close');

    expect(
      getNearestNodeInDirection(
        [
          { id: 'origin', x: 100, y: 100 },
          { id: 'up-close', x: 102, y: 20 },
          { id: 'up-far', x: 130, y: 10 }
        ],
        'origin',
        'up'
      )
    ).toBe('up-close');

    expect(
      getNearestNodeInDirection(
        [
          { id: 'origin', x: 100, y: 100 },
          { id: 'down-close', x: 110, y: 200 },
          { id: 'down-far', x: 140, y: 250 }
        ],
        'origin',
        'down'
      )
    ).toBe('down-close');
  });

  it('returns null when there is no candidate in the requested direction', () => {
    expect(
      getNearestNodeInDirection(
        [
          { id: 'origin', x: 100, y: 100 },
          { id: 'same-row-right', x: 120, y: 100 }
        ],
        'origin',
        'left'
      )
    ).toBeNull();
  });

  it('prefers the smallest projected distance and breaks ties with perpendicular distance', () => {
    expect(
      getNearestNodeInDirection(
        [
          { id: 'origin', x: 0, y: 0 },
          { id: 'candidate-a', x: 10, y: 100 },
          { id: 'candidate-b', x: 10, y: 20 }
        ],
        'origin',
        'right'
      )
    ).toBe('candidate-b');
  });
});
