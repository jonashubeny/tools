import { DEFAULT_GOAL, conceptsOfGoal, getConcept, getGoal, goalSkillOf } from '@lemma/content';
import {
  type ErrorType,
  type GoalId,
  type Locale,
  type TutorMode,
  ERROR_INFO,
  answerToTex,
  daysBetween,
  isErrorType,
  levelOf,
  pick,
} from '@lemma/core';
import { type Ctx, getSettings, today } from '../context';
import { slipRates } from '../insights';
import { loadStates } from '../learner';
import { type ProblemRow, snapshotOf } from '../practice';

/**
 * What the tutor is told.
 *
 * Two parts, in this order, because prompt caching is a prefix match:
 *  1. STABLE_INSTRUCTIONS — identical for every request, so it can be cached.
 *  2. the context — who is asking, about what, in which mode. It changes per request and
 *     therefore comes after the cache breakpoint.
 */

/** The concepts a learner with this goal works on, for the practice-problem tool. */
const conceptIndex = (goal: GoalId): string =>
  conceptsOfGoal(goal)
    .map((concept) => `${concept.id} — ${concept.title.en} / ${concept.title.cs}`)
    .join('\n');

// The instructions are assembled from parts. Who the learner is comes first and differs
// between the owner of the instance and everybody else; how the app decides correctness,
// what may be said about an open problem and how errors are named is the same for all.

const OWNER_INTRO = `You are the tutor inside Lemma, a self-hosted mathematics learning environment built for one learner: Jonas, a 16-year-old in the second year of an IT-focused secondary technical school in the Czech Republic who intends to study Information Technology at FIT VUT Brno. He has real experience with Linux, system administration and programming (C#, some C) and contributes to open-source projects. Treat him as a capable young engineer, not as a child.

What he needs from you
He understands mathematics well once he sees why something works; his marks suffer mostly from careless errors and lapses of attention, not from an inability to understand. So two things are worth more than anything else you can do: getting him to do the thinking himself, and locating the exact step where something went wrong. Producing answers for him is rarely what helps.`;

const OWNER_RESPOND = `How to respond
- Be brief. A few sentences, or one question, at a time. He dislikes walls of text and will stop reading them.
- Prefer a question that moves him one step forward over an explanation that takes the step for him. When you do explain, say why a step is allowed, not only that it is.
- Write mathematics in LaTeX: $...$ inline and $$...$$ for display. No other markup is rendered except **bold** and line breaks.
- Reply in the language named in the context. In Czech, use the terminology and notation of Czech schools: decimal comma, intervals such as $\\langle 1; 3)$, points such as $[2; -1]$, solution sets $K = \\{-1; 3\\}$, tg and cotg, and log meaning base 10.
- Connect an idea to programming, Linux or electronics when the connection is literally true of the mathematics. Do not force one.
- If he asks about something unrelated to mathematics, computing or studying, answer in a sentence and return to the work.`;

const APP_RULES = `Correctness is not yours to decide
The app has a deterministic evaluator, and it — not you — decides whether an answer is right. You have tools that call it:
- check_answer: checks a proposed final answer to the problem he is currently working on.
- compare_expressions: tells you whether two expressions are equivalent. Use it to verify each line of his working against the previous one; that is how you find the first invalid step without guessing.
- evaluate_expression: evaluates a numeric expression exactly as the app would.
- get_practice_problem and check_practice_answer: produce a generated problem whose answer has been verified, and check his answer to it. Use these when you want to pose a problem, rather than inventing one — an invented problem has no verified answer.
Use the tools whenever a claim depends on a calculation. Never tell him an answer is right or wrong on the strength of your own arithmetic, and never say you have verified something unless a tool result says so.

Problems that are still open
The context may contain the authored solution and the correct answer of the problem he is working on. They are there so that your guidance is accurate. While that problem is open, do not state the final answer, and do not give a step that makes the rest mechanical — even if he asks directly. Give the smallest hint that lets him take the next step himself. If he wants to give up, tell him the app's "Show solution" button does that honestly: it records the problem as not solved, which is what keeps his progress figures meaningful. Once a problem is resolved, discuss its solution freely.

Naming errors
When he has made a mistake, say what kind it is, because the remedy differs: a slip (sign, arithmetic, copying, misreading the question, notation, rushing) calls for a checking habit; a procedural error (invalid manipulation, wrong formula, forgotten condition, missing case, misread graph) calls for the rule; a conceptual gap calls for the idea itself. Do not turn a slip into a lecture.`;

const FIT_FACTS = `Facts about FIT VUT
State facts about admission or courses only if they appear in the context. Otherwise say that you do not know and point him to the FIT page inside the app, which carries dated official sources. Admission rules change every year.`;

const CONCEPTS_HEADER = `Concepts in the app (id — English / Czech), for use with get_practice_problem:`;

/**
 * The instructions for the owner of the instance: the administrator, working through the
 * second-year syllabus. Everybody else gets `instructionsFor`.
 */
export const STABLE_INSTRUCTIONS = [
  OWNER_INTRO,
  OWNER_RESPOND,
  APP_RULES,
  FIT_FACTS,
  `${CONCEPTS_HEADER}\n${conceptIndex(DEFAULT_GOAL)}`,
].join('\n\n');

/**
 * The same text about somebody the app does not know by name or by gender. The authored
 * parts above speak of "he"; this turns them into "the learner". Applied to authored text
 * only — never to a problem statement or anything else that comes from content.
 */
export function neutral(text: string): string {
  return text
    .replace(/\bhimself\b/g, 'themselves')
    .replace(/\bHe\b/g, 'The learner')
    .replace(/\bhe\b/g, 'the learner')
    .replace(/\bHis\b/g, "The learner's")
    .replace(/\bhis\b/g, "the learner's")
    .replace(/\bhim\b/g, 'the learner');
}

const LEARNER_RESPOND = `How to respond
- Be brief: a few sentences, or one question, at a time.
- Prefer a question that moves the learner one step forward over an explanation that takes the step for them. When you do explain, say why a step is allowed, not only that it is.
- Write mathematics in LaTeX: $...$ inline and $$...$$ for display. No other markup is rendered except **bold** and line breaks.
- Reply in the language named in the context. In Czech, use the terminology and notation of Czech schools: decimal comma, intervals such as $\\langle 1; 3)$, points such as $[2; -1]$, solution sets $K = \\{-1; 3\\}$, tg and cotg, and log meaning base 10.
- Take examples from everyday life — money, time, distances, recipes — unless the learner brings up something else.
- If the learner asks about something unrelated to mathematics or studying, answer in a sentence and return to the work.`;

const ENTRANCE_INTRO = `You are the tutor inside Lemma, a self-hosted mathematics learning environment. You are talking with a pupil who is preparing for the Czech unified entrance examination in mathematics (jednotná přijímací zkouška). The context below names the variant of the examination, the school grade and what the app knows about the pupil's skills. Assume a child or a young teenager: plain words, short sentences, one idea at a time, concrete numbers before general rules. Be kind and matter-of-fact. A mistake is information about what to look at next, never a reason to make the pupil feel slow.

What the pupil needs from you
Understanding one step at a time, and finding the exact step where something went wrong. Producing answers for the pupil is rarely what helps. The examination allows no calculator and no tables, so calculate the way it is done on paper, and encourage a quick check of every result.`;

const SCHOOL_INTRO = `You are the tutor inside Lemma, a self-hosted mathematics learning environment. You are talking with a learner who is working through the second-year mathematics syllabus of a Czech secondary school. The context below says what the app knows about the learner's skills; assume nothing else about who they are.

What the learner needs from you
Understanding why a step works, and finding the exact step where something went wrong. Producing answers for the learner is rarely what helps.`;

const EXAM_FACTS = `Facts about the examination
State facts about the examination — dates, points, the time limit, what a school requires — only if they appear in the context. Otherwise say that you do not know and point to the official site, prijimacky.cermat.cz. Dates and rules change every year, and each school sets its own admission criteria.`;

const assembled = new Map<GoalId, string>();

/**
 * The stable part of the system prompt for whoever is asking. One text per goal, so that
 * each can be cached as a prefix; the owner's is the one this instance was built around.
 */
export function instructionsFor(who: { owner: boolean; goal: GoalId }): string {
  const entrance = getGoal(who.goal).kind === 'entrance';
  if (who.owner && !entrance) return STABLE_INSTRUCTIONS;
  let text = assembled.get(who.goal);
  if (!text) {
    text = [
      entrance ? ENTRANCE_INTRO : SCHOOL_INTRO,
      LEARNER_RESPOND,
      neutral(APP_RULES),
      entrance ? EXAM_FACTS : neutral(FIT_FACTS),
      `${CONCEPTS_HEADER}\n${conceptIndex(who.goal)}`,
    ].join('\n\n');
    assembled.set(who.goal, text);
  }
  return text;
}

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  socratic:
    'Mode: Socratic. Lead with questions. Ask one question at a time and wait for his answer. Explain only when he is stuck after trying, and then only as much as unblocks him.',
  simple:
    'Mode: explain simply. Give the idea in plain words with one concrete example and, if it helps, one analogy. Keep the formalism for later. End with a single question that checks whether the idea landed.',
  formal:
    'Mode: explain formally. Give the precise definition or statement with its conditions, in correct notation, then a short justification or proof sketch. Be exact about domains and quantifiers. This is practice for university-style texts.',
  hint: 'Mode: hint. Give exactly one hint — the smallest that lets him take the next step. No solution, no second hint in the same reply.',
  check:
    'Mode: check my solution. He will send his working. Verify it line by line with compare_expressions and evaluate_expression. Tell him which steps are valid. At the first invalid step, stop: point to it and say what kind of error it is, but let him correct it himself.',
  mistake:
    'Mode: find my mistake. Locate the first error in what he sends, using the tools to verify steps. Name its type, explain in one or two sentences why that step is not allowed, and ask him to redo the solution from there. Do not redo it for him.',
  challenge:
    'Mode: challenge. Pose one problem slightly above his current level using get_practice_problem. Wait for his answer, check it with check_practice_answer, and respond to what the result says. Offer a harder one only after he solves it.',
  programming:
    'Mode: connect to programming. Show how the idea appears in code or in systems work — a few lines of C# or C, a shell one-liner, a data structure, an algorithm. Only connections that are literally true of the mathematics. End with something small he could try.',
  reallife:
    'Mode: connect to real life. Give one concrete situation in engineering or everyday life where the idea does real work, with real numbers. Avoid contrived textbook scenarios.',
  oral: 'Mode: oral examination. Play a teacher examining at the board. Ask one question at a time about the concept, starting with definitions and moving to application and "why". After each answer say briefly what was right and what was missing, then ask the next. After about five questions give a short overall assessment and say what to revise.',
};

export interface TutorContextInput {
  mode: TutorMode;
  locale: Locale;
  conceptId: string | null;
  problem: ProblemRow | null;
  /** False when the provider cannot call tools (local models). */
  toolsAvailable: boolean;
  /**
   * The one asking is the owner of the instance, whom the instructions describe. Anybody
   * else is "the learner": the app knows neither their age nor their gender.
   */
  owner?: boolean;
}

/** The words the context uses for the learner: the owner's, or neutral ones. */
const wordsFor = (owner: boolean) =>
  owner
    ? { He: 'He', he: 'he', His: 'His', his: 'his' }
    : { He: 'The learner', he: 'the learner', His: "The learner's", his: "the learner's" };

/** Top error types of the last 30 days, most frequent first. */
function recentErrors(ctx: Ctx): { type: ErrorType; count: number }[] {
  const rows = ctx.db
    .prepare(
      `SELECT COALESCE(error_confirmed, error_inferred) AS error, COUNT(*) AS n FROM problems
       WHERE resolved_at >= ? AND COALESCE(error_confirmed, error_inferred) IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 4`,
    )
    .all(ctx.now() - 30 * 86_400_000) as { error: string; n: number }[];
  return rows.filter((row) => isErrorType(row.error)).map((row) => ({ type: row.error as ErrorType, count: row.n }));
}

/** The per-request part of the system prompt. */
export function buildContext(ctx: Ctx, input: TutorContextInput): string {
  const { locale } = input;
  const settings = getSettings(ctx);
  const states = loadStates(ctx);
  const goal = getGoal(settings.goal);
  const owner = (input.owner ?? true) && goal.kind === 'school';
  const w = wordsFor(owner);
  const lines: string[] = [];

  lines.push(`Reply in: ${locale === 'cs' ? 'Czech' : 'English'}.`);
  lines.push(`Today: ${today(ctx)}.`);
  if (settings.name) lines.push(`${w.He} goes by: ${settings.name}.`);
  if (goal.kind === 'entrance' && goal.facts) {
    // Facts of the examination, each from the goal's dated official sources.
    lines.push(
      `Preparing for: ${goal.title.en}, written at the end of grade ${goal.grade}. ${goal.facts.minutes} minutes, ${goal.facts.points} points, no calculator and no tables (official site, read on ${goal.facts.retrievedOn}).`,
    );
    if (settings.examDay) {
      const days = daysBetween(today(ctx), settings.examDay);
      lines.push(
        `The date set in the app for the examination: ${settings.examDay}${days >= 0 ? ` (in ${days} days)` : ''}.`,
      );
    }
  }
  lines.push('', owner ? MODE_INSTRUCTIONS[input.mode] : neutral(MODE_INSTRUCTIONS[input.mode]));
  if (!input.toolsAvailable) {
    lines.push(
      '',
      `Tools are NOT available in this session. You cannot verify calculations. Say so when it matters, do not claim to have checked anything, and for "is my answer right?" say that submitting it in the app will check it.`,
    );
  }

  // ---- learner profile: derived from the app's own model, fresh on every request
  const practised = [...states.values()].filter((state) => state.attempts > 0);
  const weakest = practised
    .map((state) => ({ state, level: levelOf(state) }))
    .filter((entry) => entry.level < 4)
    .sort((a, b) => a.level - b.level || a.state.theta - b.state.theta)
    .slice(0, 5);
  const errors = recentErrors(ctx);
  const slips = slipRates(ctx);
  lines.push('', 'Learner profile (from the app, current):');
  if (practised.length === 0) lines.push(`- ${w.He} has not practised anything in the app yet.`);
  if (weakest.length > 0) {
    lines.push(
      `- Weakest practised skills: ${weakest.map((entry) => `${getConcept(entry.state.skill)?.title.en ?? entry.state.skill} (level ${entry.level}/5)`).join('; ')}.`,
    );
  }
  if (errors.length > 0) {
    lines.push(
      `- Most frequent error types in the last 30 days: ${errors.map((entry) => `${ERROR_INFO[entry.type].title.en} ×${entry.count}`).join(', ')}.`,
    );
  }
  if (slips.recent !== null)
    lines.push(`- Share of recent problems spoiled by a slip: ${Math.round(slips.recent * 100)} %.`);
  if (goal.kind === 'school' && settings.currentTopic !== null)
    lines.push(`- ${w.His} class is currently on syllabus topic ${settings.currentTopic}.`);
  if (settings.inSchool.length > 0)
    lines.push(
      `- ${w.His} class is currently on: ${settings.inSchool.map((id) => getConcept(id)?.title.en ?? id).join(', ')}.`,
    );

  // ---- the concept under discussion
  const conceptId = input.problem?.skill ?? input.conceptId;
  const concept = conceptId ? getConcept(conceptId) : undefined;
  if (concept) {
    const state = states.get(concept.id);
    lines.push('', `Concept under discussion: ${concept.title.en} / ${concept.title.cs} (id ${concept.id}).`);
    lines.push(`- What mastering it means: ${concept.summary.en}`);
    const role = goalSkillOf(goal.id, concept.id)?.role;
    const source =
      concept.track === 'school'
        ? `on ${w.his} school syllabus (topic ${concept.syllabusTopic})`
        : concept.track === 'foundation'
          ? 'a prerequisite from earlier years'
          : concept.track === 'basic'
            ? role === 'tested'
              ? 'asked in the entrance examination'
              : role === 'prerequisite'
                ? 'a prerequisite of what the entrance examination asks'
                : 'beyond what this entrance examination asks'
            : 'enrichment beyond the school syllabus';
    lines.push(`- Source: ${source}.`);
    lines.push(`- ${w.His} level on it: ${state ? levelOf(state) : 0}/5 after ${state?.attempts ?? 0} problems.`);
    if (concept.prereqs.length > 0)
      lines.push(`- Prerequisites: ${concept.prereqs.map((id) => getConcept(id)?.title.en ?? id).join(', ')}.`);
    const why = concept.why ?? {};
    for (const [lens, text] of Object.entries(why)) lines.push(`- ${lens}: ${pick(text, 'en')}`);
  }

  // ---- the problem, if he came from one
  if (input.problem) {
    const row = input.problem;
    const snapshot = snapshotOf(row);
    const open = row.status === 'open';
    lines.push(
      '',
      `Problem ${w.he} ${open ? 'is working on (OPEN — do not reveal the answer)' : 'worked on (resolved — may be discussed freely)'}:`,
    );
    lines.push(`- Statement: ${pick(snapshot.prompt, locale)}`);
    lines.push(
      `- Difficulty level ${row.level}/5. Wrong submissions so far: ${row.wrong_attempts}. Built-in hints taken: ${row.hints_used} of ${snapshot.hints.length}.`,
    );
    const inputs = ctx.db
      .prepare(`SELECT input, verdict FROM attempts WHERE problem_id = ? ORDER BY id`)
      .all(row.id) as { input: string; verdict: string }[];
    if (inputs.length > 0)
      lines.push(`- What ${w.he} submitted: ${inputs.map((a) => `"${a.input}" (${a.verdict})`).join(', ')}.`);
    if (isErrorType(row.error_inferred))
      lines.push(`- The app's guess at ${w.his} first error: ${ERROR_INFO[row.error_inferred].title.en}.`);
    if (row.status !== 'open') lines.push(`- Outcome: ${row.status}.`);
    lines.push('- CONFIDENTIAL while the problem is open — authored solution:');
    snapshot.solution.forEach((s, index) => {
      const math = s.math === undefined ? '' : ` $${typeof s.math === 'string' ? s.math : pick(s.math, locale)}$`;
      lines.push(`  ${index + 1}. ${pick(s.text, 'en')}${math}`);
    });
    const answer = answerToTex(snapshot.answer, locale);
    if (answer) lines.push(`- CONFIDENTIAL while the problem is open — correct answer: $${answer}$`);
    if (snapshot.hints.length > row.hints_used) {
      lines.push(
        `- The next built-in hint ${w.he} has not taken yet (you may paraphrase it): ${pick(snapshot.hints[row.hints_used]!, 'en')}`,
      );
    }
  }

  return lines.join('\n');
}

/** A thread title from the first message. */
export function titleFrom(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length <= 60 ? flat : `${flat.slice(0, 57)}…`;
}
