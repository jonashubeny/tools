import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Checks on the content package's source text. They live here because the content
 * package is compiled without Node types on purpose, and reading files needs them.
 */
const SRC = join(import.meta.dirname, '../../content/src');

describe('content sources', () => {
  it('write TeX spacing commands with a doubled backslash', () => {
    // Content is TeX inside JavaScript strings. A single backslash before punctuation is
    // an escape JavaScript silently drops, so a thin space would reach the page as a bare ";".
    const sources = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(10);
    const dropped = /(?<!\\)\\[;,!: ]/;
    const offenders: string[] = [];
    for (const file of sources) {
      readFileSync(join(SRC, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (dropped.test(line)) offenders.push(`${file}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
