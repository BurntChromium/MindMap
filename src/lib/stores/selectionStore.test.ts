import { afterEach, describe, expect, it } from 'vitest';
import { selectionStore } from './selectionStore';

function snapshot() {
	let current: string[] = [];
	const unsubscribe = selectionStore.subscribe((value) => {
		current = value;
	});
	unsubscribe();
	return current;
}

afterEach(() => {
	selectionStore.clear();
});

describe('selectionStore', () => {
	it('normalizes selected ids and removes duplicates', () => {
		selectionStore.setSelection(['node-1', 'node-2', 'node-1', '']);

		expect(snapshot()).toEqual(['node-1', 'node-2']);
	});

	it('toggles ids in and out of the selection', () => {
		selectionStore.toggleNode('node-1');
		selectionStore.toggleNode('node-2');
		selectionStore.toggleNode('node-1');

		expect(snapshot()).toEqual(['node-2']);
	});

	it('selects and clears all ids', () => {
		selectionStore.selectAll(['node-3', 'node-4']);
		expect(snapshot()).toEqual(['node-3', 'node-4']);

		selectionStore.clear();
		expect(snapshot()).toEqual([]);
	});
});
