/**
 * Development aid: a demonstration instance with a teacher and two fictional students,
 * so that the examination goals and the teaching pages can be looked at with weeks of
 * history in them.
 *
 *   npx tsx scripts/dev-seed-class.ts <empty-data-dir> [days=24]
 *
 * The administrator is the teacher. Ema prepares for the four-year examination and has
 * never been sure of fractions; Vojta prepares for the six-year one and is strong and
 * quick. Both are made up. Their histories are produced by letting them work through the
 * real application with a simulated clock (packages/server/src/dev/personas.ts), so
 * everything in the databases got there the way real use would put it there.
 *
 * It refuses to touch a data directory that already has accounts or learning data.
 */
import path from 'node:path';
import { type Rng, createRng } from '@lemma/core';
import { type Learner, Accounts, prepareDatabase } from '../packages/server/src/accounts';
import { ensurePassword } from '../packages/server/src/app';
import { loadConfig } from '../packages/server/src/config';
import {
  type Persona,
  type Played,
  EMA,
  VOJTA,
  adaptiveSession,
  chanceOfSuccess,
  playRun,
  rightInput,
  withGoal,
  wrongInput,
} from '../packages/server/src/dev/personas';
import { setLogLevel } from '../packages/server/src/log';
import { createAssignment } from '../packages/server/src/services/assignments';
import { setOnboarded } from '../packages/server/src/services/context';
import { createExam, finishExam, saveExamAnswer } from '../packages/server/src/services/exam';
import { regeneratePlan, startAssignment } from '../packages/server/src/services/plan';
import { getProblemRow, startDiagnostic } from '../packages/server/src/services/practice';
import {
  addNote,
  beginSession,
  finishSession,
  recordItem,
  sessionProblem,
} from '../packages/server/src/services/teach';

const dir = process.argv[2];
const days = Number(process.argv[3] ?? 24);
if (!dir) {
  console.error('usage: tsx scripts/dev-seed-class.ts <empty-data-dir> [days]');
  process.exit(2);
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** Shown once at the end. A demonstration password: change it before anybody else can reach the instance. */
const PASSWORD = process.env.LEMMA_PASSWORD ?? 'lemma-demo-heslo';

/** A learner who gets better at what they practise: each problem moves the skill up a little. */
function learning(persona: Persona, perProblem = 0.1): { persona: Persona; note: (played: Played[]) => void } {
  const skills: Record<string, number> = { ...persona.skills };
  const growing: Persona = { ...persona, skills };
  const start = (skill: string): number => {
    for (const [prefix, value] of Object.entries(persona.prefixes ?? {})) if (skill.startsWith(prefix)) return value;
    return persona.base;
  };
  return {
    persona: growing,
    note: (played) => {
      for (const entry of played) {
        const skill = entry.row.skill;
        skills[skill] = Math.min(3.2, (skills[skill] ?? start(skill)) + perProblem * (entry.right ? 1 : 1.5));
      }
    },
  };
}

async function main(): Promise<void> {
  setLogLevel('warn');
  const config = loadConfig({ ...process.env, DATA_DIR: dir, LEMMA_PASSWORD: PASSWORD, AUTH_DISABLED: '' });
  // Start `days` ago at four in the afternoon, UTC+2.
  let clock = Math.floor(Date.now() / DAY) * DAY - days * DAY + 14 * HOUR;
  const now = (): number => clock;
  // Working a problem takes its time: the simulated clock moves with every answer.
  const time = { advance: (ms: number): void => void (clock += ms) };
  const db = await prepareDatabase(path.join(config.dataDir, 'lemma.sqlite'), config, now);
  const busy =
    (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n +
    (db.prepare('SELECT COUNT(*) AS n FROM problems').get() as { n: number }).n;
  if (busy > 0) {
    console.error(`refusing to seed: ${config.dataDir} already has accounts or learning data`);
    process.exit(1);
  }
  ensurePassword(db, config, clock);
  const accounts = new Accounts(db, config, now);
  const teacher = accounts.admin();
  // The teacher keeps the default goal and skips the first-run questions.
  setOnboarded(teacher.ctx);

  const cast: { learner: Learner; rng: Rng; attends: number; mind: ReturnType<typeof learning> }[] = [];
  for (const [username, persona, goal, examDay, attends, seed] of [
    ['ema', EMA, 'jpz-9', '2027-04-12', 0.7, 11],
    ['vojta', VOJTA, 'jpz-7', '2027-04-14', 0.85, 23],
  ] as const) {
    await accounts.create(username, PASSWORD, false);
    accounts.setTeachers(username, [teacher.username]);
    const learner = await accounts.user(username);
    withGoal(learner.ctx, goal, { name: persona.name, examDay, sessionMinutes: 30 });
    cast.push({ learner, rng: createRng(seed), attends, mind: learning(persona) });
  }
  const [ema, vojta] = cast as [(typeof cast)[number], (typeof cast)[number]];

  for (let day = 0; day < days; day++) {
    const afternoon = clock;
    for (const member of cast) {
      const { learner, rng, mind } = member;
      // Each sits down at a time of their own between four and seven.
      clock = afternoon + rng.int(0, 180) * 60_000;
      if (day === 0) {
        // The first evening: the placement test.
        mind.note(playRun(learner.ctx, startDiagnostic(learner.ctx), mind.persona, rng, undefined, time));
        continue;
      }
      if (!rng.bool(member.attends)) continue;
      // Work the teacher set comes first, as the plan has it.
      const set = learner.ctx.db
        .prepare(
          `SELECT id FROM assignments WHERE status = 'open' AND kind IN ('practice', 'review', 'remediation') LIMIT 1`,
        )
        .get() as { id: string } | undefined;
      if (set) {
        const started = startAssignment(learner.ctx, set.id);
        if ('run' in started) mind.note(playRun(learner.ctx, started, mind.persona, rng, undefined, time));
      }
      mind.note(adaptiveSession(learner.ctx, mind.persona, rng, rng.int(8, 13), time));
    }

    if (day === Math.floor(days / 3)) {
      // A tutoring session with Ema: fractions, shown and talked through together.
      const session = beginSession(teacher.ctx, ema.learner);
      for (const [skill, outcome, note] of [
        ['frac.concept', 'helped', 'Plete si celek a část; s koláčem to šlo.'],
        ['frac.concept', 'independent', ''],
        ['frac.operations', 'not-yet', 'Společný jmenovatel zatím hledá násobením čitatelů.'],
      ] as const) {
        const shown = sessionProblem(teacher.ctx, ema.learner, session.id, { skill, level: 1 });
        recordItem(teacher.ctx, ema.learner, session.id, shown.item.id, { outcome, note });
      }
      clock += 50 * 60_000;
      finishSession(teacher.username, teacher.ctx, ema.learner, session.id, {
        covered: ['frac.concept', 'frac.operations'],
        improved: ['frac.concept'],
        hard: ['frac.operations'],
        misconceptions: 'Při sčítání zlomků sčítá čitatele i jmenovatele.',
        homework: { skills: ['frac.concept', 'frac.operations'], minutes: 15, note: 'Čtvrt hodiny denně stačí.' },
        next: 'Společný jmenovatel na příkladech s dělením čokolády.',
        summary: 'Pojem zlomku se lepší, početní operace zatím ne.',
      });
      addNote(teacher.ctx, 'ema', {
        body: 'Pomáhá kreslit. Rychle se vzdává, když vidí zlomek se dvěma ciframi.',
        skill: 'frac.concept',
      });
    }

    if (day === Math.floor((2 * days) / 3)) {
      // Vojta takes a timed practice test: most of it right, a few left out for lack of time.
      const exam = createExam(vojta.learner.ctx, { blueprint: 'jpz-7-practice' });
      exam.items.forEach((item, index) => {
        const row = getProblemRow(vojta.learner.ctx, item.problem.id);
        if (index >= exam.items.length - 2) return;
        const right = vojta.rng.next() < chanceOfSuccess(vojta.mind.persona, row.skill, row.level);
        saveExamAnswer(
          vojta.learner.ctx,
          exam.id,
          index,
          right ? rightInput(row) : wrongInput(row),
          vojta.rng.int(60, 170),
        );
      });
      clock += 58 * 60_000;
      finishExam(vojta.learner.ctx, exam.id);
      addNote(teacher.ctx, 'vojta', { body: 'Na čas spěchá a nechává poslední úlohy. Zkusit rozvrh času na papíře.' });
    }
    // On to four in the afternoon of the next day.
    clock = Math.floor(clock / DAY) * DAY + DAY + 14 * HOUR;
  }

  // Work waiting today, so that the plans and the teaching pages have something open.
  clock = Date.now();
  createAssignment(vojta.learner.ctx, teacher.username, {
    kind: 'review',
    skills: [],
    minutes: 15,
    note: 'Před pátečním setkáním.',
  });
  createAssignment(ema.learner.ctx, teacher.username, { kind: 'lesson', skills: ['pct.basics'] });
  for (const member of cast) regeneratePlan(member.learner.ctx);

  for (const member of cast) {
    const totals = member.learner.ctx.db
      .prepare(
        `SELECT COUNT(*) AS problems, SUM(status = 'solved') AS solved FROM problems WHERE status IN ('solved','failed')`,
      )
      .get() as { problems: number; solved: number };
    console.log(`${member.learner.username}: ${totals.problems} problems, ${totals.solved} solved`);
  }
  console.log(
    `seeded ${days} days into ${config.dataDir}\n` +
      `sign in as the administrator (no name) or as "ema" / "vojta"; the password of all three is "${PASSWORD}"`,
  );
  await accounts.closeAll();
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
