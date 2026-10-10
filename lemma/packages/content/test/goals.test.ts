import { describe, expect, it } from 'vitest';
import { GOAL_IDS, createRng, mixSeed, type GoalId, type Level } from '@lemma/core';
import {
  CONCEPTS,
  EXAM_BLUEPRINTS,
  FORMAT_TAGS,
  GENERATORS,
  GOALS,
  JPZ_PAPERS,
  JPZ_SPEC,
  JPZ_UNREADABLE,
  VARIANT_OF_GOAL,
  blueprintsOfGoal,
  conceptsOfGoal,
  evidenceFor,
  generatorsFor,
  getConcept,
  getGoal,
  getSpecItem,
  goalSkillOf,
  hasProblems,
} from '../src/index';

const entrance = GOALS.filter((goal) => goal.kind === 'entrance');
const basic = CONCEPTS.filter((concept) => concept.track === 'basic');

describe('the evidence from past papers', () => {
  it('covers the three variants, and every paper adds up to 50 points', () => {
    expect(JPZ_PAPERS.length).toBe(97);
    expect(JPZ_UNREADABLE.length).toBe(11);
    for (const paper of JPZ_PAPERS) {
      expect(paper.points, paper.id).toBe(50);
      expect(
        paper.tasks.map((task) => task.n),
        paper.id,
      ).toEqual(paper.tasks.map((_, index) => index + 1));
      expect(paper.url, paper.id).toMatch(/^https:\/\/prijimacky\.cermat\.cz\/files\/.+\.pdf$/);
    }
    // The papers of 2025 and 2026 have the structure the practice tests follow.
    expect(JPZ_PAPERS.filter((p) => p.variant === 'M9' && p.year >= 2025).every((p) => p.tasks.length === 16)).toBe(
      true,
    );
    expect(JPZ_PAPERS.filter((p) => p.variant === 'M7' && p.year >= 2025).every((p) => p.tasks.length === 16)).toBe(
      true,
    );
    expect(JPZ_PAPERS.filter((p) => p.variant === 'M5' && p.year >= 2025).every((p) => p.tasks.length === 14)).toBe(
      true,
    );
  });

  it('assigns every task to skills that exist in the entrance track', () => {
    const known = new Set(basic.map((concept) => concept.id));
    for (const paper of JPZ_PAPERS)
      for (const task of paper.tasks) {
        expect(task.skills.length, `${paper.id}/${task.n}`).toBeGreaterThan(0);
        for (const skill of task.skills) expect(known.has(skill), `${paper.id}/${task.n} → ${skill}`).toBe(true);
      }
  });

  it('says how many papers were read, and weighs skills by those alone', () => {
    expect(evidenceFor('M9').papersRead).toBe(20);
    expect(evidenceFor('M7').papersRead).toBe(4);
    expect(evidenceFor('M5').papersRead).toBe(4);
    expect(getGoal('jpz-9').provisional).toBe(false);
    expect(getGoal('jpz-7').provisional).toBe(true);
    expect(getGoal('jpz-5').provisional).toBe(true);
    for (const goal of entrance) {
      const evidence = evidenceFor(VARIANT_OF_GOAL[goal.id]!);
      for (const skill of goal.skills) {
        const found = evidence.skills.get(skill.id);
        const share = (found?.readPoints ?? 0) / evidence.readPoints;
        if (skill.role === 'tested' && share > 0.004)
          expect(skill.weight, `${goal.id} ${skill.id}`).toBeCloseTo(share, 3);
        if (skill.role !== 'tested') expect(skill.weight, `${goal.id} ${skill.id}`).toBe(0);
      }
      const total = goal.skills.reduce((sum, skill) => sum + skill.weight, 0);
      expect(total, goal.id).toBeGreaterThan(0.99);
      expect(total, goal.id).toBeLessThan(1.06);
    }
  });

  it('counts geometric constructions as about a tenth of every variant, and as paper-only', () => {
    for (const goal of entrance) {
      const skill = goalSkillOf(goal.id, 'geom.constructions')!;
      expect(skill.role, goal.id).toBe('tested');
      expect(skill.weight, goal.id).toBeGreaterThan(0.09);
      expect(skill.weight, goal.id).toBeLessThan(0.14);
    }
    expect(getConcept('geom.constructions')!.paperOnly).toBe(true);
  });
});

describe('the specification', () => {
  it('is cited item by item, and every entrance concept names real items', () => {
    expect(new Set(JPZ_SPEC.map((item) => item.id)).size).toBe(JPZ_SPEC.length);
    expect(JPZ_SPEC.filter((item) => item.part === 'A').length).toBe(18);
    expect(JPZ_SPEC.filter((item) => item.part === 'B').length).toBe(34);
    expect(JPZ_SPEC.filter((item) => item.part === 'C').length).toBe(25);
    for (const concept of basic) {
      expect(concept.spec!.length, concept.id).toBeGreaterThan(0);
      for (const id of concept.spec!) expect(getSpecItem(id), `${concept.id} → ${id}`).toBeDefined();
      expect([5, 7, 9], concept.id).toContain(concept.stage);
    }
  });

  it('lists what no concept covers, so that the gap is known and not hidden', () => {
    const covered = new Set(basic.flatMap((concept) => concept.spec ?? []));
    expect(JPZ_SPEC.filter((item) => !covered.has(item.id)).map((item) => item.id)).toEqual([
      'A1.3.1',
      'B1.2.5',
      'B1.3.1',
      'B1.3.2',
      'B1.3.10',
      'C1.3.1',
      'C1.3.8',
      'C1.3.9',
    ]);
  });
});

describe('goals', () => {
  it('keeps the school goal exactly what existed before entrance goals did', () => {
    const school = conceptsOfGoal('school-it-2');
    expect(school.length).toBe(65);
    expect(school.some((concept) => concept.track === 'basic')).toBe(false);
    for (const goal of entrance)
      expect(conceptsOfGoal(goal.id).every((concept) => concept.track === 'basic')).toBe(true);
  });

  it('gives every skill of a goal its prerequisites', () => {
    for (const goal of entrance) {
      const ids = new Set(goal.skills.filter((skill) => skill.role !== 'enrichment').map((skill) => skill.id));
      for (const id of ids)
        for (const pre of getConcept(id)!.prereqs) expect(ids.has(pre), `${goal.id}: ${id} needs ${pre}`).toBe(true);
    }
  });

  it('tests what the papers and the specification say, stage by stage', () => {
    const role = (goal: GoalId, id: string) => goalSkillOf(goal, id)?.role;
    // The eight-year test has no equations, no percent and no cylinders.
    expect(role('jpz-5', 'eqn.linear')).toBeUndefined();
    expect(role('jpz-5', 'solid.cylinder')).toBeUndefined();
    expect(role('jpz-5', 'pct.basics')).toBe('enrichment');
    expect(role('jpz-5', 'word.arith')).toBe('tested');
    // The six-year test has percent and fractions, and equations only as what comes next.
    expect(role('jpz-7', 'pct.basics')).toBe('tested');
    expect(role('jpz-7', 'eqn.linear')).toBe('enrichment');
    expect(role('jpz-7', 'geom.pythagoras')).toBe('enrichment');
    // In the four-year test plain arithmetic is a prerequisite, not a task.
    expect(role('jpz-9', 'num.natural')).toBe('prerequisite');
    expect(role('jpz-9', 'eqn.systems')).toBe('tested');
    expect(getGoal('jpz-9').skills.filter((skill) => skill.role === 'enrichment')).toEqual([]);
  });

  it('starts the diagnostic from skills that belong to the goal and can be practised', () => {
    for (const goal of entrance) {
      expect(goal.anchors.length).toBeGreaterThanOrEqual(8);
      for (const id of goal.anchors) {
        expect(['tested', 'prerequisite'], `${goal.id} ${id}`).toContain(goalSkillOf(goal.id, id)?.role);
        expect(hasProblems(id), id).toBe(true);
      }
    }
  });

  it('dates and sources the facts about each examination', () => {
    for (const goal of entrance) {
      const facts = goal.facts!;
      expect(facts.minutes).toBe(70);
      expect(facts.points).toBe(50);
      expect(facts.open + facts.closed).toBe(facts.tasks);
      expect(facts.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(facts.reviewAfter > facts.retrievedOn).toBe(true);
      for (const source of facts.sources) expect(source.url).toMatch(/^https:\/\/prijimacky\.cermat\.cz\//);
      for (const term of facts.terms) expect(term.day).toMatch(/^2027-04-\d{2}$/);
    }
    expect(GOAL_IDS).toEqual(['school-it-2', 'jpz-9', 'jpz-7', 'jpz-5']);
  });
});

describe('entrance practice tests', () => {
  const blueprints = EXAM_BLUEPRINTS.filter((blueprint) => blueprint.kind === 'entrance');

  it('exist once per entrance goal, and only that goal is offered them', () => {
    expect(blueprints.map((blueprint) => blueprint.goal)).toEqual(['jpz-9', 'jpz-7', 'jpz-5']);
    for (const goal of entrance) {
      const offered = blueprintsOfGoal(goal.id);
      expect(offered.filter((blueprint) => blueprint.kind === 'entrance').map((b) => b.goal)).toEqual([goal.id]);
      expect(offered.some((blueprint) => blueprint.kind === 'chapter' || blueprint.kind === 'annual')).toBe(false);
    }
    expect(blueprintsOfGoal('school-it-2').some((blueprint) => blueprint.kind === 'entrance')).toBe(false);
    expect(blueprintsOfGoal('school-it-2').map((blueprint) => blueprint.id)).toEqual([
      'quick-check',
      'chapter-test',
      'annual-review',
    ]);
  });

  it('add up to the 50 points of the real test once the construction tasks are counted', () => {
    for (const blueprint of blueprints) {
      const loose = blueprint.slots!.filter((slot) => !slot.bundle).reduce((sum, slot) => sum + slot.points, 0);
      const bundled = Object.values(blueprint.bundles!).reduce((sum, table) => sum + table[table.length - 1]!, 0);
      expect(loose + bundled + blueprint.offScreenPoints!, blueprint.id).toBe(50);
      expect(blueprint.minutes, blueprint.id).toBe(Math.round((70 * (loose + bundled)) / 50));
      // The share left out is the share the papers give to constructions.
      const weight = goalSkillOf(blueprint.goal!, 'geom.constructions')!.weight;
      expect(Math.abs(blueprint.offScreenPoints! / 50 - weight), blueprint.id).toBeLessThan(0.03);
    }
  });

  it('score bundles the way the 2026 answer keys do', () => {
    const [nine, seven, five] = blueprints;
    expect(nine!.bundles).toEqual({ tf: [0, 0, 2, 4], match: [0, 2, 4, 6] });
    expect(seven!.bundles).toEqual({ tf: [0, 0, 2, 4], match: [0, 2, 4, 6] });
    expect(five!.bundles).toEqual({ tf: [0, 0, 2, 4], match: [0, 1, 3, 5] });
    for (const blueprint of blueprints)
      for (const [bundle, table] of Object.entries(blueprint.bundles!))
        expect(blueprint.slots!.filter((slot) => slot.bundle === bundle).length, `${blueprint.id} ${bundle}`).toBe(
          table.length - 1,
        );
  });

  it('can fill every slot with a problem of the right skill, format and level', () => {
    const closed = new Set(Object.values(FORMAT_TAGS));
    for (const blueprint of blueprints) {
      for (const slot of blueprint.slots!) {
        const where = `${blueprint.id} slot ${slot.label}`;
        for (const skill of slot.skills)
          expect(goalSkillOf(blueprint.goal!, skill)?.role, `${where} ${skill}`).toMatch(/tested|prerequisite/);
        const fitting = slot.skills
          .flatMap((skill) => generatorsFor(skill))
          .filter((generator) => {
            const tags = generator.tags ?? [];
            const formatOk =
              slot.format === 'open' ? !tags.some((tag) => closed.has(tag)) : tags.includes(FORMAT_TAGS[slot.format]);
            return formatOk && generator.levels.includes(slot.level);
          });
        expect(fitting.length, where).toBeGreaterThan(0);
      }
    }
  });

  it('gets the promised number of options from every closed-format generator', () => {
    const sizes: Record<string, number> = {
      [FORMAT_TAGS.choice]: 5,
      [FORMAT_TAGS.truefalse]: 2,
      [FORMAT_TAGS.matching]: 6,
    };
    const tagged = GENERATORS.filter((generator) => (generator.tags ?? []).some((tag) => tag in sizes));
    expect(tagged.length).toBeGreaterThanOrEqual(18);
    for (const generator of tagged) {
      const size = sizes[generator.tags!.find((tag) => tag in sizes)!]!;
      for (const level of generator.levels)
        for (let seed = 1; seed <= 25; seed++) {
          const answer = generator.generate(createRng(mixSeed(generator.id, level, seed)), level as Level).answer;
          const where = `${generator.id}@${level}#${seed}`;
          expect(answer.kind, where).toBe('choice');
          if (answer.kind !== 'choice') continue;
          expect(answer.options.length, where).toBe(size);
          expect(answer.correct.length, where).toBe(1);
          expect(new Set(answer.options.map((option) => option.text.cs)).size, where).toBe(size);
        }
    }
  });
});
