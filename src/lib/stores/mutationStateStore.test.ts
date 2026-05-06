import { afterEach, describe, expect, it } from 'vitest';
import { mutationStateStore } from './mutationStateStore';

function snapshot() {
	let current: any;
	const unsubscribe = mutationStateStore.subscribe((value) => {
		current = value;
	});
	unsubscribe();
	return current;
}

afterEach(() => {
	mutationStateStore.finishLoad(true);
	mutationStateStore.finishWrite(true);
	mutationStateStore.clearError();
});

describe('mutationStateStore', () => {
	it('tracks load and write phases', () => {
		mutationStateStore.beginLoad();
		expect(snapshot().phase).toBe('loading');

		mutationStateStore.finishLoad(true);
		expect(snapshot().phase).toBe('synced');

		mutationStateStore.beginWrite();
		expect(snapshot().phase).toBe('syncing');

		mutationStateStore.finishWrite(false, 'Write failed');
		expect(snapshot().phase).toBe('failed');
		expect(snapshot().lastError).toBe('Write failed');

		mutationStateStore.clearError();
		expect(snapshot().phase).toBe('synced');
	});
});
