/**
 * Writes docs/cermat-coverage.md from the data: the official specification, the classified
 * past papers, and the concepts and generators of the entrance-examination track.
 *
 *   npm run jpz:coverage
 *
 * Run it after editing anything in packages/content/src/jpz/, or a basic concept or
 * generator. A test compares the file with the data and fails when they have drifted apart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONCEPTS, EXAM_BLUEPRINTS, FORMAT_TAGS, GENERATORS, GOALS, coverageDocument } from '@lemma/content';

const target = path.join(import.meta.dirname, '..', 'docs', 'cermat-coverage.md');
const document = coverageDocument({
  goals: GOALS,
  concepts: CONCEPTS,
  generators: GENERATORS,
  blueprints: EXAM_BLUEPRINTS,
  formatTags: FORMAT_TAGS,
});
fs.writeFileSync(target, document);
console.log(`wrote ${path.relative(process.cwd(), target)} (${document.split('\n').length} lines)`);
