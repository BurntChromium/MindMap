export type TopicDraftBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type TopicDraftOverlayRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type TopicDraftViewport = {
	zoom: number;
};

export type TopicDraftShellRect = {
	left: number;
	top: number;
};

export function getTopicDraftOverlayRect(
	bounds: TopicDraftBounds | null,
	viewport: TopicDraftViewport | null,
	shellRect: TopicDraftShellRect | null,
	flowToScreenPosition: (position: { x: number; y: number }) => {
		x: number;
		y: number;
	} | null,
): TopicDraftOverlayRect | null {
	if (!bounds || !viewport || !shellRect || !flowToScreenPosition) {
		return null;
	}

	const topLeft = flowToScreenPosition({
		x: bounds.x,
		y: bounds.y,
	});

	if (!topLeft) {
		return null;
	}

	return {
		left: topLeft.x - shellRect.left,
		top: topLeft.y - shellRect.top,
		width: bounds.width * viewport.zoom,
		height: bounds.height * viewport.zoom,
	};
}
