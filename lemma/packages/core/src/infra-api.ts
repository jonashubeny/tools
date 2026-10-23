import type { L } from './i18n';

/**
 * The API of the Linux & Infrastructure mode: what the server sends and the web app reads.
 * Scenario scripts and check scripts never appear here — the web app gets labels, texts
 * and results, and a hint or the solution only once the learner asks for it.
 */

/** Which of the two learning modes an account is in; null until chosen. */
export type LearningMode = 'math' | 'infra';

export const isLearningMode = (value: unknown): value is LearningMode => value === 'math' || value === 'infra';

export type InfraCategory = 'linux' | 'networking' | 'operations' | 'deployment' | 'security';
export type InfraCapability = 'systemd' | 'multiUser' | 'networks';
export type InfraSkillLevel = 'new' | 'learning' | 'practising' | 'proficient' | 'mastered';

/** Whether labs can run at all, and what the lab host can do. */
export interface LabHostDto {
  /** LABD_URL and LABD_TOKEN are set. */
  configured: boolean;
  /** labd answered. */
  reachable: boolean;
  engine: string | null;
  capabilities: Record<InfraCapability, boolean | null>;
  images: Record<'base' | 'full', 'pending' | 'building' | 'ready' | 'failed' | 'unsupported'>;
  preparing: boolean;
  problems: string[];
}

export interface ScenarioSummaryDto {
  id: string;
  version: number;
  title: L;
  summary: L;
  category: InfraCategory;
  difficulty: number;
  faults: number;
  skills: string[];
  prerequisites: string[];
  estimatedMinutes: number;
  requires: InfraCapability[];
  machines: number;
  untested: boolean;
  /** Can this host run it now? */
  runnable: boolean;
  /** Why not, when it cannot. */
  unavailable: L | null;
  /** Skills the learner struggles with that this scenario builds on. */
  waitingFor: string[];
  progress: 'new' | 'attempted' | 'solved' | 'independent';
  attempts: number;
}

export interface CheckLabelDto {
  id: string;
  label: L;
}

export interface ResourceDto {
  id: string;
  kind: 'doc' | 'cheatsheet' | 'checklist' | 'link' | 'explainer' | 'pdf';
  title: L;
  skills: string[];
  scenarios: string[];
  url: string | null;
  body: L | null;
  verifiedOn: string | null;
}

export interface ScenarioDetailDto extends ScenarioSummaryDto {
  briefing: L;
  objectives: L[];
  machineNames: string[];
  checks: CheckLabelDto[];
  resources: ResourceDto[];
  report: { prompt: L; items: { id: string; label: L }[] } | null;
  verifiedOn: string;
  history: AttemptSummaryDto[];
  note: string;
}

export type LabStatusDto = 'provisioning' | 'ready' | 'busy' | 'failed' | 'destroying' | 'destroyed' | 'expired' | 'unknown';

export interface LabDto {
  id: string;
  status: LabStatusDto;
  operation: 'create' | 'verify' | 'reset' | null;
  error: string | null;
  createdAt: number;
  readyAt: number | null;
  expiresAt: number;
  machines: string[];
}

export interface CheckResultDto {
  id: string;
  label: L;
  passed: boolean;
  /** What the failed check looked at, without the fix. */
  hint: L | null;
}

export interface HintDto {
  level: 1 | 2 | 3;
  text: L;
  commands: string[];
}

export type AttemptStatus = 'active' | 'solved' | 'abandoned' | 'expired';

export interface AttemptSummaryDto {
  id: string;
  scenarioId: string;
  version: number;
  status: AttemptStatus;
  startedAt: number;
  finishedAt: number | null;
  hintLevel: number;
  solutionViewed: boolean;
  verifications: number;
  independent: boolean;
  seconds: number;
  mistakes: string[];
}

export interface AttemptDto extends AttemptSummaryDto {
  scenario: ScenarioDetailDto;
  lab: LabDto | null;
  hints: HintDto[];
  solution: L | null;
  /** After a solve: what was going on and why it matters. */
  explanation: L | null;
  results: CheckResultDto[] | null;
  diagnostics: { id: string; label: L; used: boolean }[];
  report: string;
  reportResult: { passed: boolean; found: string[]; missing: string[] } | null;
}

export interface SkillProgressDto {
  skill: string;
  category: InfraCategory;
  title: L;
  description: L;
  level: InfraSkillLevel;
  score: number;
  attempts: number;
  solved: number;
  independent: number;
  retained: boolean;
  lastPracticed: number | null;
  struggling: boolean;
  next: L[];
}

export interface InfraMistakeDto {
  mistake: string;
  label: L;
  count: number;
  scenarios: string[];
  last: number;
}

export interface RecommendationDto {
  scenario: ScenarioSummaryDto;
  kind: 'continue' | 'assignment' | 'remediation' | 'retention' | 'challenge' | 'next';
  reason: L;
}

export interface InfraAssignmentDto {
  id: string;
  scenarioId: string;
  note: string;
  dueDay: string | null;
  createdBy: string;
  createdAt: number;
  status: 'open' | 'done' | 'cancelled';
  doneAt: number | null;
  attemptId: string | null;
}

export interface InfraOverviewDto {
  host: LabHostDto;
  active: AttemptSummaryDto | null;
  recommendations: RecommendationDto[];
  skills: SkillProgressDto[];
  recurring: InfraMistakeDto[];
  recent: AttemptSummaryDto[];
  assignments: InfraAssignmentDto[];
  totals: { solved: number; independent: number; attempts: number; minutes: number };
  comfort: number;
}

export interface InfraRoadmapDto {
  categories: {
    category: InfraCategory;
    title: L;
    skills: { skill: SkillProgressDto; scenarios: ScenarioSummaryDto[]; planned: L[] }[];
  }[];
}

export interface StudyGuideDto {
  title: L;
  generatedAt: number;
  sections: { title: L; body: L; source: string; verifiedOn: string | null }[];
  links: { title: L; url: string }[];
}

/** A teacher's view of one learner's lab work. */
export interface InfraStudentDto {
  username: string;
  skills: SkillProgressDto[];
  recurring: InfraMistakeDto[];
  attempts: (AttemptSummaryDto & { title: L; report: string; reportPassed: boolean | null })[];
  assignments: InfraAssignmentDto[];
  recommendations: RecommendationDto[];
}

/** The administrator's view of the lab host. */
export interface LabAdminDto {
  host: LabHostDto;
  limits: Record<string, number> | null;
  labs: {
    id: string;
    owner: string;
    scenarioId: string;
    status: LabStatusDto;
    error: string | null;
    detail: string | null;
    createdAt: number;
    expiresAt: number;
    endedAt: number | null;
    machines: { name: string; memory: number | null; cpuPercent: number | null; diskBytes: number | null }[];
  }[];
}
