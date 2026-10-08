/**
 * Development aid: simulate a plausible learner into a FRESH database, so the interface
 * can be looked at with weeks of history in it.
 *
 *   npx tsx scripts/dev-seed.ts <empty-data-dir> [days=70]
 *
 * It drives the real application in-process through its HTTP API with a simulated clock,
 * so everything in the database got there the same way real use would put it there.
 * It refuses to touch a database that already contains problems.
 */
import path from 'node:path';
import {
  type AnswerSpec,
  type ExamDto,
  type LessonDto,
  type PlanDto,
  type ProblemDto,
  type ProblemInstance,
  type StartRunResponse,
  canonicalInput,
  createRng,
} from '@lemma/core';
import { createApp } from '../packages/server/src/app';
import { loadConfig } from '../packages/server/src/config';
import { migrate, openDatabase } from '../packages/server/src/db';
import { setLogLevel } from '../packages/server/src/log';

const dir = process.argv[2];
const days = Number(process.argv[3] ?? 70);
if (!dir) {
  console.error('usage: tsx scripts/dev-seed.ts <empty-data-dir> [days]');
  process.exit(2);
}

setLogLevel('warn');
const config = loadConfig({ ...process.env, DATA_DIR: dir, AUTH_DISABLED: '1' });
const db = openDatabase(path.join(config.dataDir, 'lemma.sqlite'));
migrate(db);
if ((db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n > 0) {
  console.error(`refusing to seed: ${config.dataDir} already contains learning data`);
  process.exit(1);
}

const DAY = 86_400_000;
const rng = createRng(20261007);
// Start `days` ago at four in the afternoon, UTC+2.
let clock = Math.floor(Date.now() / DAY) * DAY - days * DAY + 14 * 3_600_000;
const app = createApp({ db, config, now: () => clock });

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await app.request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${url} → ${response.status} ${text.slice(0, 160)}`);
  return JSON.parse(text) as T;
}

const snapshot = (id: string): ProblemInstance =>
  JSON.parse(
    (db.prepare('SELECT snapshot FROM problems WHERE id = ?').get(id) as { snapshot: string }).snapshot,
  ) as ProblemInstance;

function genericWrong(spec: AnswerSpec): string {
  switch (spec.kind) {
    case 'number':
    case 'expr':
    case 'complex':
      return `(${spec.value}) + 2`;
    case 'set':
      return '{7; 11}';
    case 'interval':
      return '(40; 41)';
    case 'point':
      return `[${spec.coords.map(() => '9').join('; ')}]`;
    case 'choice':
      return spec.options.find((option) => !spec.correct.includes(option.id))?.id ?? spec.options[0]!.id;
    case 'spot':
      return String((spec.wrongLine + 1) % spec.lines.length);
    case 'self':
      return 'no';
  }
}

/** How good the simulated learner really is at each skill; grows as he practises. */
const ability = new Map<string, number>();

/** Work one problem the way a careful but slip-prone learner would. */
async function work(problem: ProblemDto): Promise<void> {
  const row = db.prepare('SELECT skill FROM problems WHERE id = ?').get(problem.id) as { skill: string };
  const skill = row.skill;
  const known = ability.get(skill) ?? 0.35;
  const stored = snapshot(problem.id);
  const right = canonicalInput(stored.answer);
  const pKnows = Math.max(0.12, Math.min(0.97, known + 0.25 - 0.13 * (problem.level - 1)));
  // Slips become rarer over the simulated weeks: from one problem in five to one in twelve.
  const elapsed = Math.max(0, Math.min(1, 1 - (Date.now() - clock) / (days * DAY)));
  const slipRate = 0.2 - 0.12 * elapsed;
  const seconds = Math.round(problem.estSeconds * (0.6 + rng.float(0, 0.9)));
  clock += seconds * 1000;
  const submit = (input: string, confidence?: string) =>
    call<{ resolved: boolean; verdict: string }>('POST', `/api/problems/${problem.id}/answer`, {
      input,
      seconds,
      confidence,
    });

  if (!rng.bool(pKnows)) {
    // Does not really know how: sometimes asks for a hint, sometimes gives up.
    if (problem.hintCount > 0 && rng.bool(0.6)) await call('POST', `/api/problems/${problem.id}/hint`);
    if (rng.bool(0.25)) {
      await call('POST', `/api/problems/${problem.id}/reveal`, { seconds });
    } else {
      const first = await submit(genericWrong(stored.answer), rng.bool(0.3) ? 'think' : 'guess');
      if (!first.resolved) {
        if (rng.bool(0.55)) await submit(right);
        else await call('POST', `/api/problems/${problem.id}/reveal`, { seconds });
      }
    }
    ability.set(skill, Math.min(0.95, known + 0.05));
    return;
  }
  if (rng.bool(slipRate)) {
    // Knows how, but slips: the wrong answer is a recognisable one when the problem has any.
    const slips = (stored.misconceptions ?? []).filter((m) =>
      ['sign', 'arithmetic', 'copy', 'misread', 'notation'].includes(m.error),
    );
    const wrong = slips.length > 0 ? rng.pick(slips).answer : genericWrong(stored.answer);
    const first = await submit(wrong, 'sure');
    if (!first.resolved) await submit(right);
    ability.set(skill, Math.min(0.95, known + 0.03));
    return;
  }
  await submit(right, rng.bool(0.7) ? 'sure' : 'think');
  ability.set(skill, Math.min(0.95, known + 0.06));
}

async function playRun(started: StartRunResponse): Promise<void> {
  let current = started;
  let guard = 0;
  while (current.problem && guard++ < 40) {
    if (current.problem.status === 'open') await work(current.problem);
    clock += 20_000;
    current = await call<StartRunResponse>('POST', `/api/runs/${current.run.id}/next`);
  }
}

async function doLesson(concept: string): Promise<void> {
  const lesson = await call<LessonDto>('GET', `/api/lessons/${concept}`);
  for (let index = lesson.step; index < lesson.steps.length; index++) {
    const step = lesson.steps[index]!;
    clock += 60_000;
    if (step.kind === 'check') {
      const started = await call<StartRunResponse>('POST', '/api/practice/start', {
        context: 'lesson',
        generator: step.generator,
        level: step.level,
      });
      if (started.problem) await work(started.problem);
    }
    await call('POST', `/api/lessons/${concept}/step`, { step: index });
  }
}

async function doExam(blueprint: string, topics?: number[]): Promise<void> {
  const exam = await call<ExamDto>('POST', '/api/exams', { blueprint, topics });
  for (const item of exam.items) {
    const stored = snapshot(item.problem.id);
    const seconds = Math.round(item.problem.estSeconds * (0.5 + rng.float(0, 1)));
    clock += seconds * 1000;
    const roll = rng.float(0, 1);
    if (roll < 0.1) continue; // left blank
    const slips = (stored.misconceptions ?? []).filter((m) =>
      ['sign', 'arithmetic', 'copy', 'misread'].includes(m.error),
    );
    const input =
      roll < 0.28
        ? slips.length > 0
          ? rng.pick(slips).answer
          : genericWrong(stored.answer)
        : canonicalInput(stored.answer);
    await call('PUT', `/api/exams/${exam.id}/items/${item.index}`, { input, seconds });
  }
  await call('POST', `/api/exams/${exam.id}/finish`);
}

async function main(): Promise<void> {
  await call('POST', '/api/onboarding', { name: 'Jonas', locale: 'cs', currentTopic: 1, sessionMinutes: 30 });

  for (let day = 0; day < days; day++) {
    const dayStart = clock;
    const weekday = new Date(clock).getUTCDay();
    const progress = day / days;
    // The class moves on through the first four chapters.
    const topic = progress < 0.22 ? 1 : progress < 0.45 ? 2 : progress < 0.78 ? 3 : 4;
    await call('PUT', '/api/settings', { currentTopic: topic });

    // A week away in the middle, declared as a pause; otherwise four or five days a week.
    const away = day >= Math.floor(days * 0.5) && day < Math.floor(days * 0.5) + 6;
    const active = !away && rng.bool(weekday === 0 || weekday === 6 ? 0.45 : 0.78);
    if (active) {
      const minutes = rng.pick([15, 30, 30, 30, 45, 60]);
      const plan = await call<PlanDto>('POST', '/api/plan/regenerate', { minutes });
      for (const block of plan.blocks) {
        if (block.optional && rng.bool(0.6)) continue;
        try {
          const result = await call<StartRunResponse | { redirect: string; target: string }>(
            'POST',
            `/api/plan/blocks/${block.id}/start`,
          );
          if ('redirect' in result) {
            if (result.redirect === 'lesson') await doLesson(result.target);
            else if (result.redirect === 'exam') await doExam(result.target, [topic]);
            else await call('POST', '/api/activity/lab', { tool: result.target, seconds: 240 });
          } else {
            await playRun(result);
          }
        } catch (error) {
          console.warn(`day ${day}: block ${block.kind} skipped — ${(error as Error).message}`);
        }
        clock += 90_000;
      }
      // Now and then, something extra on his own initiative.
      if (rng.bool(0.12)) await doExam('quick-check', [topic]).catch(() => undefined);
      if (rng.bool(0.1))
        await call('POST', '/api/activity/lab', {
          tool: rng.pick(['quadratic', 'linear', 'grapher', 'absolute']),
          seconds: 300,
        });
      if (rng.bool(0.15))
        await playRun(await call<StartRunResponse>('POST', '/api/practice/start', { context: 'mixed' })).catch(
          () => undefined,
        );
    }
    clock = dayStart + DAY;
  }

  // He confirms the app's guess on some mistakes and corrects it on a few.
  const mistakes = db
    .prepare(
      `SELECT id, error_inferred FROM problems WHERE error_inferred IS NOT NULL AND status IN ('solved', 'failed') ORDER BY resolved_at`,
    )
    .all() as { id: string; error_inferred: string }[];
  for (const mistake of mistakes) {
    if (!rng.bool(0.35)) continue;
    const errorType = rng.bool(0.8) ? mistake.error_inferred : rng.pick(['sign', 'arithmetic', 'misread', 'algebra']);
    await call('POST', `/api/problems/${mistake.id}/classify`, { errorType });
  }

  const today = new Date(Date.now()).toISOString().slice(0, 10);
  const inDays = (n: number): string => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
  const pauseStart = new Date(Date.now() - (days - Math.floor(days * 0.5)) * DAY).toISOString().slice(0, 10);
  const pauseEnd = new Date(Date.now() - (days - Math.floor(days * 0.5) - 5) * DAY).toISOString().slice(0, 10);
  await call('PUT', '/api/settings', {
    currentTopic: 4,
    tests: [{ day: inDays(5), topics: [3, 4], title: 'Čtvrtletní písemka' }],
    pauses: [{ from: pauseStart, to: pauseEnd, label: 'Podzimní prázdniny' }],
  });
  const missions = await call<{ id: string; milestones: { id: string }[] }[]>('GET', '/api/missions');
  const mission = missions.find((m) => m.id === 'quad-visualiser') ?? missions[0];
  if (mission)
    await call('PUT', `/api/missions/${mission.id}`, {
      milestones: mission.milestones.slice(0, 2).map((m) => m.id),
      notes: 'SVG výstup funguje, zbývá vrchol a kořeny.',
    });

  clock = Date.now();
  await call('POST', '/api/plan/regenerate', { minutes: 30 });
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS problems, SUM(status = 'solved') AS solved FROM problems WHERE status IN ('solved','failed')`,
    )
    .get() as { problems: number; solved: number };
  console.log(
    `seeded ${days} days up to ${today}: ${totals.problems} problems, ${totals.solved} solved, ${ability.size} skills touched`,
  );
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
