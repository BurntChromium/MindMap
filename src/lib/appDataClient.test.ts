import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();

async function loadClient() {
	vi.resetModules();
	return await import('./appDataClient');
}

beforeEach(() => {
	vi.stubGlobal('window', {
		__TAURI__: {
			core: {
				invoke,
			},
		},
	});
	invoke.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('appDataClient', () => {
	it('normalizes Tauri node create payloads before invoking the backend', async () => {
		invoke.mockResolvedValueOnce({ success: true });

		const { appDataClient } = await loadClient();

		await appDataClient.createNode({
			id: 'node-1',
			canvasId: 'canvas-1',
			title: 'Aeon',
			body: 'A note about aeons.',
			is_entity: 1,
			tags: ['Lore'],
			x: 12,
			y: 34,
		});

		expect(invoke).toHaveBeenCalledWith('create_node', {
			input: {
				id: 'node-1',
				canvasId: 'canvas-1',
				title: 'Aeon',
				body: 'A note about aeons.',
				isEntity: true,
				tags: ['lore'],
				x: 12,
				y: 34,
				collapsed: 0,
			},
		});
	});

	it('normalizes Tauri node update payloads before invoking the backend', async () => {
		invoke.mockResolvedValueOnce({ success: true });

		const { appDataClient } = await loadClient();

		await appDataClient.updateNode({
			id: 'node-1',
			title: 'Aeon',
			is_entity: 0,
			tags: ['Lore'],
		});

		expect(invoke).toHaveBeenCalledWith('update_node', {
			input: {
				id: 'node-1',
				title: 'Aeon',
				body: undefined,
				isEntity: false,
				x: undefined,
				y: undefined,
				collapsed: undefined,
				tags: ['lore'],
			},
		});
	});
});
