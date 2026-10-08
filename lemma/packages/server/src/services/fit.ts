import {
  CONCEPTS,
  CURRENT_FIT_SNAPSHOT,
  FIT_SNAPSHOTS,
  FIT_TIMELINE,
  MISSIONS,
  ROADMAP,
  getConcept,
  getMission,
} from '@lemma/content';
import { type FitDto, type MissionDto, type RoadmapStageDto, type SkillDto, ACTIVITY, L, levelOf } from '@lemma/core';
import { fromJson, toJson } from '../db';
import { addEvent, award } from './activity';
import { type Ctx, notFound, today } from './context';
import { allSkills, loadStates } from './learner';

/** The FIT roadmap and missions. */

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

export function fitOverview(ctx: Ctx): FitDto {
  const skills = allSkills(ctx);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const pick = (ids: readonly string[]): SkillDto[] =>
    ids.map((id) => byId.get(id)).filter((s): s is SkillDto => s !== undefined);
  const snapshot = CURRENT_FIT_SNAPSHOT;

  const stages: RoadmapStageDto[] = ROADMAP.map((stage) => {
    // The "bridge" stage is defined by the official seminar outline, not by hand.
    const groups =
      stage.id === 'bridge'
        ? snapshot.bridge.items.map((item) => ({
            title: item.text,
            note:
              item.concepts.length === 0
                ? L(
                    'Zatím není v Lemmě; do sylabu 2. ročníku nepatří.',
                    'Not in Lemma yet; not part of the year-2 syllabus.',
                  )
                : null,
            skills: pick(item.concepts),
            progress: average(pick(item.concepts).map((s) => s.progress)),
          }))
        : stage.groups.map((group) => ({
            title: group.title,
            note: group.note ?? null,
            skills: pick(group.concepts),
            progress: average(pick(group.concepts).map((s) => s.progress)),
          }));
    const all = groups.flatMap((group) => group.skills);
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      basis: stage.basis,
      groups,
      progress: average(all.map((s) => s.progress)),
    };
  });

  return {
    snapshot: {
      admissionFor: snapshot.admissionFor,
      studyPlanFor: snapshot.studyPlanFor,
      retrievedOn: snapshot.retrievedOn,
      reviewAfter: snapshot.reviewAfter,
      stale: today(ctx) > snapshot.reviewAfter,
      sources: snapshot.sources,
      programmeFacts: snapshot.programme.facts,
      admissionFacts: snapshot.admission.facts,
      routes: snapshot.admission.routes,
      courses: snapshot.courses.map((course) => {
        const related = pick(
          CONCEPTS.filter((concept) => concept.fit?.includes(course.code)).map((concept) => concept.id),
        );
        return {
          ...course,
          skills: related,
          progress: related.length === 0 ? null : average(related.map((s) => s.progress)),
        };
      }),
      bridge: {
        title: snapshot.bridge.title,
        source: snapshot.bridge.source,
        items: snapshot.bridge.items.map((item) => {
          const related = pick(item.concepts);
          return {
            text: item.text,
            onSyllabus: item.onSyllabus,
            skills: related,
            progress: related.length === 0 ? null : average(related.map((s) => s.progress)),
          };
        }),
      },
    },
    history: FIT_SNAPSHOTS.map((s) => ({ admissionFor: s.admissionFor, retrievedOn: s.retrievedOn })),
    timeline: FIT_TIMELINE,
    stages,
  };
}

/** Coverage of the bridging-seminar skills, for the dashboard. */
export function bridgeCoverage(skills: readonly SkillDto[]): { familiar: number; proficient: number } {
  const ids = new Set(CURRENT_FIT_SNAPSHOT.bridge.items.flatMap((item) => item.concepts));
  const list = skills.filter((skill) => ids.has(skill.id));
  if (list.length === 0) return { familiar: 0, proficient: 0 };
  return {
    familiar: list.filter((skill) => skill.level >= 3).length / list.length,
    proficient: list.filter((skill) => skill.level >= 4).length / list.length,
  };
}

// ----------------------------------------------------------------------------- missions

interface MissionRow {
  mission: string;
  status: string;
  milestones: string;
  notes: string;
  repo_url: string;
}

export function missions(ctx: Ctx): MissionDto[] {
  const rows = ctx.db.prepare('SELECT * FROM mission_progress').all() as MissionRow[];
  const byId = new Map(rows.map((row) => [row.mission, row]));
  const states = loadStates(ctx);
  return MISSIONS.map((mission) => {
    const row = byId.get(mission.id);
    const done = new Set(fromJson<string[]>(row?.milestones, []));
    const concepts = mission.concepts.map((id) => {
      const state = states.get(id);
      return { id, title: getConcept(id)?.title ?? L(id, id), level: state ? levelOf(state) : (0 as const) };
    });
    return {
      id: mission.id,
      title: mission.title,
      brief: mission.brief,
      payoff: mission.payoff,
      concepts,
      stack: mission.stack,
      hours: mission.hours,
      difficulty: mission.difficulty,
      milestones: mission.milestones.map((m) => ({ ...m, done: done.has(m.id) })),
      stretch: mission.stretch ?? [],
      status: row?.status === 'done' ? 'done' : row?.status === 'active' ? 'active' : 'idle',
      notes: row?.notes ?? '',
      repoUrl: row?.repo_url ?? '',
      // Ready once at least half of the concepts involved have been met.
      ready: concepts.filter((c) => c.level >= 1).length * 2 >= concepts.length,
    };
  });
}

export function updateMission(
  ctx: Ctx,
  id: string,
  patch: { milestones?: unknown; notes?: unknown; repoUrl?: unknown },
): MissionDto {
  const mission = getMission(id);
  if (!mission) throw notFound('mission');
  const now = ctx.now();
  const row = ctx.db.prepare('SELECT * FROM mission_progress WHERE mission = ?').get(id) as MissionRow | undefined;
  const before = new Set(fromJson<string[]>(row?.milestones, []));
  const valid = new Set(mission.milestones.map((m) => m.id));

  const after = Array.isArray(patch.milestones)
    ? new Set(patch.milestones.filter((m): m is string => typeof m === 'string' && valid.has(m)))
    : before;
  const notes = typeof patch.notes === 'string' ? patch.notes.slice(0, 20_000) : (row?.notes ?? '');
  let repoUrl = row?.repo_url ?? '';
  if (typeof patch.repoUrl === 'string')
    repoUrl = patch.repoUrl === '' || /^https?:\/\/\S{3,300}$/.test(patch.repoUrl) ? patch.repoUrl : repoUrl;

  const allDone = mission.milestones.every((m) => after.has(m.id));
  const status = allDone ? 'done' : after.size > 0 || notes !== '' || repoUrl !== '' ? 'active' : 'idle';

  ctx.db.transaction(() => {
    ctx.db
      .prepare(
        `INSERT INTO mission_progress (mission, status, milestones, notes, repo_url, started_at, finished_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (mission) DO UPDATE SET status = excluded.status, milestones = excluded.milestones, notes = excluded.notes,
           repo_url = excluded.repo_url, started_at = COALESCE(mission_progress.started_at, excluded.started_at),
           finished_at = excluded.finished_at, updated_at = excluded.updated_at`,
      )
      .run(id, status, toJson([...after]), notes, repoUrl, status === 'idle' ? null : now, allDone ? now : null, now);
    // Each milestone is credited once, the first time it is ticked.
    for (const milestone of after) {
      if (before.has(milestone)) continue;
      const credited = ctx.db
        .prepare(`SELECT 1 FROM events WHERE type = 'mission' AND ref = ? AND tool = ?`)
        .get(id, milestone);
      if (!credited) addEvent(ctx, { type: 'mission', points: ACTIVITY.MISSION_MILESTONE, ref: id, tool: milestone });
    }
    if (allDone) award(ctx, 'mission-done', id);
  })();
  return missions(ctx).find((m) => m.id === id)!;
}
