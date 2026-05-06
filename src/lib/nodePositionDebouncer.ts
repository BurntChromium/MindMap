export type NodePositionUpdate = {
	id: string;
	x: number;
	y: number;
};

type PositionLike = Pick<NodePositionUpdate, 'x' | 'y'>;

type ApplyUpdates = (
	updates: NodePositionUpdate[],
) => Promise<unknown> | unknown;
type FlushListener = (updates: NodePositionUpdate[]) => void;

export function createNodePositionDebouncer(
	applyUpdates: ApplyUpdates,
	delayMs = 150,
	onFlushSettled?: FlushListener,
) {
	const pendingPositionsById = new Map<string, PositionLike>();
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let flushQueue: Promise<void> = Promise.resolve();

	function clearTimer() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	}

	function scheduleFlush() {
		clearTimer();
		timeoutId = setTimeout(() => {
			timeoutId = null;
			void flushPendingUpdates();
		}, delayMs);
	}

	async function flushPendingUpdates() {
		if (!pendingPositionsById.size) {
			return flushQueue;
		}

		const updates = Array.from(pendingPositionsById.entries()).map(
			([id, position]) => ({
				id,
				x: position.x,
				y: position.y,
			}),
		);
		pendingPositionsById.clear();
		clearTimer();

		flushQueue = flushQueue
			.then(() => applyUpdates(updates))
			.then(() => undefined)
			.catch((error) => {
				console.error(error);
			})
			.finally(() => {
				try {
					onFlushSettled?.(updates);
				} catch (error) {
					console.error(error);
				}
			});

		return flushQueue;
	}

	return {
		queue(updates: NodePositionUpdate[]) {
			for (const update of updates) {
				pendingPositionsById.set(update.id, { x: update.x, y: update.y });
			}

			scheduleFlush();
		},

		getPendingPosition(id: string, fallback: PositionLike) {
			return pendingPositionsById.get(id) ?? fallback;
		},

		async flush() {
			return flushPendingUpdates();
		},

		destroy() {
			clearTimer();
			return flushPendingUpdates();
		},
	};
}
