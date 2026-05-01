import { afterEach, describe, expect, it } from 'vitest';
import { getNodeMode, nodeUiStore } from './nodeUiStore';

function snapshot() {
  let current: { editingNodeId: string | null; expandedNodeIds: Record<string, true> } = {
    editingNodeId: null,
    expandedNodeIds: {}
  };

  const unsubscribe = nodeUiStore.subscribe((value) => {
    current = value;
  });

  unsubscribe();
  return current;
}

afterEach(() => {
  nodeUiStore.clear();
});

describe('nodeUiStore', () => {
  it('tracks the active editor and forces it open', () => {
    nodeUiStore.beginEdit('node-1');

    const state = snapshot();
    expect(state.editingNodeId).toBe('node-1');
    expect(state.expandedNodeIds['node-1']).toBe(true);
    expect(getNodeMode(state, 'node-1')).toBe('edit');
  });

  it('derives compact and view modes from expansion state', () => {
    expect(getNodeMode(snapshot(), 'node-2')).toBe('compact');

    nodeUiStore.toggleExpanded('node-2');
    expect(getNodeMode(snapshot(), 'node-2')).toBe('view');
  });

  it('toggles expansion independently of editing', () => {
    nodeUiStore.toggleExpanded('node-2');
    expect(snapshot().expandedNodeIds['node-2']).toBe(true);

    nodeUiStore.toggleExpanded('node-2');
    expect(snapshot().expandedNodeIds['node-2']).toBeUndefined();
  });

  it('clears state', () => {
    nodeUiStore.beginEdit('node-3');
    nodeUiStore.clear();

    expect(snapshot()).toEqual({
      editingNodeId: null,
      expandedNodeIds: {}
    });
  });
});
