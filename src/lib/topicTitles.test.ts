import { describe, expect, it } from 'vitest';
import {
	createTopicTitleAllocator,
	hasTopicTitleConflict,
	resolveUniqueTopicTitle,
} from './topicTitles';

describe('topicTitles', () => {
	it('treats topic titles as unique within a canvas regardless of case', () => {
		expect(
			hasTopicTitleConflict(
				[
					{ id: 'topic-1', title: 'Research' },
					{ id: 'topic-2', title: 'Planning' },
				],
				'research',
			),
		).toBe(true);
	});

	it('enumerates fresh topic titles', () => {
		expect(resolveUniqueTopicTitle([], '')).toBe('Topic 1');
		expect(
			createTopicTitleAllocator([{ id: 'topic-1', title: 'Topic 1' }]).nextEnumeratedTitle(
				'Topic',
			),
		).toBe('Topic 2');
	});

	it('suffixes copied topic titles with OS-style numbering', () => {
		const allocator = createTopicTitleAllocator([
			{ id: 'topic-1', title: 'Research' },
			{ id: 'topic-2', title: 'Research (1)' },
		]);

		expect(allocator.nextCopyTitle('Research')).toBe('Research (2)');
	});
});
