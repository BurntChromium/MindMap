const TAG_PALETTE = [
	'#f6c4c4',
	'#f9d2b6',
	'#f7e19a',
	'#dbe89e',
	'#c2e5b8',
	'#aee0d7',
	'#b9dcf5',
	'#c6d0f7',
	'#d9c3f3',
	'#efc5e2',
	'#f4b8c1',
	'#f6c4a3',
	'#f2ddb1',
	'#d8e8c2',
	'#d0eef1',
	'#e3d5f6',
];

function hashTagName(value: string) {
	let hash = 0;

	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0;
	}

	return Math.abs(hash);
}

function hexToRgb(hex: string) {
	const normalized = hex.replace('#', '');

	if (normalized.length !== 6) {
		return null;
	}

	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);

	if ([red, green, blue].some((value) => Number.isNaN(value))) {
		return null;
	}

	return { red, green, blue };
}

export function rgbaFromHex(hex: string, alpha: number) {
	const rgb = hexToRgb(hex);

	if (!rgb) {
		return `rgba(242, 201, 197, ${alpha})`;
	}

	return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
}

export function getTagColor(tagName: string) {
	const normalized = tagName.trim().toLowerCase();

	if (!normalized) {
		return TAG_PALETTE[0];
	}

	return TAG_PALETTE[hashTagName(normalized) % TAG_PALETTE.length];
}

export function getTagColorWithAlpha(tagName: string, alpha: number) {
	return rgbaFromHex(getTagColor(tagName), alpha);
}
