type SummaryEntry = {
	primaryNode?: unknown | null;
	sourceNodeCount: number;
	mentionCount: number;
};

export function formatEntitySummary(entry: SummaryEntry) {
	if (entry.primaryNode && entry.sourceNodeCount === 0) {
		return 'Canonical node';
	}

	const noun = entry.sourceNodeCount === 1 ? 'node' : 'nodes';
	return `${entry.mentionCount} mentions across ${entry.sourceNodeCount} ${noun}`;
}

export function formatSharedEntitySummary(sharedEntityCount: number) {
	const noun = sharedEntityCount === 1 ? 'entity' : 'entities';
	return `${sharedEntityCount} shared ${noun}`;
}

export function truncatePreviewText(value: string, maxLength = 96) {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength).trim()}…`;
}
