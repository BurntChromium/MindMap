export function normalizeTagName(raw: string) {
  return raw.trim().replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeTagList(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }

    const normalized = normalizeTagName(tag);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function formatTagLabel(tag: string) {
  const normalized = normalizeTagName(tag);
  return normalized ? `#${normalized}` : '';
}
