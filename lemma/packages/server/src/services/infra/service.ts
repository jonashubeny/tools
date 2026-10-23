import type {
  AttemptDto,
  AttemptSummaryDto,
  CheckResultDto,
  InfraAssignmentDto,
  InfraMistakeDto,
  InfraOverviewDto,
  InfraRoadmapDto,
  InfraStudentDto,
  LabDto,
  LabHostDto,
  RecommendationDto,
  ResourceDto,
  ScenarioDetailDto,
  ScenarioSummaryDto,
  SkillProgressDto,
  StudyGuideDto,
} from '@lemma/core';
import { L } from '@lemma/core';
import {
  type AttemptRecord,
  type Capability,
  type ScenarioDef,
  MISTAKES,
  PLANNED,
  RESOURCES,
  RESOURCE_BY_ID,
  SCENARIOS,
  SCENARIO_BY_ID,
  SKILLS,
  SKILL_BY_ID,
  attemptQuality,
  evaluateReport,
  planNext,
  recurringMistakes,
  roadmap,
  skillProgress,
} from '@lemma/labs';
import { fromJson, toJson } from '../../db';
import { log } from '../../log';
import { type Ctx, HttpError, badRequest, newId, notFound, today } from '../context';
import type { LabService, LabView } from './labd';

/** What the infra services need besides the learner's context. */
export interface InfraDeps {
  labs: LabService;
  files: FileStore;
}
import type { FileStore } from './files';

/**
 * The Linux & Infrastructure mode on the server. As with mathematics, the learner's
 * database holds the log — here `infra_attempts` — and everything else (skill levels,
 * recurring mistakes, what to do next) is derived from it on each request.
 *
 * Two gates stand in front of every lab: the attempt is looked up in the learner's own
 * database (another learner's attempt cannot be named), and labd is asked on behalf of
 * the learner's account name (another account's lab answers 404 there too).
 */

interface AttemptRow {
  id: string;
  scenario: string;
  version: number;
  lab_id: string | null;
  day: string;
  started_at: number;
  finished_at: number | null;
  status: AttemptRecord['status'];
  hint_level: number;
  hints_taken: number;
  solution_viewed: number;
  verifications: number;
  failed: string;
  last_results: string | null;
  diagnostics: string;
  seconds: number;
  report: string;
  report_passed: number | null;
  assignment_id: string | null;
}

const CATEGORY_TITLES: Record<ScenarioDef['category'], L> = {
  linux: L('Základy Linuxu', 'Linux fundamentals'),
  networking: L('Sítě', 'Networking'),
  operations: L('Provoz serverů', 'Server operations'),
  deployment: L('Nasazení a automatizace', 'Deployment and automation'),
  security: L('Obranná bezpečnost', 'Defensive security'),
};

const CAPABILITY_TEXT: Record<Capability, L> = {
  systemd: L('systemd v kontejneru', 'systemd in a container'),
  multiUser: L('víc uživatelských ID v kontejneru', 'more than one user ID in a container'),
  networks: L('privátní sítě mezi kontejnery', 'private networks between containers'),
};

// ---------------------------------------------------------------------------- reading

const rows = (ctx: Ctx): AttemptRow[] =>
  ctx.db.prepare('SELECT * FROM infra_attempts ORDER BY started_at').all() as AttemptRow[];

const row = (ctx: Ctx, id: string): AttemptRow => {
  const found = ctx.db.prepare('SELECT * FROM infra_attempts WHERE id = ?').get(id) as AttemptRow | undefined;
  if (!found) throw notFound('attempt');
  return found;
};

const record = (r: AttemptRow): AttemptRecord => {
  const last = fromJson<{ id: string; passed: boolean }[] | null>(r.last_results, null);
  return {
    id: r.id,
    scenarioId: r.scenario,
    version: r.version,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    hintLevel: Math.min(3, Math.max(0, r.hint_level)) as AttemptRecord['hintLevel'],
    hintsTaken: r.hints_taken,
    solutionViewed: r.solution_viewed === 1,
    verifications: r.verifications,
    failed: fromJson(r.failed, []),
    lastPassRate: last && last.length > 0 ? last.filter((x) => x.passed).length / last.length : null,
    diagnostics: fromJson(r.diagnostics, []),
    seconds: r.seconds,
    reportPassed: r.report_passed === null ? null : r.report_passed === 1,
  };
};

export const attemptRecords = (ctx: Ctx): AttemptRecord[] =>
  rows(ctx)
    .filter((r) => SCENARIO_BY_ID.has(r.scenario))
    .map(record);

const summary = (r: AttemptRow): AttemptSummaryDto => {
  const rec = record(r);
  const q = attemptQuality(rec, SCENARIO_BY_ID.get(r.scenario));
  return {
    id: r.id,
    scenarioId: r.scenario,
    version: r.version,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    hintLevel: r.hint_level,
    solutionViewed: r.solution_viewed === 1,
    verifications: r.verifications,
    independent: q.independent,
    seconds: r.seconds,
    mistakes: [...new Set(rec.failed.map((f) => f.mistake))],
  };
};

const capabilitySet = (host: LabHostDto): Set<Capability> =>
  new Set((Object.keys(host.capabilities) as Capability[]).filter((c) => host.capabilities[c] === true));

function unavailability(scenario: ScenarioDef, host: LabHostDto): L | null {
  if (!host.configured) return L('Laboratoře nejsou na tomto serveru nastavené.', 'Labs are not set up on this server.');
  if (!host.reachable) return L('Služba laboratoří teď neodpovídá.', 'The lab service is not answering right now.');
  const missing = scenario.requires.filter((c) => host.capabilities[c] !== true);
  if (missing.length > 0) {
    if (missing.some((c) => host.capabilities[c] === null))
      return L('Server laboratoří se ještě připravuje.', 'The lab host is still being prepared.');
    return L(
      `Tento server to neumí: chybí ${missing.map((c) => CAPABILITY_TEXT[c].cs).join(', ')}.`,
      `This host cannot run it: it lacks ${missing.map((c) => CAPABILITY_TEXT[c].en).join(', ')}.`,
    );
  }
  for (const image of new Set(scenario.machines.map((m) => m.image))) {
    const state = host.images[image];
    if (state === 'pending' || state === 'building')
      return L('Obrazy laboratoří se ještě sestavují.', 'The lab images are still being built.');
    if (state !== 'ready') return L(`Obraz ${image} tu není k dispozici.`, `The ${image} image is not available here.`);
  }
  return null;
}

function scenarioSummary(
  s: ScenarioDef,
  host: LabHostDto,
  records: readonly AttemptRecord[],
  waiting: ReadonlyMap<string, string[]>,
): ScenarioSummaryDto {
  const mine = records.filter((r) => r.scenarioId === s.id);
  const qualities = mine.map((r) => attemptQuality(r, s));
  const unavailable = unavailability(s, host);
  return {
    id: s.id,
    version: s.version,
    title: s.title,
    summary: s.summary,
    category: s.category,
    difficulty: s.difficulty,
    faults: s.faults,
    skills: s.skills,
    prerequisites: s.prerequisites,
    estimatedMinutes: s.estimatedMinutes,
    requires: s.requires,
    machines: s.machines.length,
    untested: s.untested === true,
    runnable: unavailable === null,
    unavailable,
    waitingFor: waiting.get(s.id) ?? [],
    progress: qualities.some((q) => q.independent)
      ? 'independent'
      : qualities.some((q) => q.solved)
        ? 'solved'
        : mine.length > 0
          ? 'attempted'
          : 'new',
    attempts: mine.length,
  };
}

const resourceDto = (id: string): ResourceDto | null => {
  const r = RESOURCE_BY_ID.get(id);
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    skills: r.skills,
    scenarios: SCENARIOS.filter((s) => s.resources.includes(r.id)).map((s) => s.id),
    url: r.url ?? null,
    body: r.body ?? null,
    verifiedOn: r.verifiedOn ?? null,
  };
};

const noteOf = (ctx: Ctx, scenario: string): string =>
  (ctx.db.prepare('SELECT body FROM infra_notes WHERE scenario = ?').get(scenario) as { body: string } | undefined)?.body ?? '';

function scenarioDetail(ctx: Ctx, deps: InfraDeps, s: ScenarioDef, host: LabHostDto, records: readonly AttemptRecord[], waiting: ReadonlyMap<string, string[]>): ScenarioDetailDto {
  return {
    ...scenarioSummary(s, host, records, waiting),
    briefing: s.briefing,
    objectives: s.objectives,
    machineNames: s.machines.map((m) => m.name),
    checks: s.checks.map((c) => ({ id: c.id, label: c.label })),
    resources: [
      ...s.resources.map(resourceDto).filter((r): r is ResourceDto => r !== null),
      ...deps.files.list().filter((f) => f.scenarios.includes(s.id)),
    ],
    report: s.report ? { prompt: s.report.prompt, items: s.report.mustMention.map((i) => ({ id: i.id, label: i.label })) } : null,
    verifiedOn: s.verifiedOn,
    history: rows(ctx)
      .filter((r) => r.scenario === s.id)
      .reverse()
      .map(summary),
    note: noteOf(ctx, s.id),
  };
}

const skillDtos = (records: readonly AttemptRecord[], now: number): SkillProgressDto[] =>
  skillProgress(records, SCENARIO_BY_ID, now).map((p) => {
    const def = SKILL_BY_ID.get(p.skill)!;
    return { ...p, category: def.category, title: def.title, description: def.description };
  });

const mistakeDtos = (records: readonly AttemptRecord[]): InfraMistakeDto[] =>
  recurringMistakes(records).map((m) => ({ ...m, label: MISTAKES[m.mistake] ?? L(m.mistake, m.mistake) }));

const assignmentDto = (r: {
  id: string;
  scenario: string;
  note: string;
  due_day: string | null;
  created_by: string;
  created_at: number;
  status: InfraAssignmentDto['status'];
  done_at: number | null;
  attempt_id: string | null;
}): InfraAssignmentDto => ({
  id: r.id,
  scenarioId: r.scenario,
  note: r.note,
  dueDay: r.due_day,
  createdBy: r.created_by,
  createdAt: r.created_at,
  status: r.status,
  doneAt: r.done_at,
  attemptId: r.attempt_id,
});

export const listInfraAssignments = (ctx: Ctx): InfraAssignmentDto[] =>
  (ctx.db.prepare(`SELECT * FROM infra_assignments ORDER BY status = 'open' DESC, created_at DESC`).all() as Parameters<typeof assignmentDto>[0][]).map(
    assignmentDto,
  );

function plan(ctx: Ctx, host: LabHostDto, records: readonly AttemptRecord[]) {
  const assigned = listInfraAssignments(ctx)
    .filter((a) => a.status === 'open')
    .map((a) => a.scenarioId);
  // Only what this host can run now is ever proposed.
  const runnable = SCENARIOS.filter((s) => unavailability(s, host) === null);
  return planNext({ scenarios: runnable, attempts: records, capabilities: capabilitySet(host), assigned, now: ctx.now() });
}

// ---------------------------------------------------------------------------- the lab

const labDto = (lab: LabView | null): LabDto | null =>
  lab && {
    id: lab.id,
    status: lab.status,
    operation: lab.operation,
    error: lab.error,
    createdAt: lab.createdAt,
    readyAt: lab.readyAt,
    expiresAt: lab.expiresAt,
    machines: lab.machines,
  };

/**
 * Bring the record in line with labd: a lab that labd no longer has (expired, removed by
 * the administrator, lost in a restart) ends its attempt's claim on it.
 */
async function sync(ctx: Ctx, deps: InfraDeps, owner: string, r: AttemptRow): Promise<LabView | null> {
  if (!r.lab_id) return null;
  let lab: LabView | null;
  try {
    lab = await deps.labs.get(owner, r.lab_id);
  } catch (error) {
    // labd down: say nothing about the lab, change nothing in the record.
    if (error instanceof HttpError && error.status >= 500) return null;
    throw error;
  }
  if (!lab || lab.status === 'destroyed' || lab.status === 'expired') {
    const now = ctx.now();
    ctx.db
      .prepare(
        `UPDATE infra_attempts SET lab_id = NULL,
           status = CASE WHEN status = 'active' THEN 'expired' ELSE status END,
           finished_at = COALESCE(finished_at, ?) WHERE id = ?`,
      )
      .run(now, r.id);
    log.info('lab attempt closed: the lab is gone', { attempt: r.id, lab: r.lab_id, status: lab?.status ?? 'missing' });
    return null;
  }
  return lab;
}

async function syncAll(ctx: Ctx, deps: InfraDeps, owner: string): Promise<void> {
  for (const r of rows(ctx).filter((x) => x.lab_id !== null)) await sync(ctx, deps, owner, r);
}

const current = (ctx: Ctx): AttemptRow | undefined =>
  ctx.db.prepare('SELECT * FROM infra_attempts WHERE lab_id IS NOT NULL ORDER BY started_at DESC LIMIT 1').get() as AttemptRow | undefined;

// --------------------------------------------------------------------------- overview

export async function infraOverview(ctx: Ctx, deps: InfraDeps, owner: string): Promise<InfraOverviewDto> {
  const { host } = await deps.labs.status();
  if (host.reachable) await syncAll(ctx, deps, owner);
  const all = rows(ctx);
  const records = attemptRecords(ctx);
  const p = plan(ctx, host, records);
  const waiting = new Map(p.blocked.map((b) => [b.scenarioId, b.waitingFor]));
  const recommendations: RecommendationDto[] = p.recommendations.slice(0, 5).map((r) => ({
    scenario: scenarioSummary(SCENARIO_BY_ID.get(r.scenarioId)!, host, records, waiting),
    kind: r.kind,
    reason: r.reason,
  }));
  const active = current(ctx);
  const finished = all.filter((r) => r.status !== 'active');
  return {
    host,
    active: active ? summary(active) : null,
    recommendations,
    skills: skillDtos(records, ctx.now()),
    recurring: mistakeDtos(records),
    recent: [...all].reverse().slice(0, 10).map(summary),
    assignments: listInfraAssignments(ctx).filter((a) => a.status === 'open'),
    totals: {
      solved: finished.filter((r) => r.status === 'solved').length,
      independent: records.filter((r) => attemptQuality(r, SCENARIO_BY_ID.get(r.scenarioId)).independent).length,
      attempts: all.length,
      minutes: Math.round(all.reduce((sum, r) => sum + r.seconds, 0) / 60),
    },
    comfort: p.comfort,
  };
}

export async function infraRoadmap(ctx: Ctx, deps: InfraDeps): Promise<InfraRoadmapDto> {
  const { host } = await deps.labs.status();
  const records = attemptRecords(ctx);
  const skills = new Map(skillDtos(records, ctx.now()).map((s) => [s.skill, s]));
  const waiting = new Map(plan(ctx, host, records).blocked.map((b) => [b.scenarioId, b.waitingFor]));
  return {
    categories: roadmap().map((c) => ({
      category: c.category,
      title: CATEGORY_TITLES[c.category],
      skills: c.skills.map((entry) => ({
        skill: skills.get(entry.skill)!,
        scenarios: entry.scenarios.map((id) => scenarioSummary(SCENARIO_BY_ID.get(id)!, host, records, waiting)),
        planned: PLANNED.filter((p) => p.skill === entry.skill).map((p) => p.title),
      })),
    })),
  };
}

export async function infraScenario(ctx: Ctx, deps: InfraDeps, id: string): Promise<ScenarioDetailDto> {
  const s = SCENARIO_BY_ID.get(id);
  if (!s) throw notFound('scenario');
  const { host } = await deps.labs.status();
  const records = attemptRecords(ctx);
  const waiting = new Map(plan(ctx, host, records).blocked.map((b) => [b.scenarioId, b.waitingFor]));
  return scenarioDetail(ctx, deps, s, host, records, waiting);
}

// --------------------------------------------------------------------------- attempts

export async function startAttempt(ctx: Ctx, deps: InfraDeps, owner: string, scenarioId: string): Promise<AttemptDto> {
  const s = SCENARIO_BY_ID.get(scenarioId);
  if (!s) throw notFound('scenario');
  await syncAll(ctx, deps, owner);
  const open = current(ctx);
  if (open) {
    throw new HttpError(409, 'lab_open', 'you already have a lab open; finish it before starting another');
  }
  const lab = await deps.labs.create(owner, scenarioId);
  const id = newId();
  const now = ctx.now();
  const assignment = ctx.db
    .prepare(`SELECT id FROM infra_assignments WHERE scenario = ? AND status = 'open' ORDER BY created_at LIMIT 1`)
    .get(scenarioId) as { id: string } | undefined;
  ctx.db
    .prepare(
      `INSERT INTO infra_attempts (id, scenario, version, lab_id, day, started_at, assignment_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, scenarioId, s.version, lab.id, today(ctx), now, assignment?.id ?? null);
  log.info('lab attempt started', { attempt: id, scenario: scenarioId, lab: lab.id });
  return attemptDto(ctx, deps, (await deps.labs.status()).host, row(ctx, id), lab);
}

function attemptDto(ctx: Ctx, deps: InfraDeps, host: LabHostDto, r: AttemptRow, lab: LabView | null): AttemptDto {
  const s = SCENARIO_BY_ID.get(r.scenario);
  if (!s) throw notFound('scenario');
  const records = attemptRecords(ctx);
  const solved = r.status === 'solved';
  const last = fromJson<{ id: string; passed: boolean }[] | null>(r.last_results, null);
  const used = new Set(fromJson<string[]>(r.diagnostics, []));
  const results: CheckResultDto[] | null =
    last &&
    s.checks.map((c) => {
      const passed = last.find((x) => x.id === c.id)?.passed ?? false;
      return { id: c.id, label: c.label, passed, hint: passed ? null : c.failHint };
    });
  return {
    ...summary(r),
    scenario: scenarioDetail(ctx, deps, s, host, records, new Map()),
    lab: labDto(lab),
    hints: s.hints.filter((h) => h.level <= r.hint_level).map((h) => ({ level: h.level, text: h.text, commands: h.commands ?? [] })),
    solution: solved || r.solution_viewed === 1 ? s.solution : null,
    explanation: solved ? s.explanation : null,
    results,
    diagnostics: s.diagnostics.map((d) => ({ id: d.id, label: d.label, used: used.has(d.id) })),
    report: r.report,
    reportResult: s.report && r.report.trim() !== '' ? evaluateReport(r.report, s.report) : null,
  };
}

export async function getAttempt(ctx: Ctx, deps: InfraDeps, owner: string, id: string): Promise<AttemptDto> {
  const lab = await sync(ctx, deps, owner, row(ctx, id));
  return attemptDto(ctx, deps, (await deps.labs.status()).host, row(ctx, id), lab);
}

export function listAttempts(ctx: Ctx, scenario?: string): AttemptSummaryDto[] {
  return rows(ctx)
    .filter((r) => !scenario || r.scenario === scenario)
    .reverse()
    .map(summary);
}

const liveLab = (r: AttemptRow): string => {
  if (!r.lab_id) throw new HttpError(409, 'lab_closed', 'this attempt has no open lab any more');
  return r.lab_id;
};

/** Solved: every check passed in the last verification, and the report (if one is asked for) is complete. */
function maybeSolve(ctx: Ctx, id: string): boolean {
  const r = row(ctx, id);
  if (r.status !== 'active') return r.status === 'solved';
  const s = SCENARIO_BY_ID.get(r.scenario)!;
  const last = fromJson<{ id: string; passed: boolean }[] | null>(r.last_results, null);
  const checksPass = last !== null && s.checks.every((c) => last.find((x) => x.id === c.id)?.passed);
  const reportOk = !s.report || r.report_passed === 1;
  if (!checksPass || !reportOk) return false;
  const now = ctx.now();
  ctx.db.prepare(`UPDATE infra_attempts SET status = 'solved', finished_at = ? WHERE id = ?`).run(now, id);
  if (r.assignment_id) {
    ctx.db
      .prepare(`UPDATE infra_assignments SET status = 'done', done_at = ?, attempt_id = ? WHERE id = ? AND status = 'open'`)
      .run(now, id, r.assignment_id);
  }
  log.info('lab attempt solved', { attempt: id, scenario: r.scenario });
  return true;
}

export async function verifyAttempt(ctx: Ctx, deps: InfraDeps, owner: string, id: string): Promise<AttemptDto> {
  const r = row(ctx, id);
  const result = await deps.labs.verify(owner, liveLab(r));
  const s = SCENARIO_BY_ID.get(r.scenario)!;
  const now = ctx.now();
  const passedAll = result.results.every((x) => x.passed);
  // Mistakes count while the lab is unsolved; checking again after the solve is exploring.
  const failed = fromJson<{ check: string; mistake: string }[]>(r.failed, []);
  if (r.status === 'active') {
    for (const x of result.results.filter((y) => !y.passed)) {
      const check = s.checks.find((c) => c.id === x.id);
      if (check && !failed.some((f) => f.check === check.id)) failed.push({ check: check.id, mistake: check.mistake });
    }
  }
  const diagnostics = [...new Set([...fromJson<string[]>(r.diagnostics, []), ...result.diagnostics])];
  ctx.db.transaction(() => {
    ctx.db
      .prepare('INSERT INTO infra_verifications (id, attempt_id, at, results, passed) VALUES (?, ?, ?, ?, ?)')
      .run(newId(), id, now, toJson(result.results.map((x) => ({ id: x.id, passed: x.passed }))), passedAll ? 1 : 0);
    ctx.db
      .prepare(
        `UPDATE infra_attempts SET verifications = verifications + ?, failed = ?, last_results = ?, diagnostics = ? WHERE id = ?`,
      )
      .run(r.status === 'active' ? 1 : 0, toJson(failed), toJson(result.results.map((x) => ({ id: x.id, passed: x.passed }))), toJson(diagnostics), id);
  })();
  maybeSolve(ctx, id);
  return attemptDto(ctx, deps, (await deps.labs.status()).host, row(ctx, id), result.lab);
}

export async function takeHint(ctx: Ctx, deps: InfraDeps, owner: string, id: string): Promise<AttemptDto> {
  const r = row(ctx, id);
  if (r.status === 'active' && r.hint_level < 3) {
    ctx.db.prepare('UPDATE infra_attempts SET hint_level = hint_level + 1, hints_taken = hints_taken + 1 WHERE id = ?').run(id);
  }
  return getAttempt(ctx, deps, owner, id);
}

export async function revealSolution(ctx: Ctx, deps: InfraDeps, owner: string, id: string): Promise<AttemptDto> {
  const r = row(ctx, id);
  if (r.status === 'active') ctx.db.prepare('UPDATE infra_attempts SET solution_viewed = 1 WHERE id = ?').run(id);
  return getAttempt(ctx, deps, owner, id);
}

export async function resetAttempt(ctx: Ctx, deps: InfraDeps, owner: string, id: string): Promise<AttemptDto> {
  const r = row(ctx, id);
  const lab = await deps.labs.reset(owner, liveLab(r));
  // Results of the old machines say nothing about the new ones.
  ctx.db.prepare('UPDATE infra_attempts SET last_results = NULL WHERE id = ?').run(id);
  return attemptDto(ctx, deps, (await deps.labs.status()).host, row(ctx, id), lab);
}

/** Leave the lab: its machines are removed; an unsolved attempt ends as abandoned. */
export async function finishAttempt(ctx: Ctx, deps: InfraDeps, owner: string, id: string): Promise<AttemptDto> {
  const r = row(ctx, id);
  if (r.lab_id) await deps.labs.destroy(owner, r.lab_id);
  ctx.db
    .prepare(
      `UPDATE infra_attempts SET lab_id = NULL,
         status = CASE WHEN status = 'active' THEN 'abandoned' ELSE status END,
         finished_at = COALESCE(finished_at, ?) WHERE id = ?`,
    )
    .run(ctx.now(), id);
  return attemptDto(ctx, deps, (await deps.labs.status()).host, row(ctx, id), null);
}

export async function saveReport(ctx: Ctx, deps: InfraDeps, owner: string, id: string, text: unknown): Promise<AttemptDto> {
  if (typeof text !== 'string') throw badRequest('report must be text');
  const r = row(ctx, id);
  const s = SCENARIO_BY_ID.get(r.scenario)!;
  const body = text.slice(0, 20_000);
  const passed = s.report ? evaluateReport(body, s.report).passed : null;
  ctx.db
    .prepare('UPDATE infra_attempts SET report = ?, report_passed = ? WHERE id = ?')
    .run(body, passed === null ? null : passed ? 1 : 0, id);
  maybeSolve(ctx, id);
  return getAttempt(ctx, deps, owner, id);
}

/** Time with the lab open, as the page reports it while visible; keeps the lab alive. */
export async function heartbeat(ctx: Ctx, deps: InfraDeps, owner: string, id: string, seconds: unknown): Promise<{ ok: true }> {
  const r = row(ctx, id);
  const add = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.min(90, Math.round(seconds))) : 0;
  if (add > 0) ctx.db.prepare('UPDATE infra_attempts SET seconds = seconds + ? WHERE id = ?').run(add, id);
  if (r.lab_id) await deps.labs.touch(owner, r.lab_id).catch(() => undefined);
  return { ok: true };
}

/** The lab id behind an attempt, for the terminal — only while it is open. */
export const terminalLab = (ctx: Ctx, id: string): string => liveLab(row(ctx, id));

export function saveNote(ctx: Ctx, scenario: string, body: unknown): { body: string } {
  if (!SCENARIO_BY_ID.has(scenario)) throw notFound('scenario');
  if (typeof body !== 'string') throw badRequest('body must be text');
  const text = body.slice(0, 20_000);
  ctx.db
    .prepare(
      `INSERT INTO infra_notes (scenario, body, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (scenario) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    )
    .run(scenario, text, ctx.now());
  return { body: text };
}

// -------------------------------------------------------------------- resources, guides

export function listResources(deps: InfraDeps): ResourceDto[] {
  return [...RESOURCES.map((r) => resourceDto(r.id)!), ...deps.files.list()];
}

/**
 * A study guide assembled from what the platform already holds and has checked: the
 * written resources for a skill (or a scenario's skills), and the explanations of the
 * labs the learner has solved. Nothing is generated; each section says where it is from.
 */
export function studyGuide(ctx: Ctx, query: { skill?: string; scenario?: string }): StudyGuideDto {
  let skills: string[];
  let title: L;
  if (query.scenario) {
    const s = SCENARIO_BY_ID.get(query.scenario);
    if (!s) throw notFound('scenario');
    skills = s.skills;
    title = s.title;
  } else if (query.skill) {
    const def = SKILL_BY_ID.get(query.skill);
    if (!def) throw notFound('skill');
    skills = [def.id];
    title = def.title;
  } else throw badRequest('a skill or a scenario is required');

  const solved = new Set(rows(ctx).filter((r) => r.status === 'solved').map((r) => r.scenario));
  const sections: StudyGuideDto['sections'] = [];
  for (const r of RESOURCES.filter((x) => x.body && x.skills.some((s) => skills.includes(s)))) {
    sections.push({ title: r.title, body: r.body!, source: `Lemma: ${r.id}`, verifiedOn: r.verifiedOn ?? null });
  }
  for (const s of SCENARIOS.filter((x) => solved.has(x.id) && x.skills.some((k) => skills.includes(k)))) {
    sections.push({
      title: L(`Z laboratoře: ${s.title.cs}`, `From the lab: ${s.title.en}`),
      body: L(`${s.explanation.cs}\n\n${s.solution.cs}`, `${s.explanation.en}\n\n${s.solution.en}`),
      source: `scenario ${s.id} v${s.version}`,
      verifiedOn: s.verifiedOn,
    });
  }
  const links = RESOURCES.filter((x) => x.kind === 'link' && x.skills.some((s) => skills.includes(s))).map((x) => ({ title: x.title, url: x.url! }));
  return { title, generatedAt: ctx.now(), sections, links };
}

// --------------------------------------------------------------------------- teaching

export async function infraStudent(student: { username: string; ctx: Ctx }, deps: InfraDeps): Promise<InfraStudentDto> {
  const { ctx } = student;
  const { host } = await deps.labs.status();
  const records = attemptRecords(ctx);
  const p = plan(ctx, host, records);
  const waiting = new Map(p.blocked.map((b) => [b.scenarioId, b.waitingFor]));
  return {
    username: student.username,
    skills: skillDtos(records, ctx.now()),
    recurring: mistakeDtos(records),
    attempts: rows(ctx)
      .reverse()
      .map((r) => ({
        ...summary(r),
        title: SCENARIO_BY_ID.get(r.scenario)?.title ?? L(r.scenario, r.scenario),
        report: r.report,
        reportPassed: r.report_passed === null ? null : r.report_passed === 1,
      })),
    assignments: listInfraAssignments(ctx),
    recommendations: p.recommendations.slice(0, 5).map((r) => ({
      scenario: scenarioSummary(SCENARIO_BY_ID.get(r.scenarioId)!, host, records, waiting),
      kind: r.kind,
      reason: r.reason,
    })),
  };
}

/** One attempt of a student, as a teacher reviews it: results, help taken, the report. */
export async function infraStudentAttempt(ctx: Ctx, deps: InfraDeps, id: string): Promise<AttemptDto> {
  const dto = attemptDto(ctx, deps, (await deps.labs.status()).host, row(ctx, id), null);
  // The learner's private notes stay theirs.
  return { ...dto, scenario: { ...dto.scenario, note: '' } };
}

export function assignScenario(ctx: Ctx, teacher: string, body: Record<string, unknown>): InfraAssignmentDto {
  const scenario = typeof body.scenario === 'string' ? body.scenario : '';
  if (!SCENARIO_BY_ID.has(scenario)) throw badRequest('unknown scenario');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const due = typeof body.dueDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDay) ? body.dueDay : null;
  const id = newId();
  ctx.db
    .prepare('INSERT INTO infra_assignments (id, scenario, note, due_day, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, scenario, note, due, teacher, ctx.now());
  return listInfraAssignments(ctx).find((a) => a.id === id)!;
}

export function cancelInfraAssignment(ctx: Ctx, id: string): InfraAssignmentDto {
  const changed = ctx.db.prepare(`UPDATE infra_assignments SET status = 'cancelled' WHERE id = ? AND status = 'open'`).run(id).changes;
  if (changed === 0) throw notFound('open assignment');
  return listInfraAssignments(ctx).find((a) => a.id === id)!;
}

export const INFRA_SKILLS = SKILLS;
