import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { findCycle, topologicalOrder } from '@lemma/core';
import {
  CONCEPTS,
  CURRENT_FIT_SNAPSHOT,
  EXAM_BLUEPRINTS,
  FIT_SNAPSHOTS,
  GENERATORS,
  LESSONS,
  MILESTONES,
  MISSIONS,
  ROADMAP,
  STATIC_PROBLEMS,
  SYLLABUS,
  conceptsOfTopic,
  conceptsWithoutProblems,
  hasProblems,
  lintContent,
  topLevelOf,
  type ContentBundle,
  type TexValidator,
} from '../src/index';

const validateTex: TexValidator = (tex) => {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'error' });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 160) : String(error);
  }
};

const bundle: ContentBundle = {
  concepts: CONCEPTS,
  syllabus: SYLLABUS,
  lessons: LESSONS,
  generators: GENERATORS,
  staticProblems: STATIC_PROBLEMS,
  missions: MISSIONS,
  snapshots: FIT_SNAPSHOTS,
  roadmap: ROADMAP,
  examBlueprints: EXAM_BLUEPRINTS,
  milestones: MILESTONES,
};

describe('content structure', () => {
  it('passes the structural linter', () => {
    const issues = lintContent(bundle, validateTex);
    expect(issues.map((issue) => `${issue.where}: ${issue.message}`)).toEqual([]);
  });

  it('has an acyclic prerequisite graph with a valid ordering', () => {
    expect(findCycle(CONCEPTS)).toBeNull();
    const order = topologicalOrder(CONCEPTS);
    const position = new Map(order.map((id, index) => [id, index]));
    for (const concept of CONCEPTS) {
      for (const pre of concept.prereqs)
        expect(position.get(pre)!, `${pre} before ${concept.id}`).toBeLessThan(position.get(concept.id)!);
    }
  });

  it('keeps the syllabus exactly as transcribed: 17 topics, in order', () => {
    expect(SYLLABUS.map((topic) => topic.n)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(SYLLABUS[0]!.title.en).toBe('Review of linear functions');
    expect(SYLLABUS[13]!.title.en).toBe('Complex numbers – trigonometric form');
    expect(SYLLABUS[16]!.title.en).toBe('Stereometry I');
  });

  it('never presents enrichment as syllabus content', () => {
    for (const concept of CONCEPTS) {
      if (concept.track === 'school') expect(concept.syllabusTopic, concept.id).toBeTypeOf('number');
      else expect(concept.syllabusTopic, concept.id).toBeUndefined();
    }
    for (const topic of SYLLABUS) expect(conceptsOfTopic(topic.n).length, `topic ${topic.n}`).toBeGreaterThan(0);
  });

  it('dates and sources every piece of FIT information', () => {
    const snapshot = CURRENT_FIT_SNAPSHOT;
    expect(snapshot.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.sources.length).toBeGreaterThan(0);
    for (const source of snapshot.sources) expect(source.url).toMatch(/^https:\/\/(www\.fit\.vut\.cz|www\.scio\.cz)\//);
    for (const fact of [...snapshot.programme.facts, ...snapshot.admission.facts]) {
      expect(snapshot.sources.some((source) => source.url === fact.source)).toBe(true);
    }
    expect(snapshot.sources.some((source) => source.url === snapshot.bridge.source)).toBe(true);
    // Course facts come from the course's own card.
    for (const course of snapshot.courses)
      expect(course.url, course.code).toMatch(/^https:\/\/www\.fit\.vut\.cz\/study\/course\/\d+\//);
  });

  /** Everything except what can only be done on paper (geometric constructions). */
  const practisable = CONCEPTS.filter((concept) => !concept.paperOnly);

  it('has problems for every concept, syllabus and enrichment alike', () => {
    expect(practisable.filter((c) => !hasProblems(c.id)).map((c) => c.id)).toEqual([]);
    expect(conceptsWithoutProblems(bundle)).toEqual([]);
    // What is exempt is exempt on purpose, and stays without problems.
    expect(CONCEPTS.filter((c) => c.paperOnly).map((c) => c.id)).toEqual(['geom.constructions']);
    expect(hasProblems('geom.constructions')).toBe(false);
  });

  it('gives every concept problems at more than one level of difficulty', () => {
    for (const concept of practisable) {
      const levels = new Set(GENERATORS.filter((g) => g.concept === concept.id).flatMap((g) => g.levels));
      expect(levels.size, `${concept.id} has levels ${[...levels].join(', ')}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives every concept problems hard enough to count as evidence of proficiency', () => {
    // "Proficient" needs an unaided solve at level 3. A concept that stops below that
    // could never be more than familiar, whatever the learner did.
    for (const concept of practisable) expect(topLevelOf(concept.id) ?? 0, concept.id).toBeGreaterThanOrEqual(3);
    // Self-assessed explanations are not evidence and do not raise the ceiling.
    expect(topLevelOf('no.such.concept')).toBeUndefined();
  });

  it('covers every topic of the syllabus with problems tagged for the annual review', () => {
    for (const topic of SYLLABUS) {
      const concepts = conceptsOfTopic(topic.n).map((c) => c.id);
      const tagged = GENERATORS.filter((g) => concepts.includes(g.concept) && g.tags?.includes('annual-review'));
      expect(tagged.length, `topic ${topic.n}`).toBeGreaterThan(0);
    }
  });

  it('never registers two generators under one id, and every generator names a real concept', () => {
    const ids = GENERATORS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(CONCEPTS.map((c) => c.id));
    for (const generator of GENERATORS)
      expect(known.has(generator.concept), `${generator.id} → ${generator.concept}`).toBe(true);
  });
});
