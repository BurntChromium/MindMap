export type TopicTitleSource = {
	id: string;
	title: string;
};

export function normalizeTopicTitle(rawTitle: string) {
	return rawTitle.trim();
}

export function canonicalizeTopicTitle(rawTitle: string) {
	return normalizeTopicTitle(rawTitle).toLowerCase();
}

function buildUsedTitleSet(topics: TopicTitleSource[], excludeId?: string) {
	const used = new Set<string>();

	for (const topic of topics) {
		if (excludeId && topic.id === excludeId) {
			continue;
		}

		const normalized = normalizeTopicTitle(topic.title);

		if (!normalized) {
			continue;
		}

		used.add(canonicalizeTopicTitle(normalized));
	}

	return used;
}

function reserveTitle(usedTitles: Set<string>, title: string) {
	const normalized = normalizeTopicTitle(title);

	if (!normalized) {
		return;
	}

	usedTitles.add(canonicalizeTopicTitle(normalized));
}

export function hasTopicTitleConflict(
	topics: TopicTitleSource[],
	title: string,
	excludeId?: string,
) {
	const normalized = normalizeTopicTitle(title);

	if (!normalized) {
		return false;
	}

	return buildUsedTitleSet(topics, excludeId).has(
		canonicalizeTopicTitle(normalized),
	);
}

export function createTopicTitleAllocator(
	topics: TopicTitleSource[],
	excludeId?: string,
) {
	const usedTitles = buildUsedTitleSet(topics, excludeId);

	function hasTitle(title: string) {
		const normalized = normalizeTopicTitle(title);

		if (!normalized) {
			return false;
		}

		return usedTitles.has(canonicalizeTopicTitle(normalized));
	}

	function nextEnumeratedTitle(baseTitle = 'Topic') {
		const normalizedBase = normalizeTopicTitle(baseTitle) || 'Topic';
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
		const normalizedBase = normalizeTopicTitle(baseTitle);

		if (!normalizedBase) {
			return nextEnumeratedTitle('Topic');
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
		nextCopyTitle,
	};
}

export function resolveUniqueTopicTitle(
	topics: TopicTitleSource[],
	requestedTitle = '',
) {
	const allocator = createTopicTitleAllocator(topics);
	const normalized = normalizeTopicTitle(requestedTitle);

	if (!normalized) {
		return allocator.nextEnumeratedTitle('Topic');
	}

	return allocator.nextCopyTitle(normalized);
}
