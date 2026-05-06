import { describe, expect, it } from 'vitest';
import { parseInlineContent } from './inlineContent';

describe('inline content', () => {
	it('parses entity references, emphasis, and links in view mode', () => {
		expect(
			parseInlineContent(
				'Meet [[Smaug]] in **bold** and *italic* with [docs](https://example.com).',
			),
		).toEqual([
			{
				type: 'text',
				text: 'Meet ',
				bold: false,
				italic: false,
				startIndex: 0,
				endIndex: 5,
			},
			{
				type: 'entity',
				text: 'Smaug',
				title: 'Smaug',
				titleKey: 'smaug',
				referenceText: '[[Smaug]]',
				bold: false,
				italic: false,
				startIndex: 5,
				endIndex: 14,
			},
			{
				type: 'text',
				text: ' in ',
				bold: false,
				italic: false,
				startIndex: 14,
				endIndex: 18,
			},
			{
				type: 'text',
				text: 'bold',
				bold: true,
				italic: false,
				startIndex: 20,
				endIndex: 24,
			},
			{
				type: 'text',
				text: ' and ',
				bold: false,
				italic: false,
				startIndex: 26,
				endIndex: 31,
			},
			{
				type: 'text',
				text: 'italic',
				bold: false,
				italic: true,
				startIndex: 32,
				endIndex: 38,
			},
			{
				type: 'text',
				text: ' with ',
				bold: false,
				italic: false,
				startIndex: 39,
				endIndex: 45,
			},
			{
				type: 'link',
				text: 'docs',
				href: 'https://example.com',
				bold: false,
				italic: false,
				startIndex: 45,
				endIndex: 72,
			},
			{
				type: 'text',
				text: '.',
				bold: false,
				italic: false,
				startIndex: 72,
				endIndex: 73,
			},
		]);
	});

	it('preserves markdown-lite formatting around entity references', () => {
		expect(parseInlineContent('**[[Smaug]]**')).toEqual([
			{
				type: 'entity',
				text: 'Smaug',
				title: 'Smaug',
				titleKey: 'smaug',
				referenceText: '[[Smaug]]',
				bold: true,
				italic: false,
				startIndex: 2,
				endIndex: 11,
			},
		]);
	});
});
