import { describe, expect, it } from 'vitest';
import { isNodeEditDraftDirty } from './nodeEditDraft';

describe('nodeEditDraft', () => {
	it('detects meaningful draft changes and ignores whitespace-only title noise', () => {
		expect(
			isNodeEditDraftDirty(
				{
					title: '  Note title  ',
					body: 'Body',
					tags: ['lore'],
					tagInput: '',
					isEntity: true,
				},
				{
					title: 'Note title',
					body: 'Body',
					tags: ['lore'],
					isEntity: true,
				},
			),
		).toBe(false);

		expect(
			isNodeEditDraftDirty(
				{
					title: 'Note title',
					body: 'Body',
					tags: ['lore'],
					tagInput: '',
					isEntity: true,
				},
				{
					title: 'Note title',
					body: 'Different body',
					tags: ['lore'],
					isEntity: true,
				},
			),
		).toBe(true);

		expect(
			isNodeEditDraftDirty(
				{
					title: 'Note title',
					body: 'Body',
					tags: ['lore'],
					tagInput: 'npc',
					isEntity: true,
				},
				{
					title: 'Note title',
					body: 'Body',
					tags: ['lore'],
					isEntity: true,
				},
			),
		).toBe(true);
	});
});
