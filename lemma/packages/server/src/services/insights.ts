import {
  CONCEPTS,
  MISSIONS,
  SYLLABUS,
  SYLLABUS_BOOKS,
  SYLLABUS_META,
  generatorsFor,
  getConcept,
  getLesson,
  getSyllabusTopic,
  staticProblemsFor,
  topLevelOf,
} from '@lemma/content';
import {
  type AnalyticsDto,
  type ConceptDetailDto,
  type ErrorFamily,
  type ErrorSummaryDto,
  type ErrorType,
  type GraphDto,
  type Level,
  type MasteryLevel,
  type MistakeDto,
  type PracticeContext,
  ERROR_FAMILY,
  ERROR_TYPES,
  L,
  addDays,
  answerToTex,
  dependentsOf,
  isDue,
  isErrorType,
  isFading,
  levelOf,
  nextLevelGates,
  retrievability,
  weekStart,
} from '@lemma/core';
import { fromJson } from '../db';
import { achievedMilestones, dayScores, streakSummary } from './activity';
import { type Ctx, dayOf, getSettings, notFound, today } from './context';
import { allSkills, lessonDoneSet, loadStates, skillDto, stateOf, topicDtos } from './learner';
import { type ProblemRow, snapshotOf } from './practice';

/** Read-only views over the data: the skill graph, concept pages, the Error Lab, analytics. */

export function graph(ctx: Ctx): GraphDto {
  const skills = allSkills(ctx);
  return {
    skills,
    topics: topicDtos(skills, getSettings(ctx).currentTopic),
    syllabus: {
      schoolYear: SYLLABUS_META.schoolYear,
      hoursPerWeek: SYLLABUS_META.hoursPerWeek,
      hoursPerYear: SYLLABUS_META.hoursPerYear,
      source: SYLLABUS_META.source,
      assessment: SYLLABUS_META.assessment,
      books: [...SYLLABUS_BOOKS],
    },
  };
}

export function conceptDetail(ctx: Ctx, id: string): ConceptDetailDto {
  const concept = getConcept(id);
  if (!concept) throw notFound('concept');
  const states = loadStates(ctx);
  const done = lessonDoneSet(ctx);
  const now = ctx.now();
  const state = stateOf(states, id);
  const lesson = getLesson(id);
  const progress = ctx.db.prepare('SELECT step, done FROM lesson_progress WHERE concept = ?').get(id) as
    { step: number; done: number } | undefined;
  const topic = concept.syllabusTopic !== undefined ? getSyllabusTopic(concept.syllabusTopic) : undefined;

  const errorRows = ctx.db
    .prepare(
      `SELECT COALESCE(error_confirmed, error_inferred) AS error, COUNT(*) AS n FROM problems
       WHERE skill = ? AND COALESCE(error_confirmed, error_inferred) IS NOT NULL GROUP BY 1 ORDER BY n DESC`,
    )
    .all(id) as { error: string; n: number }[];

  return {
    ...skillDto(concept, states, done, now),
    why: concept.why ?? {},
    terms: concept.terms ?? [],
    resources: [...(concept.resources ?? []), ...(topic?.resources ?? [])],
    lab: concept.lab ?? null,
    next: nextLevelGates(state, topLevelOf(concept.id)),
    unlocks: dependentsOf(CONCEPTS, id).map((other) => ({ id: other, title: getConcept(other)!.title })),
    prereqDetails: concept.prereqs.map((pre) => {
      const preState = states.get(pre);
      return {
        id: pre,
        title: getConcept(pre)?.title ?? L(pre, pre),
        level: (preState ? levelOf(preState) : 0) as MasteryLevel,
      };
    }),
    errors: errorRows
      .filter((row) => isErrorType(row.error))
      .map((row) => ({ type: row.error as ErrorType, count: row.n })),
    stats: {
      attempts: state.attempts,
      solved: state.solved,
      unaided: state.unaided,
      speed: state.speed,
      mixedUnaided: state.mixedUnaided,
      calibration: state.calibration,
    },
    lesson: lesson
      ? {
          minutes: lesson.minutes,
          steps: lesson.steps.length,
          step: Math.min(progress?.step ?? 0, lesson.steps.length),
          done: progress?.done === 1,
        }
      : null,
    missions: MISSIONS.filter((mission) => mission.concepts.includes(id)).map((mission) => ({
      id: mission.id,
      title: mission.title,
    })),
    problemFamilies: [
      ...generatorsFor(id).map((g) => ({ id: g.id, title: g.title, kind: g.kind, levels: g.levels })),
      ...staticProblemsFor(id).map((p) => ({ id: p.id, title: p.title, kind: p.kind, levels: [p.level] as Level[] })),
    ],
    topicTitle: topic?.title ?? null,
  };
}

// ---------------------------------------------------------------------------- Error Lab

const errorOf = (row: { error_confirmed: string | null; error_inferred: string | null }): ErrorType | null => {
  const value = row.error_confirmed ?? row.error_inferred;
  return isErrorType(value) ? value : null;
};

const rate = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

export function errorSummary(ctx: Ctx, windowDays = 30): ErrorSummaryDto {
  const now = ctx.now();
  const recentFrom = now - windowDays * 86_400_000;
  const previousFrom = now - 2 * windowDays * 86_400_000;
  const rows = ctx.db
    .prepare(
      `SELECT * FROM problems WHERE status IN ('solved', 'failed') AND resolved_at >= ? ORDER BY resolved_at DESC`,
    )
    .all(now - 12 * 7 * 86_400_000) as ProblemRow[];

  const recent = rows.filter((row) => row.resolved_at! >= recentFrom);
  const previous = rows.filter((row) => row.resolved_at! >= previousFrom && row.resolved_at! < recentFrom);

  const countBy = (list: ProblemRow[]): Map<ErrorType, number> => {
    const counts = new Map<ErrorType, number>();
    for (const row of list) {
      const error = errorOf(row);
      if (error) counts.set(error, (counts.get(error) ?? 0) + 1);
    }
    return counts;
  };
  const recentCounts = countBy(recent);
  const previousCounts = countBy(previous);

  const byType = ERROR_TYPES.map((type) => ({
    type,
    family: ERROR_FAMILY[type],
    recent: recentCounts.get(type) ?? 0,
    previous: previousCounts.get(type) ?? 0,
    rate: rate(recentCounts.get(type) ?? 0, recent.length),
  }))
    .filter((entry) => entry.recent > 0 || entry.previous > 0)
    .sort((a, b) => b.recent - a.recent || b.previous - a.previous);

  const byFamily: Record<ErrorFamily, { recent: number; previous: number }> = {
    slip: { recent: 0, previous: 0 },
    procedure: { recent: 0, previous: 0 },
    concept: { recent: 0, previous: 0 },
  };
  for (const entry of byType) {
    byFamily[entry.family].recent += entry.recent;
    byFamily[entry.family].previous += entry.previous;
  }

  // Weekly rates for the last twelve weeks.
  const weeks = new Map<string, { attempts: number; slip: number; procedure: number; concept: number }>();
  const currentWeek = weekStart(today(ctx));
  for (let i = 11; i >= 0; i--)
    weeks.set(addDays(currentWeek, -7 * i), { attempts: 0, slip: 0, procedure: 0, concept: 0 });
  for (const row of rows) {
    const entry = weeks.get(weekStart(dayOf(ctx, row.resolved_at!)));
    if (!entry) continue;
    entry.attempts++;
    const error = errorOf(row);
    if (error) entry[ERROR_FAMILY[error]]++;
  }

  const topics = new Map<number | null, { counts: Partial<Record<ErrorType, number>>; total: number }>();
  for (const row of recent) {
    const error = errorOf(row);
    if (!error) continue;
    const topic = getConcept(row.skill)?.syllabusTopic ?? null;
    const entry = topics.get(topic) ?? { counts: {}, total: 0 };
    entry.counts[error] = (entry.counts[error] ?? 0) + 1;
    entry.total++;
    topics.set(topic, entry);
  }

  const mistakes: MistakeDto[] = [];
  for (const row of rows) {
    const error = errorOf(row);
    if (!error) continue;
    const first = ctx.db
      .prepare(`SELECT input FROM attempts WHERE problem_id = ? AND verdict = 'incorrect' ORDER BY id LIMIT 1`)
      .get(row.id) as { input: string } | undefined;
    const snapshot = snapshotOf(row);
    const note = fromJson<{ note: MistakeDto['note'] }>(row.error_note, { note: null }).note;
    const spec = snapshot.answer;
    let inputText: MistakeDto['inputText'] = null;
    let answerText: MistakeDto['answerText'] = null;
    if (spec.kind === 'choice') {
      // An option id means nothing on its own; show what the options said.
      const textOf = (ids: string[]): MistakeDto['inputText'] => {
        const texts = ids
          .map((id) => spec.options.find((option) => option.id === id)?.text)
          .filter((text) => text !== undefined);
        return texts.length === 0
          ? null
          : L(texts.map((text) => text.cs).join('; '), texts.map((text) => text.en).join('; '));
      };
      inputText = textOf(
        (first?.input ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      );
      answerText = textOf(spec.correct);
    } else if (spec.kind === 'spot') {
      const line = first ? Number(first.input) : Number.NaN;
      inputText = Number.isInteger(line) ? L(`řádek ${line + 1}`, `line ${line + 1}`) : null;
      answerText = L(`řádek ${spec.wrongLine + 1}`, `line ${spec.wrongLine + 1}`);
    }
    mistakes.push({
      problemId: row.id,
      at: row.resolved_at!,
      skill: row.skill,
      skillTitle: getConcept(row.skill)?.title ?? L(row.skill, row.skill),
      prompt: snapshot.prompt,
      input: first?.input ?? '',
      answerTex: L(answerToTex(snapshot.answer, 'cs'), answerToTex(snapshot.answer, 'en')),
      inputText,
      answerText,
      error,
      confirmed: row.error_confirmed !== null,
      note,
      level: row.level as Level,
      solvedLater: row.status === 'solved',
    });
    if (mistakes.length >= 30) break;
  }

  // Trend statements need enough data on both sides to mean anything.
  const trends: ErrorSummaryDto['trends'] = [];
  if (recent.length >= 15 && previous.length >= 15) {
    for (const family of ['slip', 'procedure', 'concept'] as const) {
      const from = rate(byFamily[family].previous, previous.length);
      const to = rate(byFamily[family].recent, recent.length);
      if (from > 0 || to > 0) trends.push({ type: family, from, to });
    }
    for (const entry of byType.slice(0, 4)) {
      const from = rate(entry.previous, previous.length);
      if (Math.abs(entry.rate - from) >= 0.03) trends.push({ type: entry.type, from, to: entry.rate });
    }
  }

  const calibration = { sureRight: 0, sureWrong: 0, unsureRight: 0, unsureWrong: 0 };
  for (const row of recent) {
    if (!row.confidence) continue;
    const right = row.first_try === 1;
    if (row.confidence === 'sure') right ? calibration.sureRight++ : calibration.sureWrong++;
    else right ? calibration.unsureRight++ : calibration.unsureWrong++;
  }

  return {
    windowDays,
    attempts: recent.length,
    errors: [...recentCounts.values()].reduce((sum, n) => sum + n, 0),
    byType,
    byFamily,
    weekly: [...weeks.entries()].map(([week, entry]) => ({ week, ...entry })),
    byTopic: [...topics.entries()]
      .map(([topic, entry]) => ({
        topic,
        title:
          topic !== null
            ? (getSyllabusTopic(topic)?.title ?? L(`${topic}`, `${topic}`))
            : L('Mimo sylabus', 'Outside the syllabus'),
        counts: entry.counts,
        total: entry.total,
      }))
      .sort((a, b) => b.total - a.total),
    recent: mistakes,
    trends,
    calibration,
  };
}

/** Share of recent resolved problems spoiled by a slip, for two consecutive windows. */
export function slipRates(ctx: Ctx, windowDays = 14): { recent: number | null; previous: number | null } {
  const now = ctx.now();
  const slips = ERROR_TYPES.filter((type) => ERROR_FAMILY[type] === 'slip');
  const placeholders = slips.map(() => '?').join(',');
  const windowRate = (from: number, to: number): number | null => {
    const row = ctx.db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(error_confirmed, error_inferred) IN (${placeholders}) THEN 1 ELSE 0 END) AS slips
         FROM problems WHERE status IN ('solved', 'failed') AND resolved_at >= ? AND resolved_at < ?`,
      )
      .get(...slips, from, to) as { total: number; slips: number | null };
    return row.total >= 10 ? (row.slips ?? 0) / row.total : null;
  };
  const span = windowDays * 86_400_000;
  return { recent: windowRate(now - span, now + 1), previous: windowRate(now - 2 * span, now - span) };
}

// ---------------------------------------------------------------------------- analytics

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const ratio = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);
const isUnaidedRow = (row: ProblemRow): boolean =>
  row.status === 'solved' && row.first_try === 1 && row.hints_used + row.tutor_used === 0;

export function analytics(ctx: Ctx): AnalyticsDto {
  const rows = ctx.db
    .prepare(`SELECT * FROM problems WHERE status IN ('solved', 'failed') ORDER BY resolved_at`)
    .all() as ProblemRow[];
  const states = loadStates(ctx);
  const now = ctx.now();
  const scores = dayScores(ctx);
  const streak = streakSummary(ctx);

  const solved = rows.filter((row) => row.status === 'solved');
  const unaided = rows.filter(isUnaidedRow);

  // Weekly series, last twelve weeks.
  const currentWeek = weekStart(today(ctx));
  const weekKeys = Array.from({ length: 12 }, (_, i) => addDays(currentWeek, -7 * (11 - i)));
  const weekly = weekKeys.map((week) => {
    const end = addDays(week, 7);
    const list = rows.filter((row) => {
      const day = dayOf(ctx, row.resolved_at!);
      return day >= week && day < end;
    });
    const families = { slip: 0, gap: 0 };
    for (const row of list) {
      const error = errorOf(row);
      if (!error) continue;
      if (ERROR_FAMILY[error] === 'slip') families.slip++;
      else families.gap++;
    }
    const mixed = list.filter((row) => row.context === 'mixed' || row.context === 'exam');
    const blocked = list.filter((row) => row.context === 'blocked' || row.context === 'lesson');
    let points = 0;
    let activeDays = 0;
    for (let i = 0; i < 7; i++) {
      const score = scores.get(addDays(week, i)) ?? 0;
      points += score;
      if (score >= 12) activeDays++;
    }
    return {
      week,
      problems: list.length,
      accuracy: ratio(list.filter((row) => row.status === 'solved').length, list.length),
      unaidedRate: ratio(list.filter(isUnaidedRow).length, list.length),
      avgLevel: list.length === 0 ? null : list.reduce((sum, row) => sum + row.level, 0) / list.length,
      slipRate: ratio(families.slip, list.length),
      gapRate: ratio(families.gap, list.length),
      points,
      activeDays,
      mixedAccuracy: ratio(mixed.filter(isUnaidedRow).length, mixed.length),
      blockedAccuracy: ratio(blocked.filter(isUnaidedRow).length, blocked.length),
    };
  });

  const levels: Record<MasteryLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const skills = allSkills(ctx, states);
  for (const skill of skills) levels[skill.level]++;

  const topics = SYLLABUS.map((topic) => {
    const ids = new Set(CONCEPTS.filter((concept) => concept.syllabusTopic === topic.n).map((concept) => concept.id));
    const list = rows.filter((row) => ids.has(row.skill));
    const topicSkills = skills.filter((skill) => ids.has(skill.id));
    return {
      topic: topic.n,
      title: topic.title,
      progress:
        topicSkills.length === 0 ? 0 : topicSkills.reduce((sum, skill) => sum + skill.progress, 0) / topicSkills.length,
      attempts: list.length,
      accuracy: ratio(list.filter((row) => row.status === 'solved').length, list.length),
    };
  });

  const contexts = (['lesson', 'blocked', 'mixed', 'drill', 'challenge', 'exam'] as PracticeContext[])
    .map((context) => {
      const list = rows.filter((row) => row.context === context);
      return { context, problems: list.length, accuracy: ratio(list.filter(isUnaidedRow).length, list.length) };
    })
    .filter((entry) => entry.problems > 0);

  const cards = [...states.values()].filter((state) => state.card !== null && state.card.lastReview !== null);
  const retentions = cards.map((state) => retrievability(state.card, now)).filter((r): r is number => r !== null);

  const reviewsPassed = rows.filter((row) => row.review_passed === 1).length;
  const reviewsFailed = (
    ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM problems WHERE status = 'failed' AND context IN ('mixed', 'exam')`)
      .get() as { n: number }
  ).n;

  const milestones = achievedMilestones(ctx);
  const bestDay = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  const hardest = [...unaided].sort((a, b) => b.level - a.level || a.resolved_at! - b.resolved_at!)[0];
  const records: AnalyticsDto['records'] = [
    { title: L('Nejdelší série dní', 'Longest streak'), value: `${streak.longest}`, at: null },
    {
      title: L('Nejlepší den (body aktivity)', 'Best day (activity points)'),
      value: bestDay ? `${bestDay[1]}` : '0',
      at: bestDay ? Date.parse(`${bestDay[0]}T12:00:00Z`) : null,
    },
    {
      title: L('Nejtěžší úloha vyřešená samostatně', 'Hardest problem solved unaided'),
      value: hardest ? `L${hardest.level}` : '–',
      at: hardest?.resolved_at ?? null,
    },
    {
      title: L('Dosažené milníky', 'Milestones reached'),
      value: `${milestones.length}`,
      at: milestones[0]?.achievedAt ?? null,
    },
  ];

  return {
    totals: {
      sessions: (ctx.db.prepare('SELECT COUNT(*) AS n FROM runs WHERE finished_at IS NOT NULL').get() as { n: number })
        .n,
      problems: rows.length,
      solved: solved.length,
      unaided: unaided.length,
      accuracy: ratio(solved.length, rows.length),
      unaidedRate: ratio(unaided.length, rows.length),
      avgLevel: rows.length === 0 ? null : rows.reduce((sum, row) => sum + row.level, 0) / rows.length,
      medianSeconds: median(solved.map((row) => row.seconds ?? 0).filter((s) => s > 0)),
      reviewsPassed,
      reviewsFailed,
      minutes: Math.round(rows.reduce((sum, row) => sum + (row.seconds ?? 0), 0) / 60),
      activeDays: streak.totalActiveDays,
    },
    weekly,
    levels,
    topics,
    contexts,
    retention: {
      due: cards.filter((state) => isDue(state.card, now)).length,
      fading: cards.filter((state) => isFading(state, now)).length,
      scheduled: cards.length,
      avgRetention: retentions.length === 0 ? null : retentions.reduce((sum, r) => sum + r, 0) / retentions.length,
    },
    records,
  };
}
