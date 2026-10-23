import { L } from '@lemma/core';
import { SKILLS, SKILL_BY_ID } from './skills';
import type { Capability, DiagnosticSignal, ScenarioDef } from './types';

/**
 * The learner model of the Linux & Infrastructure mode. Pure: it takes the log of lab
 * attempts and the clock, and derives everything else — so it can be recomputed at any
 * time, and tested to the day.
 *
 * No single number decides competence. An attempt is read as several kinds of evidence:
 * whether it was solved, how much help it took, how many failed checks preceded the
 * solution, which diagnostic commands were used, and — interpreted against the estimate
 * and only mildly — how long it took. A level is reached by gates, as in the mathematics
 * mode: ten easy labs are not mastery.
 */

const DAY = 86_400_000;

/** One lab attempt, as the server records it. */
export interface AttemptRecord {
  id: string;
  scenarioId: string;
  version: number;
  startedAt: number;
  finishedAt: number | null;
  status: 'active' | 'solved' | 'abandoned' | 'expired';
  /** The highest hint level taken (0 = none). */
  hintLevel: 0 | 1 | 2 | 3;
  hintsTaken: number;
  solutionViewed: boolean;
  verifications: number;
  /** Checks that failed in a verification before the lab was solved (or at its end). */
  failed: { check: string; mistake: string }[];
  /** Fraction of checks passing in the last verification (0..1); null before any. */
  lastPassRate: number | null;
  /** Diagnostic signal ids seen in the shell history. */
  diagnostics: string[];
  /** Time spent with the lab open, seconds. */
  seconds: number;
  reportPassed: boolean | null;
}

export type SkillLevel = 'new' | 'learning' | 'practising' | 'proficient' | 'mastered';

export interface SkillProgress {
  skill: string;
  level: SkillLevel;
  /** 0..1, recency-weighted quality of the evidence. */
  score: number;
  attempts: number;
  solved: number;
  independent: number;
  /** Distinct scenarios solved without the detailed hints or the solution. */
  independentScenarios: number;
  /** An independent solve a week or more after the skill was last practised successfully. */
  retained: boolean;
  lastPracticed: number | null;
  struggling: boolean;
  /** What the next level still needs. */
  next: L[];
}

export interface AttemptQuality {
  solved: boolean;
  independent: boolean;
  /** 0..1 */
  quality: number;
  /** 0..1, share of the scenario's diagnostic signals used. */
  diagnosticCoverage: number;
  /** Time against the estimate, as a word — never a score on its own. */
  pace: 'quick' | 'expected' | 'slow' | 'unknown';
}

export function attemptQuality(attempt: AttemptRecord, scenario: ScenarioDef | undefined): AttemptQuality {
  const solved = attempt.status === 'solved';
  const independent = solved && attempt.hintLevel <= 1 && !attempt.solutionViewed;
  const signals = scenario?.diagnostics.length ?? 0;
  const coverage = signals === 0 ? 0 : Math.min(1, new Set(attempt.diagnostics).size / signals);
  const estimate = (scenario?.estimatedMinutes ?? 0) * 60;
  const pace: AttemptQuality['pace'] =
    estimate === 0 || attempt.seconds <= 0
      ? 'unknown'
      : attempt.seconds < estimate * 0.5
        ? 'quick'
        : attempt.seconds > estimate * 3
          ? 'slow'
          : 'expected';

  let quality: number;
  if (solved) {
    quality = 1;
    quality -= attempt.solutionViewed ? 0.6 : [0, 0.1, 0.3, 0.6][attempt.hintLevel]!;
    quality -= Math.min(0.2, Math.max(0, attempt.verifications - 1) * 0.05);
    quality += 0.1 * coverage;
    // Time only nudges: slow with no help is still a solve, quick and unaided is fluency.
    if (pace === 'slow') quality -= 0.05;
    if (pace === 'quick' && independent) quality += 0.05;
  } else {
    // Partial credit for what was fixed before giving up, never more than a weak solve.
    quality = 0.35 * (attempt.lastPassRate ?? 0) + 0.05 * coverage;
  }
  return { solved, independent, quality: Math.max(0, Math.min(1, quality)), diagnosticCoverage: coverage, pace };
}

/** Attempts still open are not evidence yet. */
const finished = (attempt: AttemptRecord): boolean => attempt.status !== 'active';

export function skillProgress(
  attempts: readonly AttemptRecord[],
  scenarios: ReadonlyMap<string, ScenarioDef>,
  now: number,
): SkillProgress[] {
  const done = attempts.filter(finished).sort((a, b) => (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt));
  const recurring = new Set(recurringMistakes(attempts).map((entry) => entry.mistake));

  return SKILLS.map((def) => {
    const mine = done.filter((attempt) => scenarios.get(attempt.scenarioId)?.skills.includes(def.id));
    if (mine.length === 0) {
      return {
        skill: def.id,
        level: 'new',
        score: 0,
        attempts: 0,
        solved: 0,
        independent: 0,
        independentScenarios: 0,
        retained: false,
        lastPracticed: null,
        struggling: false,
        next: [L('Vyřešit první laboratoř', 'Solve a first lab')],
      };
    }

    let weighted = 0;
    let weights = 0;
    let solved = 0;
    let independent = 0;
    let retained = false;
    let lastSuccess: number | null = null;
    const independentIn = new Set<string>();
    let hardestIndependent = 0;
    mine.forEach((attempt, index) => {
      const scenario = scenarios.get(attempt.scenarioId)!;
      const q = attemptQuality(attempt, scenario);
      // The main skill of a scenario counts fully, a side skill a little less; newer evidence more.
      const role = scenario.skills[0] === def.id ? 1 : 0.6;
      const recency = 0.6 ** (mine.length - 1 - index);
      weighted += q.quality * role * recency;
      weights += role * recency;
      const at = attempt.finishedAt ?? attempt.startedAt;
      if (q.solved) solved++;
      if (q.independent) {
        independent++;
        independentIn.add(scenario.id);
        hardestIndependent = Math.max(hardestIndependent, scenario.difficulty);
        if (lastSuccess !== null && at - lastSuccess >= 7 * DAY) retained = true;
      }
      if (q.solved) lastSuccess = at;
    });
    const score = weights === 0 ? 0 : weighted / weights;

    const recent = mine.slice(-2).map((attempt) => attemptQuality(attempt, scenarios.get(attempt.scenarioId)));
    const relatedRecurring = mine.some((attempt) => attempt.failed.some((f) => recurring.has(f.mistake)));
    const struggling =
      (recent.length === 2 && recent.every((q) => !q.independent)) ||
      mine.slice(-3).filter((attempt) => attempt.status !== 'solved').length >= 2 ||
      (relatedRecurring && score < 0.65);

    const next: L[] = [];
    let level: SkillLevel;
    if (solved === 0 || score < 0.4) {
      level = 'learning';
      if (solved === 0) next.push(L('Dotáhnout laboratoř do konce', 'Bring a lab to a solve'));
      else next.push(L('Vyřešit laboratoř s menší nápovědou', 'Solve a lab with less help'));
    } else if (independent === 0 || score < 0.65) {
      level = 'practising';
      next.push(L('Vyřešit laboratoř bez podrobné nápovědy a bez řešení', 'Solve a lab without the detailed hints or the solution'));
    } else if (!(independentIn.size >= 2 || hardestIndependent >= 3) || score < 0.8 || !retained) {
      level = 'proficient';
      if (!(independentIn.size >= 2 || hardestIndependent >= 3))
        next.push(L('Samostatně vyřešit další, nebo těžší laboratoř', 'Solve another, or a harder, lab on your own'));
      if (!retained) next.push(L('Ukázat, že to umíte i po týdnu', 'Show it still works a week later'));
      if (score < 0.8) next.push(L('Řešit čistěji: méně nápovědy, méně neúspěšných kontrol', 'Solve more cleanly: less help, fewer failed checks'));
    } else {
      level = 'mastered';
    }

    return {
      skill: def.id,
      level,
      score,
      attempts: mine.length,
      solved,
      independent,
      independentScenarios: independentIn.size,
      retained,
      lastPracticed: mine.at(-1)!.finishedAt ?? mine.at(-1)!.startedAt,
      struggling: struggling && level !== 'mastered',
      next,
    };
  });
}

/** What a failed check most likely meant, as the learner should read it. */
export const MISTAKES: Record<string, L> = {
  'disk-not-freed': L('Místo na disku se neuvolnilo', 'Disk space was not freed'),
  'deleted-open-file': L('Smazaný soubor, který je stále otevřený', 'A deleted file that is still open'),
  'deleted-data': L('Smazaná nebo poškozená data', 'Deleted or damaged data'),
  'service-not-healthy': L('Služba neodpovídá', 'The service does not answer'),
  'service-not-running': L('Služba neběží', 'The service is not running'),
  'root-cause-not-fixed': L('Opravený příznak, ne příčina', 'The symptom fixed, not the cause'),
  'config-data-lost': L('Oprava konfigurace ztratila data', 'A config fix lost data'),
  'not-enabled': L('Služba není povolená při startu', 'A service not enabled at boot'),
  'no-daemon-reload': L('Chybějící systemctl daemon-reload', 'A missing systemctl daemon-reload'),
  'killed-not-stopped': L('Proces zabitý, ale jeho služba ho vrátí', 'A process killed, but its service brings it back'),
  'not-disabled': L('Služba zůstala povolená', 'A service left enabled'),
  'collateral-damage': L('Rozbité něco, co fungovalo', 'Something that worked got broken'),
  'unit-missing': L('Chybějící unit soubor', 'A missing unit file'),
  'environment-not-set': L('Chybějící konfigurace v prostředí', 'Configuration missing from the environment'),
  'no-restart-policy': L('Služba se po pádu nevrátí', 'A service that does not come back after a crash'),
  'name-not-resolving': L('Jméno se nepřekládá', 'A name that does not resolve'),
  'nsswitch-order': L('Pořadí zdrojů v nsswitch.conf', 'The source order in nsswitch.conf'),
  'hardcoded-ip': L('Zadrátovaná IP adresa místo jména', 'A hard-coded IP address instead of a name'),
  'loopback-only': L('Služba naslouchá jen na loopbacku', 'A service listening on loopback only'),
  'service-unreachable': L('Služba nedosažitelná po síti', 'A service unreachable over the network'),
  'config-syntax': L('Chyba syntaxe v konfiguraci', 'A syntax error in a configuration'),
  'upstream-mismatch': L('Proxy míří jinam než aplikace naslouchá', 'The proxy aims elsewhere than the app listens'),
  'cron-format': L('Formát řádku cronu', 'The cron line format'),
  'not-executable': L('Chybějící právo spuštění', 'A missing executable bit'),
  'cron-environment': L('Prostředí cronu (PATH)', 'The cron environment (PATH)'),
  'writable-root-script': L('Skript roota zapisovatelný pro ostatní', 'A root script writable by others'),
  'suid-binary': L('Nebezpečný SUID soubor', 'A dangerous SUID file'),
  'exposed-secret': L('Tajemství čitelné pro všechny', 'A secret readable by everyone'),
  'persistence-left': L('Zapomenutá perzistence útočníka', 'Attacker persistence left behind'),
  'credential-not-rotated': L('Ukradené heslo stále platí', 'A stolen password still valid'),
  'evidence-destroyed': L('Zničené důkazy', 'Destroyed evidence'),
  'ssh-effective-config': L('Efektivní konfigurace sshd', "sshd's effective configuration"),
  'ssh-key-perms': L('Oprávnění klíčů SSH', 'SSH key permissions'),
};

export interface RecurringMistake {
  mistake: string;
  /** Attempts in which it occurred. */
  count: number;
  scenarios: string[];
  last: number;
}

/** A mistake is recurring once it has shown up in two or more attempts. */
export function recurringMistakes(attempts: readonly AttemptRecord[]): RecurringMistake[] {
  const byTag = new Map<string, RecurringMistake>();
  for (const attempt of attempts) {
    for (const mistake of new Set(attempt.failed.map((f) => f.mistake))) {
      const entry = byTag.get(mistake) ?? { mistake, count: 0, scenarios: [], last: 0 };
      entry.count++;
      if (!entry.scenarios.includes(attempt.scenarioId)) entry.scenarios.push(attempt.scenarioId);
      entry.last = Math.max(entry.last, attempt.finishedAt ?? attempt.startedAt);
      byTag.set(mistake, entry);
    }
  }
  return [...byTag.values()].filter((entry) => entry.count >= 2).sort((a, b) => b.count - a.count || b.last - a.last);
}

// ---------------------------------------------------------------------- recommendation

export type RecommendationKind = 'continue' | 'assignment' | 'remediation' | 'retention' | 'challenge' | 'next';

export interface Recommendation {
  scenarioId: string;
  kind: RecommendationKind;
  reason: L;
}

export interface Blocked {
  scenarioId: string;
  /** Skills that are struggling or not yet met, which this scenario builds on. */
  waitingFor: string[];
}

export interface PlanInput {
  scenarios: readonly ScenarioDef[];
  attempts: readonly AttemptRecord[];
  /** What the lab host can run; scenarios needing more are left out. */
  capabilities: ReadonlySet<Capability>;
  /** Scenario ids a teacher assigned and the learner has not done yet. */
  assigned: readonly string[];
  now: number;
}

export interface Plan {
  recommendations: Recommendation[];
  blocked: Blocked[];
  /** The difficulty the learner solves on their own; 0 before any independent solve. */
  comfort: number;
}

const skillTitle = (id: string): L => SKILL_BY_ID.get(id)?.title ?? L(id, id);

const runnable = (scenario: ScenarioDef, capabilities: ReadonlySet<Capability>): boolean =>
  scenario.requires.every((capability) => capabilities.has(capability));

/**
 * What to do next, best first, each with its reason. In order of precedence: a lab still
 * open; what a teacher assigned; targeted practice for a skill the learner struggles with;
 * a skill due to be shown again after a pause; then the road ahead — harder and
 * multi-fault labs once the learner keeps solving on their own. A scenario that builds on
 * a skill the learner is struggling with waits until that skill has been practised.
 */
export function planNext(input: PlanInput): Plan {
  const byId = new Map(input.scenarios.map((scenario) => [scenario.id, scenario]));
  const progress = new Map(skillProgress(input.attempts, byId, input.now).map((entry) => [entry.skill, entry]));
  const available = input.scenarios.filter((scenario) => runnable(scenario, input.capabilities));
  const finishedAttempts = input.attempts.filter(finished);
  const qualities = finishedAttempts.map((attempt) => attemptQuality(attempt, byId.get(attempt.scenarioId)));

  const comfort = Math.max(
    0,
    ...finishedAttempts
      .filter((_, index) => qualities[index]!.independent)
      .map((attempt) => byId.get(attempt.scenarioId)?.difficulty ?? 0),
  );
  const lastThree = qualities.slice(-3);
  const onARoll = lastThree.length === 3 && lastThree.every((q) => q.independent);

  const solvedIndependently = new Set(
    finishedAttempts.filter((_, index) => qualities[index]!.independent).map((attempt) => attempt.scenarioId),
  );
  const solvedAtAll = new Set(finishedAttempts.filter((a) => a.status === 'solved').map((a) => a.scenarioId));

  const struggling = [...progress.values()].filter((entry) => entry.struggling);
  const strugglingIds = new Set(struggling.map((entry) => entry.skill));

  // The easiest lab whose main skill is a given one: the place to practise that skill.
  const entryLevel = (skill: string): number =>
    Math.min(99, ...available.filter((scenario) => scenario.skills[0] === skill).map((scenario) => scenario.difficulty));

  const blocked: Blocked[] = [];
  const open: ScenarioDef[] = [];
  for (const scenario of available) {
    // A struggling skill waits for targeted practice before it is met again inside
    // something bigger: a lab that builds on it, or one that mixes it into a harder,
    // multi-layer problem. Labs that are about that skill itself stay open.
    const waitingFor = [...strugglingIds].filter(
      (skill) =>
        (scenario.prerequisites.includes(skill) && !scenario.skills.includes(skill)) ||
        (scenario.skills.includes(skill) && scenario.skills[0] !== skill && scenario.difficulty > entryLevel(skill)),
    );
    if (waitingFor.length > 0) blocked.push({ scenarioId: scenario.id, waitingFor });
    else open.push(scenario);
  }

  const out: Recommendation[] = [];
  const seen = new Set<string>();
  const add = (scenarioId: string, kind: RecommendationKind, reason: L): void => {
    if (seen.has(scenarioId)) return;
    seen.add(scenarioId);
    out.push({ scenarioId, kind, reason });
  };

  for (const attempt of input.attempts.filter((a) => a.status === 'active')) {
    if (byId.has(attempt.scenarioId)) {
      add(attempt.scenarioId, 'continue', L('Laboratoř je rozpracovaná.', 'This lab is in progress.'));
    }
  }

  for (const id of input.assigned) {
    const scenario = byId.get(id);
    if (scenario && runnable(scenario, input.capabilities)) {
      add(id, 'assignment', L('Zadal(a) vám ji učitel(ka).', 'Your teacher assigned it.'));
    }
  }

  // Targeted practice: the easiest lab that trains the struggling skill and was not yet
  // solved on one's own; failing that, the one solved least well, to try again.
  for (const entry of struggling.sort((a, b) => a.score - b.score)) {
    const candidates = open
      .filter((scenario) => scenario.skills.includes(entry.skill))
      .sort(
        (a, b) =>
          Number(solvedIndependently.has(a.id)) - Number(solvedIndependently.has(b.id)) ||
          Number(a.skills[0] !== entry.skill) - Number(b.skills[0] !== entry.skill) ||
          a.difficulty - b.difficulty,
      );
    const pick = candidates[0];
    if (pick) {
      add(
        pick.id,
        'remediation',
        L(
          `Cílené procvičení: ${skillTitle(entry.skill).cs} vám zatím dělá potíže.`,
          `Targeted practice: ${skillTitle(entry.skill).en} has been giving you trouble.`,
        ),
      );
    }
  }

  // Retention: a skill shown on one's own, not practised for two weeks.
  for (const entry of progress.values()) {
    if ((entry.level === 'proficient' || entry.level === 'mastered') && !entry.retained && entry.lastPracticed !== null) {
      if (input.now - entry.lastPracticed < 14 * DAY) continue;
      const pick = open
        .filter((scenario) => scenario.skills[0] === entry.skill)
        .sort((a, b) => Number(solvedAtAll.has(a.id)) - Number(solvedAtAll.has(b.id)) || a.difficulty - b.difficulty)[0];
      if (pick) {
        add(
          pick.id,
          'retention',
          L(
            `Po delší pauze: ověřte, že ${skillTitle(entry.skill).cs.toLowerCase()} stále umíte.`,
            `After a pause: check that ${skillTitle(entry.skill).en.toLowerCase()} still holds.`,
          ),
        );
      }
    }
  }

  // The road ahead. Unsolved labs whose prerequisites have been met (or have no
  // prerequisites), the difficulty aimed a step above what is solved on one's own — and,
  // on a roll, multi-fault labs first.
  const met = (skill: string): boolean => {
    const entry = progress.get(skill);
    return entry !== undefined && entry.level !== 'new';
  };
  const target = onARoll ? comfort + 1 : Math.max(1, comfort);
  const ahead = open
    .filter((scenario) => !solvedAtAll.has(scenario.id))
    .map((scenario) => {
      const unmet = scenario.prerequisites.filter((skill) => !met(skill)).length;
      let score = Math.abs(scenario.difficulty - target) + unmet * 2;
      if (onARoll && scenario.faults > 1) score -= 1;
      if (scenario.untested) score += 0.5;
      return { scenario, score, unmet };
    })
    .sort((a, b) => a.score - b.score || a.scenario.difficulty - b.scenario.difficulty);
  for (const { scenario, unmet } of ahead) {
    if (onARoll && scenario.difficulty > comfort) {
      add(
        scenario.id,
        'challenge',
        scenario.faults > 1
          ? L('Řešíte samostatně — tady je víc chyb najednou.', 'You keep solving on your own — this one has several faults at once.')
          : L('Řešíte samostatně — o stupeň těžší.', 'You keep solving on your own — one step harder.'),
      );
    } else if (unmet === 0) {
      add(scenario.id, 'next', L('Další krok na vaší cestě.', 'The next step on your road.'));
    } else {
      add(
        scenario.id,
        'next',
        L('Nová oblast — začíná od základů.', 'A new area — it starts from the basics.'),
      );
    }
  }

  return { recommendations: out, blocked, comfort };
}

// ------------------------------------------------------------------ evidence from a lab

/** Which diagnostic signals a shell history shows. Timestamp comment lines are skipped. */
export function matchDiagnostics(history: string, signals: readonly DiagnosticSignal[]): string[] {
  const lines = history.split('\n').filter((line) => line.trim() !== '' && !/^#\d+$/.test(line.trim()));
  const found: string[] = [];
  for (const signal of signals) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(signal.pattern);
    } catch {
      continue;
    }
    if (lines.some((line) => pattern.test(line))) found.push(signal.id);
  }
  return found;
}

export interface ReportResult {
  passed: boolean;
  found: string[];
  missing: string[];
}

export function evaluateReport(text: string, report: NonNullable<ScenarioDef['report']>): ReportResult {
  const found: string[] = [];
  const missing: string[] = [];
  for (const item of report.mustMention) {
    if (new RegExp(item.pattern, 'i').test(text)) found.push(item.id);
    else missing.push(item.id);
  }
  // A list of keywords is not a report: ask for some sentences as well.
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return { passed: missing.length === 0 && words >= 40, found, missing };
}
