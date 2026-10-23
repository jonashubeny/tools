import type { L } from '@lemma/core';

/**
 * The scenario model of the Linux & Infrastructure mode.
 *
 * A scenario is data, reviewed like code: which machines a lab has, the scripts that bring
 * them into a known initial state, the fault or task laid on top, and the checks that say
 * whether it has been solved. The lab worker runs these scripts *inside* the lab's own
 * containers and nowhere else; it never runs a command that a request carried in.
 */

/** What a host must be able to do for a scenario to run on it. The lab worker probes each. */
export type Capability =
  /** systemd as PID 1 inside a lab container. */
  | 'systemd'
  /** More than one user ID inside a container: chown, su, services that drop privileges. */
  | 'multiUser'
  /** Private, internal networks between the machines of one lab. */
  | 'networks';

export const CAPABILITIES: readonly Capability[] = ['systemd', 'multiUser', 'networks'];

/**
 * Lab images, built by the lab worker from `packages/labd/images/<id>`.
 *   base  Debian 12, systemd, the usual diagnostic tools, Python — builds everywhere
 *   full  base + nginx, cron, OpenSSH, sudo — needs a host with full UID mapping
 */
export type ImageId = 'base' | 'full';

export type Category = 'linux' | 'networking' | 'operations' | 'deployment' | 'security';

export const CATEGORIES: readonly Category[] = ['linux', 'networking', 'operations', 'deployment', 'security'];

export interface MachineDef {
  /** Host name inside the lab; also the name the terminal offers. */
  name: string;
  image: ImageId;
  memoryMb: number;
  /** CPU share, in CPUs (0.5 = half of one). */
  cpus: number;
  /** Size-limited tmpfs mounts, e.g. a small "disk" that a scenario fills. */
  tmpfs?: { path: string; sizeMb: number }[];
  /** Lab networks the machine is attached to, with its address on each. */
  networks?: { network: string; address: string }[];
  /** Extra capabilities, confined to the container's own namespaces. */
  capAdd?: ('NET_ADMIN' | 'NET_RAW')[];
}

export interface NetworkDef {
  name: string;
  /** IPv4 subnet, private range only. */
  subnet: string;
}

/** A script run as root inside one machine, with bash -euo pipefail. */
export interface Step {
  machine: string;
  label: string;
  script: string;
  timeoutSec?: number;
}

/** A check passes when its script exits 0. */
export interface Check {
  id: string;
  machine: string;
  label: L;
  script: string;
  timeoutSec?: number;
  /**
   * What it most likely means when this check fails, as a tag the learner model counts:
   * the same tag failing in several labs is a recurring mistake.
   */
  mistake: string;
  /** Said when the check fails: what it looked at, without giving the fix away. */
  failHint: L;
}

/**
 * Progressive help, in three levels:
 *   1  where to look — a concept
 *   2  diagnostic commands to run, and how to read what they print
 *   3  the explanation and the fix
 */
export interface Hint {
  level: 1 | 2 | 3;
  text: L;
  commands?: string[];
}

/** A command that shows good diagnostic practice, recognised in the shell history. */
export interface DiagnosticSignal {
  id: string;
  label: L;
  /** Regular expression matched against each history line. */
  pattern: string;
}

export interface ScenarioDef {
  /** Stable id, kebab-case. */
  id: string;
  /** Raised whenever provisioning, the fault or a check changes. */
  version: number;
  title: L;
  /** One line for lists. */
  summary: L;
  /** The situation, as it would be handed to an administrator on call. */
  briefing: L;
  category: Category;
  /** 1 (first week) … 5 (several interacting faults). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** How many separate problems have to be found. */
  faults: number;
  /** Skills practised, by id; the first is the main one. */
  skills: string[];
  /** Skills a learner should have met first. */
  prerequisites: string[];
  objectives: L[];
  estimatedMinutes: number;
  requires: Capability[];
  machines: MachineDef[];
  networks?: NetworkDef[];
  /** The known initial state. Has to be repeatable: a reset runs it again on a fresh machine. */
  provision: Step[];
  /** The fault, or the task's starting point, laid on top of the initial state. */
  fault: Step[];
  checks: Check[];
  /**
   * A reviewed reference fix. Never shown and never reachable through the lab API: the
   * self-test (`labd selftest`) applies it to a fresh lab to prove that the checks fail
   * before and pass after, so a scenario that cannot be solved is caught before a learner
   * meets it.
   */
  selfTest: Step[];
  hints: Hint[];
  diagnostics: DiagnosticSignal[];
  /** The worked solution, Markdown. */
  solution: L;
  /** What was going on and why it matters, shown after the lab is solved. Markdown. */
  explanation: L;
  /** Resource ids. */
  resources: string[];
  /**
   * A written report is part of the task (incident triage). It is kept with the attempt,
   * where a teacher can read it, and counts as passed once it names every finding listed.
   */
  report?: { prompt: L; mustMention: { id: string; label: L; pattern: string }[] };
  /** How a reset works. 'recreate': fresh containers from the image, provisioning run again. */
  reset: 'recreate';
  /** Lifetime of an idle lab before it is removed. */
  ttlMinutes: number;
  /** Software the scenario was written and checked against. */
  verifiedOn: string;
  /**
   * Written and reviewed, but not yet run end to end on a host that has what it requires.
   * The interface says so; the worker runs it all the same where the host can.
   */
  untested?: boolean;
}

export interface SkillDef {
  id: string;
  category: Category;
  title: L;
  description: L;
  prerequisites: string[];
}

/** An entry of the roadmap that has no lab yet: listed so the road ahead is honest. */
export interface PlannedTopic {
  category: Category;
  skill: string;
  title: L;
}

export type ResourceKind = 'doc' | 'cheatsheet' | 'checklist' | 'link' | 'explainer';

export interface ResourceDef {
  id: string;
  kind: ResourceKind;
  title: L;
  /** Skills it belongs to. */
  skills: string[];
  /** For 'link': an official documentation page. */
  url?: string;
  /** For everything else: Markdown, written for Lemma. */
  body?: L;
  /** What the text was checked against, e.g. "Debian 12, systemd 252". */
  verifiedOn?: string;
}
