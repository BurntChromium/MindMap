import { describe, expect, it } from 'vitest';
import { extractEntityReferences, replaceEntityReferences } from './entities';

describe('entities', () => {
  it('extracts mention spans and canonical titles from body text', () => {
    expect(extractEntityReferences('Meet [[Smaug]] and [[Bilbo]] again.')).toEqual([
      {
        title: 'Smaug',
        titleKey: 'smaug',
        referenceText: '[[Smaug]]',
        startIndex: 5,
        endIndex: 14
      },
      {
        title: 'Bilbo',
        titleKey: 'bilbo',
        referenceText: '[[Bilbo]]',
        startIndex: 19,
        endIndex: 28
      }
    ]);
  });

  it('rewrites matching entity references case-insensitively', () => {
    expect(replaceEntityReferences('[[smaug]] meets [[Smaug]]', 'Smaug', 'Dragon')).toBe(
      '[[Dragon]] meets [[Dragon]]'
    );
  });
});
