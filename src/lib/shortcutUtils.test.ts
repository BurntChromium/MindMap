import { describe, expect, it } from 'vitest';
import {
	isCanvasToggleShortcut,
	isCreateNodeShortcut,
	isDiscoveryToggleShortcut,
	isSaveAndExitEditShortcut,
	isShortcutHelpShortcut,
	isZoomInShortcut,
	isZoomOutShortcut,
	isTextInputElement,
} from '$lib/shortcutUtils';

describe('shortcutUtils', () => {
	it('recognizes the create-node key', () => {
		const event = {
			key: 'n',
			metaKey: false,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			defaultPrevented: false,
		} as KeyboardEvent;

		expect(isCreateNodeShortcut(event)).toBe(true);
	});

	it('recognizes the canvas toggle key', () => {
		const event = {
			key: 'c',
			metaKey: false,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			defaultPrevented: false,
		} as KeyboardEvent;

		expect(isCanvasToggleShortcut(event)).toBe(true);
	});

	it('recognizes the discovery toggle key', () => {
		const event = {
			key: 'f',
			metaKey: false,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			defaultPrevented: false,
		} as KeyboardEvent;

		expect(isDiscoveryToggleShortcut(event)).toBe(true);
	});

	it('recognizes the help shortcut key', () => {
		const event = {
			key: '?',
			metaKey: false,
			ctrlKey: false,
			altKey: false,
			shiftKey: true,
			defaultPrevented: false,
		} as KeyboardEvent;

		expect(isShortcutHelpShortcut(event)).toBe(true);
	});

	it('recognizes zoom shortcuts', () => {
		expect(
			isZoomOutShortcut({
				key: '-',
				metaKey: false,
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				defaultPrevented: false,
			} as KeyboardEvent),
		).toBe(true);

		expect(
			isZoomInShortcut({
				key: '=',
				metaKey: false,
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				defaultPrevented: false,
			} as KeyboardEvent),
		).toBe(true);
	});

	it('recognizes the edit save-and-exit key', () => {
		expect(
			isSaveAndExitEditShortcut({
				key: 'Escape',
				metaKey: false,
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				defaultPrevented: false,
			} as KeyboardEvent),
		).toBe(true);
	});

	it('ignores modifier combinations', () => {
		const event = {
			key: 'n',
			metaKey: false,
			ctrlKey: true,
			altKey: false,
			shiftKey: false,
			defaultPrevented: false,
		} as KeyboardEvent;

		expect(isCreateNodeShortcut(event)).toBe(false);
		expect(
			isSaveAndExitEditShortcut({
				key: 'Escape',
				metaKey: false,
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				defaultPrevented: false,
			} as KeyboardEvent),
		).toBe(false);
	});

	it('recognizes text entry targets', () => {
		const input = { tagName: 'input' };
		const textarea = { tagName: 'textarea' };
		const editable = { isContentEditable: true };

		expect(isTextInputElement(input as unknown as EventTarget)).toBe(true);
		expect(isTextInputElement(textarea as unknown as EventTarget)).toBe(true);
		expect(isTextInputElement(editable as unknown as EventTarget)).toBe(true);
		expect(
			isTextInputElement({ tagName: 'div' } as unknown as EventTarget),
		).toBe(false);
	});
});
