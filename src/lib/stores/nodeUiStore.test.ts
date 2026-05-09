import { afterEach, describe, expect, it } from 'vitest';
import { getNodeMode, nodeUiStore } from './nodeUiStore';

function snapshot() {
	let current: {
		editingNodeId: string | null;
		expandedNodeIds: Record<string, true>;
		discardPrompt: {
			nodeId: string;
			field: 'title' | 'tag' | 'body';
		} | null;
	} = {
		editingNodeId: null,
		expandedNodeIds: {},
		discardPrompt: null,
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
		expect(state.discardPrompt).toBeNull();
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
			expandedNodeIds: {},
			discardPrompt: null,
		});
	});

	it('tracks discard confirmation prompts for the active editor', () => {
		nodeUiStore.beginEdit('node-4');
		nodeUiStore.requestDiscardPrompt('node-4', 'body');

		expect(snapshot().discardPrompt).toEqual({
			nodeId: 'node-4',
			field: 'body',
		});

		nodeUiStore.clearDiscardPrompt();
		expect(snapshot().discardPrompt).toBeNull();
	});

	it('collapses the node when ending edit in preview mode', () => {
		nodeUiStore.beginEdit('node-5');
		nodeUiStore.endEditCollapsed('node-5');

		expect(snapshot()).toEqual({
			editingNodeId: null,
			expandedNodeIds: {},
			discardPrompt: null,
		});
	});
});
