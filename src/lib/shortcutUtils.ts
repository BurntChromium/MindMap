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
      tagName === 'SELECT'
  );
}

export function isCreateNodeShortcut(event: KeyboardEvent) {
  return isKeyShortcut(event, 'n');
}

export function isCanvasToggleShortcut(event: KeyboardEvent) {
  return isKeyShortcut(event, 'c');
}

export function isDiscoveryToggleShortcut(event: KeyboardEvent) {
  return isKeyShortcut(event, 'f');
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
