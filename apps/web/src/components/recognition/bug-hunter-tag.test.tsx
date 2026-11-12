import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BugHunterTag } from './bug-hunter-tag';

describe('approved bug rewards', () => {
  it.each([[0, null], [1, 'Bug Finder'], [4, 'Bug Finder'], [5, 'Bug Hunter'], [19, 'Bug Hunter'], [20, 'Bug Expert'], [49, 'Bug Expert'], [50, 'Bug Legend']] as const)('uses the approved count %i for the earned rank', (count, rank) => {
    const html = renderToStaticMarkup(<BugHunterTag user={{ approvedBugCount: count }} />);
    if (rank === null) expect(html).toBe('');
    else expect(html).toContain(rank);
  });
  it('does not let local appearance choices unlock an unearned tier', () => {
    const html = renderToStaticMarkup(<BugHunterTag user={{ approvedBugCount: 1 }} preferences={{ colors: ['#123456', '#654321', '#abcdef'], animation: 'shimmer' }} />);
    expect(html).toContain('Bug Finder');
    expect(html).not.toContain('--tag-first');
    expect(html).not.toContain('shimmer');
  });
});
