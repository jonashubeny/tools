/**
 * @lemma/labs — the Linux & Infrastructure mode: scenario definitions, skills, the
 * resource library and the learner model. Shared by the server (which shows it and keeps
 * the learner's record) and the lab worker (which runs the scenarios). Nothing here does
 * I/O; the web app never imports it, so solutions and check scripts stay on the server.
 */
import { CATEGORIES, type Category, type ScenarioDef } from './types';
import { MISTAKES } from './learning';
import { RESOURCE_BY_ID } from './resources';
import { writeSystemdUnit } from './scenarios/deployment';
import { deletedOpenLog, diskFullLogs, runawayProcess, serviceWontStart } from './scenarios/linux';
import { dnsResolution, nginx502, serviceReachability } from './scenarios/networking';
import { cronBackupBroken } from './scenarios/operations';
import { insecurePermissions, sshBruteforceTriage, sshHardening } from './scenarios/security';
import { PLANNED, SKILLS, SKILL_BY_ID } from './skills';

export * from './types';
export * from './skills';
export * from './resources';
export * from './learning';

/** In roadmap order within each category. */
export const SCENARIOS: ScenarioDef[] = [
  diskFullLogs,
  deletedOpenLog,
  runawayProcess,
  serviceWontStart,
  dnsResolution,
  serviceReachability,
  nginx502,
  cronBackupBroken,
  writeSystemdUnit,
  insecurePermissions,
  sshBruteforceTriage,
  sshHardening,
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

/** Changes whenever any scenario's version does; recorded with every attempt. */
export const LABS_CATALOG_VERSION = SCENARIOS.map((s) => `${s.id}@${s.version}`).join(',');

export interface RoadmapCategory {
  category: Category;
  skills: { skill: string; scenarios: string[]; planned: string[] }[];
}

/** Categories → skills → the scenarios whose main skill it is, plus what is planned. */
export function roadmap(): RoadmapCategory[] {
  return CATEGORIES.map((category) => ({
    category,
    skills: SKILLS.filter((skill) => skill.category === category).map((skill) => ({
      skill: skill.id,
      scenarios: SCENARIOS.filter((scenario) => scenario.skills[0] === skill.id).map((scenario) => scenario.id),
      planned: PLANNED.filter((entry) => entry.skill === skill.id).map((entry) => entry.title.en),
    })),
  }));
}

const NAME = /^[a-z][a-z0-9-]{0,20}$/;
const PRIVATE_SUBNET = /^(10\.\d{1,3}\.\d{1,3}\.0\/24|192\.168\.\d{1,3}\.0\/24|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.0\/24)$/;

/** Problems with the catalog, as sentences; empty when it is sound. Run by the test suite and by labd at start. */
export function lintScenarios(scenarios: readonly ScenarioDef[] = SCENARIOS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const s of scenarios) {
    const where = `scenario ${s.id}`;
    if (!/^[a-z][a-z0-9-]{2,40}$/.test(s.id)) problems.push(`${where}: id is not kebab-case`);
    if (ids.has(s.id)) problems.push(`${where}: duplicate id`);
    ids.add(s.id);
    if (s.machines.length === 0 || s.machines.length > 4) problems.push(`${where}: needs 1 to 4 machines`);
    const machines = new Set<string>();
    for (const m of s.machines) {
      if (!NAME.test(m.name)) problems.push(`${where}: machine name ${m.name} is not valid`);
      if (machines.has(m.name)) problems.push(`${where}: duplicate machine ${m.name}`);
      machines.add(m.name);
      if (m.memoryMb < 64 || m.memoryMb > 1024) problems.push(`${where}: ${m.name} memory out of 64..1024 MB`);
      if (m.cpus <= 0 || m.cpus > 2) problems.push(`${where}: ${m.name} cpus out of (0, 2]`);
      for (const t of m.tmpfs ?? []) {
        if (!t.path.startsWith('/srv/') && !t.path.startsWith('/var/lib/')) problems.push(`${where}: tmpfs ${t.path} outside /srv, /var/lib`);
        if (t.sizeMb > 256) problems.push(`${where}: tmpfs ${t.path} larger than 256 MB`);
      }
      if (m.image === 'full' && !s.requires.includes('multiUser')) problems.push(`${where}: image full needs multiUser`);
      for (const n of m.networks ?? []) {
        if (!s.networks?.some((net) => net.name === n.network)) problems.push(`${where}: ${m.name} on unknown network ${n.network}`);
      }
    }
    if ((s.networks?.length ?? 0) > 0 && !s.requires.includes('networks')) problems.push(`${where}: networks need the networks capability`);
    if (s.machines.length > 1 && !s.requires.includes('networks')) problems.push(`${where}: several machines need networks`);
    for (const net of s.networks ?? []) {
      if (!NAME.test(net.name)) problems.push(`${where}: network name ${net.name} is not valid`);
      if (!PRIVATE_SUBNET.test(net.subnet)) problems.push(`${where}: network ${net.name} is not a private /24`);
    }
    for (const step of [...s.provision, ...s.fault]) {
      if (!machines.has(step.machine)) problems.push(`${where}: step "${step.label}" on unknown machine ${step.machine}`);
    }
    const checkIds = new Set<string>();
    if (s.checks.length === 0) problems.push(`${where}: no checks`);
    for (const check of s.checks) {
      if (checkIds.has(check.id)) problems.push(`${where}: duplicate check ${check.id}`);
      checkIds.add(check.id);
      if (!machines.has(check.machine)) problems.push(`${where}: check ${check.id} on unknown machine ${check.machine}`);
      if (!(check.mistake in MISTAKES)) problems.push(`${where}: check ${check.id} names unknown mistake ${check.mistake}`);
    }
    const levels = s.hints.map((hint) => hint.level).join(',');
    if (levels !== '1,2,3') problems.push(`${where}: hints must be levels 1, 2, 3 in order (got ${levels})`);
    for (const skill of [...s.skills, ...s.prerequisites]) {
      if (!SKILL_BY_ID.has(skill)) problems.push(`${where}: unknown skill ${skill}`);
    }
    if (s.skills.length === 0) problems.push(`${where}: practises no skill`);
    for (const resource of s.resources) {
      if (!RESOURCE_BY_ID.has(resource)) problems.push(`${where}: unknown resource ${resource}`);
    }
    for (const d of s.diagnostics) {
      try {
        new RegExp(d.pattern);
      } catch {
        problems.push(`${where}: diagnostic ${d.id} pattern does not compile`);
      }
    }
    for (const item of s.report?.mustMention ?? []) {
      try {
        new RegExp(item.pattern, 'i');
      } catch {
        problems.push(`${where}: report item ${item.id} pattern does not compile`);
      }
    }
    if (s.ttlMinutes < 15 || s.ttlMinutes > 240) problems.push(`${where}: ttl out of 15..240 minutes`);
  }
  return problems;
}
