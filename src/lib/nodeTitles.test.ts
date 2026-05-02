import { describe, expect, it } from 'vitest';
import {
  createNodeTitleAllocator,
  hasNodeTitleConflict,
  resolveUniqueNodeTitle
} from './nodeTitles';

describe('nodeTitles', () => {
  it('treats titles as unique within a canvas regardless of case', () => {
    expect(
      hasNodeTitleConflict(
        [
          { id: 'node-1', title: 'Smaug' },
          { id: 'node-2', title: 'Guide' }
        ],
        'smaug'
      )
    ).toBe(true);
  });

  it('enumerates brand new node titles', () => {
    expect(resolveUniqueNodeTitle([], '')).toBe('Node 1');
    expect(
      createNodeTitleAllocator([{ id: 'node-1', title: 'Node 1' }]).nextEnumeratedTitle('Node')
    ).toBe('Node 2');
  });

  it('suffixes copied titles with OS-style numbering', () => {
    const allocator = createNodeTitleAllocator([
      { id: 'node-1', title: 'Smaug' },
      { id: 'node-2', title: 'Smaug (1)' }
    ]);

    expect(allocator.nextCopyTitle('Smaug')).toBe('Smaug (2)');
  });

  it('preserves an available copied title', () => {
    expect(resolveUniqueNodeTitle([], 'Guide')).toBe('Guide');
  });
});
