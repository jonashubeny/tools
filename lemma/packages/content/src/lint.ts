import {
  answerToTex,
  canonicalInput,
  checkAnswer,
  classifyMisconception,
  createRng,
  findCycle,
  isDay,
  mixSeed,
  validateSpec,
  verifyAnswer,
  type AnswerSpec,
  type Concept,
  type ExamBlueprint,
  type FitSnapshot,
  type Generator,
  type L,
  type Lesson,
  type Level,
  type MilestoneDef,
  type Mission,
  type ProblemInstance,
  type RoadmapStage,
  type StaticProblem,
  type SyllabusTopic,
} from '@lemma/core';

/**
 * Content linter: the automated answer to "can the app mark a correct answer wrong?".
 * See docs/content-model.md §4. Used by the test suite; the server also runs the cheap
 * structural part at start-up.
 */

export interface LintIssue {
  where: string;
  message: string;
}

/** Artefacts of careless string building. */
const BAD_IN_MATHS = ['undefined', 'NaN', '[object Object]', 'Infinity'];
/** In prose, "undefined" and "Infinity" are ordinary mathematical words. */
const BAD_IN_PROSE = ['NaN', '[object Object]'];
/** Sign glitches from careless string building: "+ -3", "- -3", "x + + 2". */
const SIGN_GLITCH = /[+\-−]\s*[+\-−]/;
/**
 * A canonical answer is also what the learner is shown as "the correct answer", so it has
 * to be written the way a person would write it: not "4x + (−6)" and not "1x − 3".
 */
const AWKWARD_ANSWER =
  /[+\-]\s*\\left\(-|(^|[^\d.,{])1x|(^|[^\d.,{])1\\left\(|(^|[^\d.,{])1(\\,)?\\sqrt|[+\-] -|(^|[^\d.,{])[01]\\mathrm/;

function texSegments(text: string): string[] {
  const out: string[] = [];
  const pattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) out.push(match[1] ?? match[2]!);
  return out;
}

export type TexValidator = (tex: string) => string | null;

function checkText(issues: LintIssue[], where: string, text: L | undefined, validateTex?: TexValidator): void {
  if (!text) {
    issues.push({ where, message: 'missing text' });
    return;
  }
  for (const locale of ['cs', 'en'] as const) {
    const value = text[locale];
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push({ where: `${where}.${locale}`, message: 'empty text' });
      continue;
    }
    for (const fragment of BAD_IN_PROSE) {
      if (value.includes(fragment))
        issues.push({ where: `${where}.${locale}`, message: `contains "${fragment}": ${value.slice(0, 120)}` });
    }
    if ((value.match(/\$/g) ?? []).length % 2 !== 0) {
      issues.push({ where: `${where}.${locale}`, message: `unbalanced $ in: ${value.slice(0, 120)}` });
      continue;
    }
    for (const tex of texSegments(value)) checkTex(issues, `${where}.${locale}`, tex, validateTex);
  }
}

function checkTex(issues: LintIssue[], where: string, tex: string, validateTex?: TexValidator): void {
  for (const fragment of BAD_IN_MATHS) {
    if (tex.includes(fragment)) issues.push({ where, message: `maths contains "${fragment}": ${tex}` });
  }
  if (SIGN_GLITCH.test(tex)) issues.push({ where, message: `sign glitch in maths: ${tex}` });
  const error = validateTex?.(tex);
  if (error) issues.push({ where, message: `invalid LaTeX (${error}): ${tex}` });
}

/** Check one generated (or static) problem. */
export function lintInstance(instance: ProblemInstance, where: string, validateTex?: TexValidator): LintIssue[] {
  const issues: LintIssue[] = [];
  const spec: AnswerSpec = instance.answer;

  checkText(issues, `${where} prompt`, instance.prompt, validateTex);

  const specError = validateSpec(spec);
  if (specError) {
    issues.push({ where: `${where} answer`, message: specError });
    return issues;
  }

  for (const locale of ['cs', 'en'] as const) {
    const shown = answerToTex(spec, locale);
    if (AWKWARD_ANSWER.test(shown))
      issues.push({ where: `${where} answer`, message: `canonical answer is written awkwardly: ${shown}` });
  }

  // The canonical answer must be accepted, in both comma modes.
  const input = canonicalInput(spec);
  for (const decimalComma of [false, true]) {
    const result = checkAnswer(spec, input, instance.misconceptions ?? [], { decimalComma });
    if (result.verdict !== 'correct') {
      issues.push({
        where: `${where} answer`,
        message: `canonical answer "${input}" is not accepted (decimalComma=${decimalComma}): ${result.verdict}${result.verdict === 'invalid' ? ` — ${result.message.en}` : ''}`,
      });
    }
  }

  for (const [index, misconception] of (instance.misconceptions ?? []).entries()) {
    // A misconception describes a wrong result, so it is classified as content rather than
    // checked as learner input (which would have to be fully evaluated).
    const status = classifyMisconception(spec, misconception.answer);
    if (status !== 'distinct') {
      issues.push({
        where: `${where} misconception[${index}]`,
        message: `"${misconception.answer}" is ${status}, expected a distinct wrong answer`,
      });
    }
    checkText(issues, `${where} misconception[${index}].note`, misconception.note, validateTex);
  }

  if (spec.kind !== 'self' && instance.hints.length < 2) {
    issues.push({ where: `${where} hints`, message: `needs at least 2 hints, has ${instance.hints.length}` });
  }
  instance.hints.forEach((hint, index) => checkText(issues, `${where} hint[${index}]`, hint, validateTex));

  if (instance.solution.length === 0) issues.push({ where: `${where} solution`, message: 'empty solution' });
  instance.solution.forEach((solutionStep, index) => {
    checkText(issues, `${where} solution[${index}]`, solutionStep.text, validateTex);
    if (solutionStep.math !== undefined) {
      const maths =
        typeof solutionStep.math === 'string' ? [solutionStep.math] : [solutionStep.math.cs, solutionStep.math.en];
      for (const tex of maths) checkTex(issues, `${where} solution[${index}].math`, tex, validateTex);
    }
  });

  if ('label' in spec && spec.label) checkTex(issues, `${where} answer.label`, spec.label, validateTex);
  if (spec.kind === 'choice')
    spec.options.forEach((option, index) => checkText(issues, `${where} option[${index}]`, option.text, validateTex));
  if (spec.kind === 'spot')
    spec.lines.forEach((line, index) => checkTex(issues, `${where} line[${index}]`, line.tex, validateTex));
  if (spec.kind === 'self') {
    checkText(issues, `${where} model`, spec.model, validateTex);
    spec.rubric.forEach((item, index) => checkText(issues, `${where} rubric[${index}]`, item, validateTex));
  }

  for (const failure of verifyAnswer(spec, instance.verify ?? [])) {
    issues.push({ where: `${where} verify`, message: failure });
  }

  return issues;
}

/** Exercise a generator over many seeds at every level it declares. */
export function lintGenerator(generator: Generator, seeds = 40, validateTex?: TexValidator): LintIssue[] {
  const issues: LintIssue[] = [];
  if (generator.levels.length === 0) issues.push({ where: generator.id, message: 'declares no levels' });
  for (const level of generator.levels) {
    if (!(generator.estSeconds(level) > 0))
      issues.push({ where: `${generator.id}@${level}`, message: 'estSeconds must be positive' });
    for (let seed = 1; seed <= seeds; seed++) {
      const where = `${generator.id}@${level}#${seed}`;
      let instance: ProblemInstance;
      try {
        instance = generator.generate(createRng(mixSeed(generator.id, level, seed)), level as Level);
      } catch (error) {
        issues.push({ where, message: `generate() threw: ${error instanceof Error ? error.message : String(error)}` });
        continue;
      }
      // Determinism: the same seed must give the same problem.
      const again = generator.generate(createRng(mixSeed(generator.id, level, seed)), level as Level);
      if (JSON.stringify(again) !== JSON.stringify(instance))
        issues.push({ where, message: 'not deterministic for a fixed seed' });
      issues.push(...lintInstance(instance, where, validateTex));
      // What the generator itself can tell is wrong with this instance.
      for (const message of generator.audit?.(createRng(mixSeed(generator.id, level, seed)), level as Level) ?? [])
        issues.push({ where, message });
      if (issues.length > 25) return issues;
    }
  }
  return issues;
}

// ------------------------------------------------------------------- structural checks

export interface ContentBundle {
  concepts: readonly Concept[];
  syllabus: readonly SyllabusTopic[];
  lessons: readonly Lesson[];
  generators: readonly Generator[];
  staticProblems: readonly StaticProblem[];
  missions: readonly Mission[];
  snapshots: readonly FitSnapshot[];
  roadmap: readonly RoadmapStage[];
  examBlueprints: readonly ExamBlueprint[];
  milestones: readonly MilestoneDef[];
}

const LAB_TOOLS = new Set([
  'grapher',
  'transform',
  'linear',
  'quadratic',
  'absolute',
  'power',
  'inverse',
  'explog',
  'unitcircle',
  'sinusoid',
  'complex',
]);

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

/**
 * Structural validation of the whole content bundle: references, uniqueness, the
 * prerequisite graph, and the rule that only syllabus concepts may claim a syllabus topic.
 */
export function lintContent(bundle: ContentBundle, validateTex?: TexValidator): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (where: string, message: string): void => void issues.push({ where, message });

  const conceptIds = new Set(bundle.concepts.map((concept) => concept.id));
  const topicNumbers = new Set(bundle.syllabus.map((topic) => topic.n));
  const generators = new Map(bundle.generators.map((generator) => [generator.id, generator]));
  const current = bundle.snapshots[bundle.snapshots.length - 1];
  const courseCodes = new Set(current?.courses.map((course) => course.code) ?? []);

  for (const [label, ids] of [
    ['concept', bundle.concepts.map((c) => c.id)],
    ['generator', bundle.generators.map((g) => g.id)],
    ['static problem', bundle.staticProblems.map((p) => p.id)],
    ['mission', bundle.missions.map((m) => m.id)],
    ['milestone', bundle.milestones.map((m) => m.id)],
    ['exam blueprint', bundle.examBlueprints.map((b) => b.id)],
    ['lesson', bundle.lessons.map((l) => l.concept)],
  ] as const) {
    for (const id of duplicates(ids)) add(label, `duplicate id "${id}"`);
  }
  for (const id of duplicates([...bundle.generators.map((g) => g.id), ...bundle.staticProblems.map((p) => p.id)])) {
    add('problem ids', `"${id}" is used by both a generator and a static problem`);
  }

  // ---- syllabus
  const expected = bundle.syllabus.map((_, index) => index + 1);
  if (bundle.syllabus.some((topic, index) => topic.n !== expected[index]))
    add('syllabus', 'topics must be numbered 1..n in order');
  for (const topic of bundle.syllabus) {
    checkText(issues, `syllabus[${topic.n}].title`, topic.title, validateTex);
    if (!bundle.concepts.some((concept) => concept.syllabusTopic === topic.n && !concept.deprecated)) {
      add(`syllabus[${topic.n}]`, 'no concept belongs to this topic');
    }
  }

  // ---- concepts
  for (const concept of bundle.concepts) {
    const where = `concept ${concept.id}`;
    checkText(issues, `${where}.title`, concept.title, validateTex);
    checkText(issues, `${where}.summary`, concept.summary, validateTex);
    for (const [lens, text] of Object.entries(concept.why ?? {}))
      checkText(issues, `${where}.why.${lens}`, text, validateTex);
    for (const term of concept.terms ?? []) {
      if (!term.cs.trim() || !term.en.trim()) add(`${where}.terms`, 'empty term');
    }
    // The syllabus rule: only school concepts are on the syllabus, and every one of them is.
    if (concept.track === 'school') {
      if (concept.syllabusTopic === undefined) add(where, 'track "school" requires a syllabusTopic');
      else if (!topicNumbers.has(concept.syllabusTopic))
        add(where, `syllabusTopic ${concept.syllabusTopic} does not exist`);
    } else if (concept.syllabusTopic !== undefined) {
      add(where, `only "school" concepts may have a syllabusTopic (track is "${concept.track}")`);
    }
    for (const pre of concept.prereqs) {
      if (pre === concept.id) add(where, 'lists itself as a prerequisite');
      else if (!conceptIds.has(pre)) add(where, `unknown prerequisite "${pre}"`);
    }
    for (const enc of concept.encompasses ?? []) {
      if (!conceptIds.has(enc.id)) add(where, `encompasses unknown concept "${enc.id}"`);
      if (!(enc.w > 0 && enc.w <= 1)) add(where, `encompasses weight for "${enc.id}" must be in (0, 1]`);
    }
    for (const code of concept.fit ?? []) {
      if (!courseCodes.has(code)) add(where, `FIT course "${code}" is not in the current snapshot`);
    }
    if (concept.lab && !LAB_TOOLS.has(concept.lab.tool)) add(where, `unknown lab tool "${concept.lab.tool}"`);
    for (const resource of concept.resources ?? []) {
      if (!/^https?:\/\//.test(resource.url)) add(where, `resource URL "${resource.url}" is not absolute`);
    }
  }
  const cycle = findCycle(bundle.concepts);
  if (cycle) add('prerequisite graph', `cycle: ${cycle.join(' → ')}`);

  // ---- generators
  for (const generator of bundle.generators) {
    const where = `generator ${generator.id}`;
    if (!conceptIds.has(generator.concept)) add(where, `unknown concept "${generator.concept}"`);
    if (new Set(generator.levels).size !== generator.levels.length) add(where, 'duplicate levels');
    if (generator.levels.some((level) => level < 1 || level > 5)) add(where, 'levels must be 1–5');
    checkText(issues, `${where}.title`, generator.title, validateTex);
  }

  // ---- static problems
  for (const problem of bundle.staticProblems) {
    const where = `static ${problem.id}`;
    if (!conceptIds.has(problem.concept)) add(where, `unknown concept "${problem.concept}"`);
    for (const other of problem.alsoRequires ?? [])
      if (!conceptIds.has(other)) add(where, `alsoRequires unknown concept "${other}"`);
    if (!(problem.estSeconds > 0)) add(where, 'estSeconds must be positive');
    checkText(issues, `${where}.title`, problem.title, validateTex);
    issues.push(...lintInstance(problem, where, validateTex));
  }

  // ---- lessons
  for (const lesson of bundle.lessons) {
    const where = `lesson ${lesson.concept}`;
    if (!conceptIds.has(lesson.concept)) add(where, 'unknown concept');
    if (!lesson.steps.some((s) => s.kind === 'check')) add(where, 'a lesson must end in at least one check problem');
    lesson.steps.forEach((s, index) => {
      const at = `${where} step[${index}]`;
      switch (s.kind) {
        case 'text':
          checkText(issues, at, s.body, validateTex);
          break;
        case 'predict':
          checkText(issues, `${at}.question`, s.question, validateTex);
          checkText(issues, `${at}.reveal`, s.reveal, validateTex);
          s.options.forEach((option, i) => checkText(issues, `${at}.option[${i}]`, option.text, validateTex));
          if (s.correct !== undefined && !s.options.some((option) => option.id === s.correct))
            add(at, 'correct option does not exist');
          break;
        case 'explore':
          if (!LAB_TOOLS.has(s.lab.tool)) add(at, `unknown lab tool "${s.lab.tool}"`);
          checkText(issues, `${at}.task`, s.task, validateTex);
          checkText(issues, `${at}.observe`, s.observe, validateTex);
          break;
        case 'figure':
          checkText(issues, `${at}.caption`, s.caption, validateTex);
          break;
        case 'worked':
          checkText(issues, `${at}.title`, s.title, validateTex);
          s.steps.forEach((w, i) => {
            checkText(issues, `${at}.steps[${i}].text`, w.text, validateTex);
            if (w.why) checkText(issues, `${at}.steps[${i}].why`, w.why, validateTex);
            if (w.math !== undefined) {
              for (const tex of typeof w.math === 'string' ? [w.math] : [w.math.cs, w.math.en])
                checkTex(issues, `${at}.steps[${i}].math`, tex, validateTex);
            }
          });
          break;
        case 'check': {
          const generator = generators.get(s.generator);
          if (!generator) add(at, `unknown generator "${s.generator}"`);
          else if (!generator.levels.includes(s.level)) add(at, `generator "${s.generator}" has no level ${s.level}`);
          break;
        }
        case 'summary':
          s.points.forEach((point, i) => checkText(issues, `${at}.points[${i}]`, point, validateTex));
          break;
      }
    });
  }

  // ---- missions
  for (const mission of bundle.missions) {
    const where = `mission ${mission.id}`;
    for (const id of mission.concepts) if (!conceptIds.has(id)) add(where, `unknown concept "${id}"`);
    for (const id of duplicates(mission.milestones.map((m) => m.id))) add(where, `duplicate milestone "${id}"`);
    checkText(issues, `${where}.title`, mission.title, validateTex);
    checkText(issues, `${where}.brief`, mission.brief, validateTex);
    checkText(issues, `${where}.payoff`, mission.payoff, validateTex);
    mission.milestones.forEach((m) => {
      checkText(issues, `${where}.${m.id}.title`, m.title, validateTex);
      checkText(issues, `${where}.${m.id}.detail`, m.detail, validateTex);
    });
    (mission.stretch ?? []).forEach((text, i) => checkText(issues, `${where}.stretch[${i}]`, text, validateTex));
  }

  // ---- FIT snapshots
  if (bundle.snapshots.length === 0) add('fit', 'no snapshot');
  for (const snapshot of bundle.snapshots) {
    const where = `fit snapshot ${snapshot.retrievedOn}`;
    if (!isDay(snapshot.retrievedOn) || !isDay(snapshot.reviewAfter))
      add(where, 'retrievedOn / reviewAfter must be ISO dates');
    else if (snapshot.reviewAfter <= snapshot.retrievedOn) add(where, 'reviewAfter must be later than retrievedOn');
    const sourceUrls = new Set(snapshot.sources.map((source) => source.url));
    for (const fact of [...snapshot.programme.facts, ...snapshot.admission.facts]) {
      checkText(issues, `${where} fact`, fact.text, validateTex);
      if (!sourceUrls.has(fact.source)) add(where, `fact cites a source that is not listed: ${fact.source}`);
    }
    for (const id of duplicates(snapshot.admission.routes.map((route) => route.id)))
      add(where, `duplicate route "${id}"`);
    for (const id of duplicates(snapshot.courses.map((course) => course.code))) add(where, `duplicate course "${id}"`);
    for (const route of snapshot.admission.routes) {
      checkText(issues, `${where} route ${route.id}.title`, route.title, validateTex);
      checkText(issues, `${where} route ${route.id}.detail`, route.detail, validateTex);
      if (route.note) checkText(issues, `${where} route ${route.id}.note`, route.note, validateTex);
    }
    for (const course of snapshot.courses) {
      checkText(issues, `${where} course ${course.code}.name`, course.name, validateTex);
      checkText(issues, `${where} course ${course.code}.covers`, course.covers, validateTex);
      checkText(issues, `${where} course ${course.code}.prerequisite`, course.statedPrerequisite, validateTex);
      if (!/^https:\/\/www\.fit\.vut\.cz\//.test(course.url))
        add(where, `course ${course.code} must link to fit.vut.cz`);
    }
    for (const item of snapshot.bridge.items) {
      checkText(issues, `${where} bridge item`, item.text, validateTex);
      for (const id of item.concepts)
        if (!conceptIds.has(id)) add(where, `bridge item refers to unknown concept "${id}"`);
    }
  }

  // ---- roadmap, exams, milestones
  for (const stage of bundle.roadmap) {
    checkText(issues, `roadmap ${stage.id}.title`, stage.title, validateTex);
    checkText(issues, `roadmap ${stage.id}.description`, stage.description, validateTex);
    for (const group of stage.groups) {
      checkText(issues, `roadmap ${stage.id} group`, group.title, validateTex);
      for (const id of group.concepts) if (!conceptIds.has(id)) add(`roadmap ${stage.id}`, `unknown concept "${id}"`);
    }
  }
  for (const blueprint of bundle.examBlueprints) {
    checkText(issues, `exam ${blueprint.id}.title`, blueprint.title, validateTex);
    checkText(issues, `exam ${blueprint.id}.description`, blueprint.description, validateTex);
    if (blueprint.items < 1 || blueprint.minutes < 1) add(`exam ${blueprint.id}`, 'items and minutes must be positive');
    const total = Object.values(blueprint.levelMix).reduce((sum, share) => sum + (share ?? 0), 0);
    if (Math.abs(total - 1) > 1e-6) add(`exam ${blueprint.id}`, `levelMix shares must sum to 1 (got ${total})`);
  }
  for (const milestone of bundle.milestones) {
    checkText(issues, `milestone ${milestone.id}.title`, milestone.title, validateTex);
    checkText(issues, `milestone ${milestone.id}.description`, milestone.description, validateTex);
  }

  return issues;
}

/** Concepts that have nothing to practise with yet — reported, not treated as errors. */
export function conceptsWithoutProblems(bundle: ContentBundle): string[] {
  const covered = new Set([...bundle.generators.map((g) => g.concept), ...bundle.staticProblems.map((p) => p.concept)]);
  return bundle.concepts
    .filter((concept) => !concept.deprecated && !covered.has(concept.id))
    .map((concept) => concept.id);
}
