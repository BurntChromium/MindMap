export type ShortcutHelpSection = {
	title: string;
	shortcuts: Array<{
		keys: string[];
		description: string;
	}>;
};

export const shortcutHelpSections: ShortcutHelpSection[] = [
	{
		title: 'Canvas',
		shortcuts: [
			{ keys: ['N'], description: 'Create a new note' },
			{ keys: ['G'], description: 'Create a new topic' },
			{ keys: ['C'], description: 'Toggle the left canvas panel' },
			{ keys: ['F'], description: 'Toggle the right search panel' },
			{ keys: ['-'], description: 'Zoom out' },
			{ keys: ['='], description: 'Zoom in' },
			{ keys: ['E'], description: 'Edit the selected note' },
			{ keys: ['V'], description: 'Toggle compact/view mode for a note' },
			{ keys: ['Space'], description: 'Toggle the focused node selection' },
			{ keys: ['Tab'], description: 'Cycle focus through visible nodes' },
		],
	},
	{
		title: 'Selection',
		shortcuts: [
			{ keys: ['Backspace', 'Delete'], description: 'Delete the selection' },
			{ keys: ['Cmd/Ctrl', 'A'], description: 'Select all nodes' },
			{ keys: ['Cmd/Ctrl', 'C'], description: 'Copy the selection' },
			{ keys: ['Cmd/Ctrl', 'X'], description: 'Cut the selection' },
			{ keys: ['Cmd/Ctrl', 'V'], description: 'Paste the copied fragment' },
			{ keys: ['Cmd/Ctrl', 'D'], description: 'Duplicate the selection' },
			{
				keys: ['Cmd/Ctrl', 'Shift', 'D'],
				description: 'Duplicate the selected subtree',
			},
			{ keys: ['Arrow keys'], description: 'Move selected nodes around' },
			{ keys: ['Shift', '+', 'Arrow keys'], description: 'Move nodes faster' },
			{
				keys: ['Alt/Option', '+', 'Arrow keys'],
				description: 'Jump focus to the nearest node',
			},
		],
	},
	{
		title: 'Editing',
		shortcuts: [
			{ keys: ['w'], description: 'Focus the title field while editing' },
			{
				keys: ['Esc'],
				description: 'Clear selection or exit the current action',
			},
			{ keys: ['y'], description: 'Confirm the discard prompt' },
			{ keys: ['n'], description: 'Cancel the discard prompt' },
			{ keys: ['/'], description: 'Open the quick search bar' },
			{ keys: ['t'], description: 'Open or focus tag editing' },
			{ keys: ['?'], description: 'Open keyboard shortcuts help' },
			{ keys: ['Cmd/Ctrl', 'Z'], description: 'Undo the last canvas mutation' },
			{
				keys: ['Cmd/Ctrl', 'Shift', 'Z'],
				description: 'Redo the last undone canvas mutation',
			},
		],
	},
];

export const shortcutHelpBlockedKeys = new Set([
	'a',
	'c',
	'd',
	'e',
	'f',
	'n',
	'g',
	't',
	'v',
	'w',
	'x',
	'y',
	'z',
	'/',
	'-',
	'=',
	'backspace',
	'delete',
	'arrowup',
	'arrowdown',
	'arrowleft',
	'arrowright',
	'tab',
	' ',
]);

export function shouldBlockShortcutHelpKey(key: string) {
	return shortcutHelpBlockedKeys.has(key.toLowerCase());
}
