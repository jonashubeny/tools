import { describe, expect, it } from 'vitest';
import {
  type AttemptRecord,
  type Capability,
  SCENARIOS,
  SCENARIO_BY_ID,
  attemptQuality,
  evaluateReport,
  matchDiagnostics,
  planNext,
  recurringMistakes,
  skillProgress,
} from '../src';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 12);
const ALL: ReadonlySet<Capability> = new Set(['systemd', 'multiUser', 'networks']);

let n = 0;
function attempt(scenarioId: string, at: number, over: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    id: `a${++n}`,
    scenarioId,
    version: 1,
    startedAt: at,
    finishedAt: at + 20 * 60_000,
    status: 'solved',
    hintLevel: 0,
    hintsTaken: 0,
    solutionViewed: false,
    verifications: 1,
    failed: [],
    lastPassRate: 1,
    diagnostics: [],
    seconds: 15 * 60,
    reportPassed: null,
    ...over,
  };
}

const progressOf = (attempts: AttemptRecord[], skill: string, now = T0 + 60 * DAY) =>
  skillProgress(attempts, SCENARIO_BY_ID, now).find((p) => p.skill === skill)!;

describe('the quality of one attempt', () => {
  it('reads help, failed checks and diagnostics — not just whether it was solved', () => {
    const scenario = SCENARIO_BY_ID.get('dns-resolution')!;
    const clean = attemptQuality(attempt('dns-resolution', T0, { diagnostics: ['getent', 'nsswitch', 'hosts', 'resolv'] }), scenario);
    const helped = attemptQuality(attempt('dns-resolution', T0, { hintLevel: 2 }), scenario);
    const shown = attemptQuality(attempt('dns-resolution', T0, { solutionViewed: true }), scenario);
    expect(clean.independent).toBe(true);
    expect(helped.independent).toBe(false);
    expect(clean.quality).toBeGreaterThan(helped.quality);
    expect(helped.quality).toBeGreaterThan(shown.quality);
    expect(clean.diagnosticCoverage).toBe(1);
  });

  it('takes time into account only mildly, and against the estimate', () => {
    const scenario = SCENARIO_BY_ID.get('dns-resolution')!;
    const slow = attemptQuality(attempt('dns-resolution', T0, { seconds: 4 * 3600 }), scenario);
    const normal = attemptQuality(attempt('dns-resolution', T0), scenario);
    expect(slow.pace).toBe('slow');
    expect(slow.solved && slow.independent).toBe(true);
    expect(normal.quality - slow.quality).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('gives an unsolved attempt partial credit at most', () => {
    const q = attemptQuality(attempt('dns-resolution', T0, { status: 'abandoned', lastPassRate: 0.75 }), SCENARIO_BY_ID.get('dns-resolution'));
    expect(q.solved).toBe(false);
    expect(q.quality).toBeLessThan(0.4);
  });
});

describe('skill levels', () => {
  it('starts every skill as new', () => {
    expect(progressOf([], 'net.dns').level).toBe('new');
  });

  it('needs an independent solve to be proficient, and more for mastery', () => {
    const helped = [attempt('dns-resolution', T0, { hintLevel: 3 })];
    expect(progressOf(helped, 'net.dns').level).toBe('practising');

    const once = [attempt('dns-resolution', T0)];
    const p = progressOf(once, 'net.dns');
    expect(p.level).toBe('proficient');
    expect(p.retained).toBe(false);

    // Solved on one's own again, more than a week later: retention, and mastery.
    const twice = [attempt('dns-resolution', T0), attempt('service-reachability', T0 + 10 * DAY)];
    const q = progressOf(twice, 'net.dns');
    expect(q.retained).toBe(true);
    expect(q.level).toBe('mastered');
  });

  it('flags a skill the learner keeps needing help with', () => {
    const attempts = [
      attempt('dns-resolution', T0, { hintLevel: 3, failed: [{ check: 'resolves', mistake: 'name-not-resolving' }] }),
      attempt('dns-resolution', T0 + DAY, { status: 'abandoned', lastPassRate: 0.25, failed: [{ check: 'resolves', mistake: 'name-not-resolving' }] }),
    ];
    expect(progressOf(attempts, 'net.dns').struggling).toBe(true);
    expect(recurringMistakes(attempts)).toEqual([
      expect.objectContaining({ mistake: 'name-not-resolving', count: 2, scenarios: ['dns-resolution'] }),
    ]);
  });
});

describe('what comes next', () => {
  const plan = (attempts: AttemptRecord[], extra: Partial<Parameters<typeof planNext>[0]> = {}) =>
    planNext({ scenarios: SCENARIOS, attempts, capabilities: ALL, assigned: [], now: T0 + 30 * DAY, ...extra });

  it('starts a newcomer with the easiest lab', () => {
    const first = plan([]).recommendations[0]!;
    expect(SCENARIO_BY_ID.get(first.scenarioId)!.difficulty).toBe(1);
  });

  it('puts an open lab first, then the teacher’s assignment', () => {
    const r = plan([attempt('runaway-process', T0, { status: 'active', finishedAt: null })], { assigned: ['insecure-permissions'] }).recommendations;
    expect(r[0]).toMatchObject({ scenarioId: 'runaway-process', kind: 'continue' });
    expect(r[1]).toMatchObject({ scenarioId: 'insecure-permissions', kind: 'assignment' });
  });

  it('holds back multi-layer network labs while DNS is a struggle, and offers targeted practice', () => {
    const struggling = [
      attempt('dns-resolution', T0, { hintLevel: 3, failed: [{ check: 'resolves', mistake: 'name-not-resolving' }] }),
      attempt('dns-resolution', T0 + DAY, { solutionViewed: true, failed: [{ check: 'resolves', mistake: 'name-not-resolving' }] }),
    ];
    const p = plan(struggling);
    // The two-machine lab mixes DNS into a harder problem: it waits.
    expect(p.blocked).toContainEqual({ scenarioId: 'service-reachability', waitingFor: ['net.dns'] });
    expect(p.recommendations.map((r) => r.scenarioId)).not.toContain('service-reachability');
    // The lab about DNS itself is offered as targeted practice.
    const remediation = p.recommendations.find((r) => r.kind === 'remediation');
    expect(remediation).toMatchObject({ scenarioId: 'dns-resolution' });
  });

  it('raises the difficulty and prefers several faults for a learner on a roll', () => {
    const roll = [
      attempt('disk-full-logs', T0),
      attempt('dns-resolution', T0 + DAY),
      attempt('service-wont-start', T0 + 2 * DAY),
    ];
    const p = plan(roll, { now: T0 + 3 * DAY });
    expect(p.comfort).toBe(2);
    const first = p.recommendations[0]!;
    expect(first.kind).toBe('challenge');
    const scenario = SCENARIO_BY_ID.get(first.scenarioId)!;
    expect(scenario.difficulty).toBeGreaterThan(2);
    expect(scenario.faults).toBeGreaterThan(1);
  });

  it('leaves out what the lab host cannot run', () => {
    const p = plan([], { capabilities: new Set<Capability>(['systemd']) });
    for (const r of p.recommendations) {
      const scenario = SCENARIO_BY_ID.get(r.scenarioId)!;
      expect(scenario.requires.every((c) => c === 'systemd')).toBe(true);
    }
  });
});

describe('evidence from a lab', () => {
  it('recognises diagnostic commands in a shell history, skipping timestamps', () => {
    const history = '#1792752357\ndf -h\n#1792752358\ndu -xh /srv/data | sort -h | tail\nsystemctl cat ledger\n';
    expect(matchDiagnostics(history, SCENARIO_BY_ID.get('disk-full-logs')!.diagnostics)).toEqual(['df', 'du', 'unit']);
  });

  it('asks a report for every finding, in sentences', () => {
    const report = SCENARIO_BY_ID.get('ssh-bruteforce-triage')!.report!;
    expect(evaluateReport('203.0.113.45 deploy support dbus-update authorized_keys', report).passed).toBe(false);
    const prose =
      'Between 02:00 and 02:10 the host 203.0.113.45 guessed passwords over SSH and got into the deploy account. ' +
      'Through sudo it created a second root account called support, installed a service dbus-update that kept running, ' +
      'and added its own key to authorized_keys of deploy. I removed all three, locked deploy and kept the logs. ' +
      'Recommendation: disable password authentication and narrow sudo for deploy.';
    expect(evaluateReport(prose, report)).toEqual({ passed: true, found: ['source', 'account', 'backdoor', 'service', 'key'], missing: [] });
  });
});
