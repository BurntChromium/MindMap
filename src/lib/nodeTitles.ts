export type NodeTitleSource = {
  id: string;
  title: string;
};

export function normalizeNodeTitle(rawTitle: string) {
  return rawTitle.trim();
}

export function canonicalizeNodeTitle(rawTitle: string) {
  return normalizeNodeTitle(rawTitle).toLowerCase();
}

function buildUsedTitleSet(nodes: NodeTitleSource[], excludeId?: string) {
  const used = new Set<string>();

  for (const node of nodes) {
    if (excludeId && node.id === excludeId) {
      continue;
    }

    const normalized = normalizeNodeTitle(node.title);

    if (!normalized) {
      continue;
    }

    used.add(canonicalizeNodeTitle(normalized));
  }

  return used;
}

function reserveTitle(usedTitles: Set<string>, title: string) {
  const normalized = normalizeNodeTitle(title);

  if (!normalized) {
    return;
  }

  usedTitles.add(canonicalizeNodeTitle(normalized));
}

export function hasNodeTitleConflict(
  nodes: NodeTitleSource[],
  title: string,
  excludeId?: string
) {
  const normalized = normalizeNodeTitle(title);

  if (!normalized) {
    return false;
  }

  return buildUsedTitleSet(nodes, excludeId).has(canonicalizeNodeTitle(normalized));
}

export function createNodeTitleAllocator(nodes: NodeTitleSource[], excludeId?: string) {
  const usedTitles = buildUsedTitleSet(nodes, excludeId);

  function hasTitle(title: string) {
    const normalized = normalizeNodeTitle(title);

    if (!normalized) {
      return false;
    }

    return usedTitles.has(canonicalizeNodeTitle(normalized));
  }

  function nextEnumeratedTitle(baseTitle = 'Node') {
    const normalizedBase = normalizeNodeTitle(baseTitle) || 'Node';
    let suffix = 1;
    let candidate = `${normalizedBase} ${suffix}`;

    while (hasTitle(candidate)) {
      suffix += 1;
      candidate = `${normalizedBase} ${suffix}`;
    }

    reserveTitle(usedTitles, candidate);
    return candidate;
  }

  function nextCopyTitle(baseTitle: string) {
    const normalizedBase = normalizeNodeTitle(baseTitle);

    if (!normalizedBase) {
      return nextEnumeratedTitle('Node');
    }

    let candidate = normalizedBase;
    if (!hasTitle(candidate)) {
      reserveTitle(usedTitles, candidate);
      return candidate;
    }

    let suffix = 1;
    candidate = `${normalizedBase} (${suffix})`;

    while (hasTitle(candidate)) {
      suffix += 1;
      candidate = `${normalizedBase} (${suffix})`;
    }

    reserveTitle(usedTitles, candidate);
    return candidate;
  }

  return {
    nextEnumeratedTitle,
    nextCopyTitle
  };
}

export function resolveUniqueNodeTitle(nodes: NodeTitleSource[], requestedTitle = '') {
  const allocator = createNodeTitleAllocator(nodes);
  const normalized = normalizeNodeTitle(requestedTitle);

  if (!normalized) {
    return allocator.nextEnumeratedTitle('Node');
  }

  return allocator.nextCopyTitle(normalized);
}
