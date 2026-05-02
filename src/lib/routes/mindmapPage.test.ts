import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildBulkTagMutations,
  buildTagColorMap,
  getActiveFilterLabel,
  getSearchHitIds,
  shouldBlockCreateNodeShortcut,
  shouldBlockCanvasInteractionShortcut,
  shouldClearFocusedNode,
  shouldCommitCanvasRename,
  toggleActiveTagFilter
} from './mindmapPage';

class TestHTMLElement {
  constructor(private readonly matchesSidebarActions = false) {}

  closest(selector: string) {
    if (selector === '.sidebar-row-actions' && this.matchesSidebarActions) {
      return {};
    }

    return null;
  }
}

let originalHTMLElement: typeof HTMLElement | undefined;

beforeEach(() => {
  originalHTMLElement = globalThis.HTMLElement;
  (globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement =
    TestHTMLElement as unknown as typeof HTMLElement;
});

afterEach(() => {
  (globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement =
    originalHTMLElement as typeof HTMLElement;
});

describe('mindmapPage helpers', () => {
  it('builds the tag color map from summaries', () => {
    expect(
      buildTagColorMap([
        { name: 'lore', color: '#111', count: 2 },
        { name: 'npc', color: '#222', count: 1 }
      ])
    ).toEqual({
      lore: '#111',
      npc: '#222'
    });
  });

  it('formats the active filter label', () => {
    expect(getActiveFilterLabel('', null)).toBe('none');
    expect(getActiveFilterLabel(' dragon ', null)).toBe('"dragon"');
    expect(getActiveFilterLabel('', 'npc')).toBe('#npc');
    expect(getActiveFilterLabel(' dragon ', 'npc')).toBe('"dragon" + #npc');
  });

  it('toggles normalized tag filters', () => {
    expect(toggleActiveTagFilter(null, ' NPC ')).toBe('npc');
    expect(toggleActiveTagFilter('npc', 'npc')).toBeNull();
  });

  it('collects search hit ids from keyword and tag filters', () => {
    expect(
      getSearchHitIds(
        [
          { id: '1', title: 'Dragon cave', body: 'Cold and dark', tags: ['lore', 'Boss'] },
          { id: '2', title: 'Town square', body: 'People gather here', tags: ['npc'] }
        ],
        'dragon',
        null
      )
    ).toEqual(new Set(['1']));

    expect(
      getSearchHitIds(
        [
          { id: '1', title: 'Dragon cave', body: 'Cold and dark', tags: ['lore', 'Boss'] },
          { id: '2', title: 'Town square', body: 'People gather here', tags: ['npc'] }
        ],
        '',
        'npc'
      )
    ).toEqual(new Set(['2']));
  });

  it('builds bulk tag mutations for selected nodes', () => {
    expect(
      buildBulkTagMutations(
        [
          { id: '1', tags: ['lore'] },
          { id: '2', tags: ['npc', 'Guide'] }
        ],
        ['1', '2'],
        ' NPC ',
        'add'
      )
    ).toEqual([{ id: '1', tags: ['lore', 'npc'] }]);

    expect(
      buildBulkTagMutations(
        [
          { id: '1', tags: ['lore', 'npc'] },
          { id: '2', tags: ['guide'] }
        ],
        ['1', '2'],
        'npc',
        'remove'
      )
    ).toEqual([{ id: '1', tags: ['lore'] }]);
  });

  it('clears focused node only when the current filters exclude it', () => {
    expect(shouldClearFocusedNode(null, 'dragon', null, new Set(['1']))).toBe(false);
    expect(shouldClearFocusedNode('1', '', null, new Set(['1']))).toBe(false);
    expect(shouldClearFocusedNode('1', 'dragon', null, new Set(['2']))).toBe(true);
  });

  it('blocks create-node keyboard shortcuts when focus is outside the canvas shell', () => {
    const inside = new TestHTMLElement();
    const outside = new TestHTMLElement();
    const canvasShell = {
      contains: (node: unknown) => node === inside
    } as HTMLElement;

    expect(shouldBlockCreateNodeShortcut(inside as unknown as Element, canvasShell, null)).toBe(
      false
    );
    expect(shouldBlockCreateNodeShortcut(outside as unknown as Element, canvasShell, null)).toBe(
      true
    );
  });

  it('blocks canvas interactions when focus is outside the canvas shell', () => {
    const inside = new TestHTMLElement();
    const outside = new TestHTMLElement();
    const canvasShell = {
      contains: (node: unknown) => node === inside
    } as HTMLElement;

    expect(
      shouldBlockCanvasInteractionShortcut(inside as unknown as Element, canvasShell, null)
    ).toBe(false);
    expect(
      shouldBlockCanvasInteractionShortcut(outside as unknown as Element, canvasShell, null)
    ).toBe(true);
  });

  it('skips canvas rename on blur into row actions', () => {
    expect(shouldCommitCanvasRename(new TestHTMLElement(false) as unknown as EventTarget)).toBe(
      true
    );
    expect(shouldCommitCanvasRename(new TestHTMLElement(true) as unknown as EventTarget)).toBe(
      false
    );
  });
});
