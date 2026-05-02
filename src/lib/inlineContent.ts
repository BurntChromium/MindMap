import { canonicalizeNodeTitle, normalizeNodeTitle } from '$lib/nodeTitles';

export type InlineContentSegment =
  | {
      type: 'text';
      text: string;
      bold: boolean;
      italic: boolean;
      startIndex: number;
      endIndex: number;
    }
  | {
      type: 'entity';
      text: string;
      title: string;
      titleKey: string;
      referenceText: string;
      bold: boolean;
      italic: boolean;
      startIndex: number;
      endIndex: number;
    }
  | {
      type: 'link';
      text: string;
      href: string;
      bold: boolean;
      italic: boolean;
      startIndex: number;
      endIndex: number;
    };

function isSafeHref(rawHref: string) {
  const href = rawHref.trim();

  if (!href) {
    return null;
  }

  if (/^(https?:|mailto:|tel:|\/|#|\?)/i.test(href)) {
    return href;
  }

  return null;
}

function findLinkMatch(body: string, startIndex: number) {
  const closeBracketIndex = body.indexOf(']', startIndex + 1);

  if (closeBracketIndex === -1 || body[closeBracketIndex + 1] !== '(') {
    return null;
  }

  const closeParenIndex = body.indexOf(')', closeBracketIndex + 2);

  if (closeParenIndex === -1) {
    return null;
  }

  const label = body.slice(startIndex + 1, closeBracketIndex);
  const href = isSafeHref(body.slice(closeBracketIndex + 2, closeParenIndex));

  if (!label || !href) {
    return null;
  }

  return {
    label,
    href,
    endIndex: closeParenIndex + 1
  };
}

export function parseInlineContent(body: string): InlineContentSegment[] {
  if (!body) {
    return [];
  }

  const segments: InlineContentSegment[] = [];
  let bufferStart = 0;
  let index = 0;
  let bold = false;
  let italic = false;

  function flushText(endIndex: number) {
    if (endIndex <= bufferStart) {
      return;
    }

    segments.push({
      type: 'text',
      text: body.slice(bufferStart, endIndex),
      bold,
      italic,
      startIndex: bufferStart,
      endIndex
    });
  }

  while (index < body.length) {
    if (body.startsWith('[[', index)) {
      const closeIndex = body.indexOf(']]', index + 2);

      if (closeIndex !== -1) {
        const title = normalizeNodeTitle(body.slice(index + 2, closeIndex));

        if (title) {
          flushText(index);
          segments.push({
            type: 'entity',
            text: title,
            title,
            titleKey: canonicalizeNodeTitle(title),
            referenceText: body.slice(index, closeIndex + 2),
            bold,
            italic,
            startIndex: index,
            endIndex: closeIndex + 2
          });
          index = closeIndex + 2;
          bufferStart = index;
          continue;
        }
      }
    }

    if (body.startsWith('**', index)) {
      if (bold) {
        flushText(index);
        bold = false;
        index += 2;
        bufferStart = index;
        continue;
      }

      const closeIndex = body.indexOf('**', index + 2);

      if (closeIndex !== -1) {
        flushText(index);
        bold = true;
        index += 2;
        bufferStart = index;
        continue;
      }
    }

    const currentChar = body[index];

    if (currentChar === '*' || currentChar === '_') {
      if (italic) {
        flushText(index);
        italic = false;
        index += 1;
        bufferStart = index;
        continue;
      }

      if (body[index + 1] !== currentChar) {
        const closeIndex = body.indexOf(currentChar, index + 1);

        if (closeIndex !== -1) {
          flushText(index);
          italic = true;
          index += 1;
          bufferStart = index;
          continue;
        }
      }
    }

    if (currentChar === '[') {
      const match = findLinkMatch(body, index);

      if (match) {
        flushText(index);
        segments.push({
          type: 'link',
          text: match.label,
          href: match.href,
          bold,
          italic,
          startIndex: index,
          endIndex: match.endIndex
        });
        index = match.endIndex;
        bufferStart = index;
        continue;
      }
    }

    index += 1;
  }

  flushText(body.length);

  return segments;
}
