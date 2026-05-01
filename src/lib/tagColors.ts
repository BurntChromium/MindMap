const TAG_PALETTE = [
  '#f2c9c5',
  '#f7d7a8',
  '#f3e3a6',
  '#cde4b4',
  '#bfe3da',
  '#bfd7ea',
  '#d8c9f3',
  '#f0c9e1',
  '#f5d0b6',
  '#d6e8f5',
  '#e3d8f0',
  '#dfe7c7'
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
