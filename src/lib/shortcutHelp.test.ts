import { describe, expect, it } from 'vitest';
import { shortcutHelpSections, shouldBlockShortcutHelpKey } from './shortcutHelp';

describe('shortcutHelp', () => {
	it('blocks only the shortcut keys that should be handled by the overlay', () => {
		expect(shouldBlockShortcutHelpKey('A')).toBe(true);
		expect(shouldBlockShortcutHelpKey('Escape')).toBe(false);
		expect(shouldBlockShortcutHelpKey('ArrowLeft')).toBe(true);
	});

	it('defines the expected shortcut groups', () => {
		expect(shortcutHelpSections).toHaveLength(3);
		expect(shortcutHelpSections[0]?.title).toBe('Canvas');
		expect(shortcutHelpSections[2]?.shortcuts.some((shortcut) =>
			shortcut.keys.includes('?'),
		)).toBe(true);
	});
});
