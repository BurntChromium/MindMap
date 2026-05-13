import { describe, expect, it } from 'vitest';
import { getTopicDraftOverlayRect } from './topicDraftOverlay';

describe('getTopicDraftOverlayRect', () => {
	it('converts flow bounds into shell-local overlay coordinates', () => {
		expect(
			getTopicDraftOverlayRect(
				{
					x: 240,
					y: 180,
					width: 150,
					height: 100,
				},
				{ zoom: 1.5 },
				{ left: 320, top: 48 },
				(position) => ({ x: position.x + 320, y: position.y + 48 }),
			),
		).toEqual({
			left: 240,
			top: 180,
			width: 225,
			height: 150,
		});
	});

	it('returns null when any input is missing', () => {
		expect(
			getTopicDraftOverlayRect(null, null, null, () => ({ x: 0, y: 0 })),
		).toBeNull();
	});
});
