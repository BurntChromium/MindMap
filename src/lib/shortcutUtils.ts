export function isTextInputElement(target: EventTarget | null) {
	if (!target || typeof target !== 'object') {
		return false;
	}

	const element = target as {
		tagName?: string;
		isContentEditable?: boolean;
	};

	const tagName = element.tagName?.toUpperCase();

	return Boolean(
		element.isContentEditable ||
		tagName === 'INPUT' ||
		tagName === 'TEXTAREA' ||
		tagName === 'SELECT',
	);
}

export function isCreateNodeShortcut(event: KeyboardEvent) {
	return isKeyShortcut(event, 'n');
}

export function isCreateTopicShortcut(event: KeyboardEvent) {
	return isKeyShortcut(event, 'g');
}

export function isCanvasToggleShortcut(event: KeyboardEvent) {
	return isKeyShortcut(event, 'c');
}

export function isDiscoveryToggleShortcut(event: KeyboardEvent) {
	return isKeyShortcut(event, 'f');
}

export function isShortcutHelpShortcut(event: KeyboardEvent) {
	if (event.defaultPrevented) {
		return false;
	}

	if (event.metaKey || event.ctrlKey || event.altKey) {
		return false;
	}

	return event.key === '?' || (event.shiftKey && event.key === '/');
}

export function isZoomOutShortcut(event: KeyboardEvent) {
	return isKeyShortcut(event, '-');
}

export function isZoomInShortcut(event: KeyboardEvent) {
	return isKeyShortcut(event, '=');
}

export function isSaveAndExitEditShortcut(event: KeyboardEvent) {
	if (event.defaultPrevented) {
		return false;
	}

	if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
		return false;
	}

	return event.key === 'Escape';
}

function isKeyShortcut(event: KeyboardEvent, key: string) {
	if (event.defaultPrevented) {
		return false;
	}

	if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
		return false;
	}

	return event.key.toLowerCase() === key;
}
