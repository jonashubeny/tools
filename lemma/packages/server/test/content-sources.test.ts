import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CONCEPTS, EXAM_BLUEPRINTS, FORMAT_TAGS, GENERATORS, GOALS, coverageDocument } from '@lemma/content';
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

  it('has a coverage document that says what the data says', () => {
    // docs/cermat-coverage.md is generated. If this fails, run `npm run jpz:coverage`.
    const written = readFileSync(join(import.meta.dirname, '../../../docs/cermat-coverage.md'), 'utf8');
    const generated = coverageDocument({
      goals: GOALS,
      concepts: CONCEPTS,
      generators: GENERATORS,
      blueprints: EXAM_BLUEPRINTS,
      formatTags: FORMAT_TAGS,
    });
    expect(written).toBe(generated);
    // And it does not claim more than the data supports.
    expect(generated).toContain('Complete coverage is not claimed');
    expect(generated).toMatch(/\d+ of the \d+ specification items have no problems in the app/);
    // Nothing of the official tasks' wording is in it: papers appear as links only.
    expect(generated).toContain('https://prijimacky.cermat.cz/');
  });
});
