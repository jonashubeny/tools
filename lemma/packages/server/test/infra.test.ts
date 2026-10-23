import type { AttemptDto, InfraOverviewDto, InfraStudentDto, LabHostDto, MeDto, ScenarioDetailDto, SettingsDto } from '@lemma/core';
import { SCENARIO_BY_ID } from '@lemma/labs';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpError } from '../src/services/context';
import type { LabService, LabView, VerifyResult } from '../src/services/infra/labd';
import { asAdmin, cleanUp, createUser, instance, setTeachers } from './fixtures';
import { harness } from './helpers';

/**
 * The Linux & Infrastructure mode on the server, with labd replaced by a fake that keeps
 * labd's own rule: a lab answers only to its owner. What a check returns is set by the
 * test, as if the learner had (or had not) fixed the machine.
 */

afterEach(cleanUp);

const HOST: LabHostDto = {
  configured: true,
  reachable: true,
  engine: 'Fake 1',
  capabilities: { systemd: true, multiUser: false, networks: false },
  images: { base: 'ready', full: 'unsupported' },
  preparing: false,
  problems: [],
};

class FakeLabs implements LabService {
  labs = new Map<string, LabView>();
  passing = new Set<string>();
  diagnostics: string[] = [];
  private n = 0;
  configured = () => true;
  async status() {
    return { host: HOST, limits: { maxLabs: 4 } };
  }
  private own(owner: string, id: string): LabView {
    const lab = this.labs.get(id);
    if (!lab || lab.owner !== owner) throw new HttpError(404, 'not_found', 'no such lab');
    return lab;
  }
  async create(owner: string, scenario: string) {
    if ([...this.labs.values()].some((l) => l.owner === owner && l.status === 'ready'))
      throw new HttpError(409, 'owner_limit', 'you already have a lab running');
    const lab: LabView = {
      id: `lab${++this.n}`, owner, scenarioId: scenario, version: 1, status: 'ready', operation: null, error: null,
      createdAt: 0, readyAt: 0, expiresAt: 1e15, endedAt: null, generation: 0, verifications: 0,
      machines: SCENARIO_BY_ID.get(scenario)!.machines.map((m) => m.name),
    };
    this.labs.set(lab.id, lab);
    return lab;
  }
  async get(owner: string, id: string) {
    try {
      return this.own(owner, id);
    } catch {
      return null;
    }
  }
  async list(owner: string) {
    return [...this.labs.values()].filter((l) => l.owner === owner);
  }
  async verify(owner: string, id: string): Promise<VerifyResult> {
    const lab = this.own(owner, id);
    const checks = SCENARIO_BY_ID.get(lab.scenarioId)!.checks;
    return { lab, results: checks.map((c) => ({ id: c.id, passed: this.passing.has(c.id), ms: 1 })), diagnostics: this.diagnostics };
  }
  async reset(owner: string, id: string) {
    return this.own(owner, id);
  }
  async touch(owner: string, id: string) {
    return this.own(owner, id);
  }
  async destroy(owner: string, id: string) {
    const lab = this.own(owner, id);
    lab.status = 'destroyed';
    return lab;
  }
  async adminLabs() {
    return { labs: [...this.labs.values()].map((l) => ({ ...l, detail: null })), usage: [] };
  }
  async adminDestroy() {}
  async prepare() {}
  terminal(): never {
    throw new Error('not in these tests');
  }
}

describe('choosing a mode', () => {
  it('starts with no mode, and keeps the choice per account', async () => {
    const h = harness();
    expect((await h.get<MeDto>('/api/me')).body.settings.mode).toBeNull();
    const set = await h.send<SettingsDto>('PUT', '/api/settings', { mode: 'infra' });
    expect(set.body.mode).toBe('infra');
    expect((await h.send<SettingsDto>('PUT', '/api/settings', { mode: 'chemistry' })).body.mode).toBe('infra');
    expect((await h.get<MeDto>('/api/me')).body.settings.mode).toBe('infra');
  });
});

describe('a lab, from start to solve', () => {
  it('records failed checks, help taken and diagnostics, and solves when every check passes', async () => {
    const labs = new FakeLabs();
    const h = harness({ labs });
    const started = await h.send<AttemptDto>('POST', '/api/infra/scenarios/dns-resolution/start');
    expect(started.status).toBe(200);
    const id = started.body.id;
    expect(started.body.lab?.status).toBe('ready');
    // The page never gets a check script or the solution up front.
    expect(JSON.stringify(started.body)).not.toContain('getent hosts db.lab.internal |');
    expect(started.body.solution).toBeNull();

    // A second lab while one is open: refused.
    expect((await h.send('POST', '/api/infra/scenarios/disk-full-logs/start')).status).toBe(409);

    const failed = await h.send<AttemptDto>('POST', `/api/infra/attempts/${id}/verify`);
    expect(failed.body.status).toBe('active');
    expect(failed.body.results!.every((r) => !r.passed && r.hint !== null)).toBe(true);

    const hinted = await h.send<AttemptDto>('POST', `/api/infra/attempts/${id}/hint`);
    expect(hinted.body.hints.map((x) => x.level)).toEqual([1]);

    labs.passing = new Set(SCENARIO_BY_ID.get('dns-resolution')!.checks.map((c) => c.id));
    labs.diagnostics = ['getent', 'nsswitch'];
    const solved = await h.send<AttemptDto>('POST', `/api/infra/attempts/${id}/verify`);
    expect(solved.body.status).toBe('solved');
    expect(solved.body.explanation).not.toBeNull();
    expect(solved.body.solution).not.toBeNull();
    expect(solved.body.independent).toBe(true);
    expect(solved.body.mistakes).toContain('name-not-resolving');
    expect(solved.body.diagnostics.filter((d) => d.used).map((d) => d.id)).toEqual(['getent', 'nsswitch']);

    const finished = await h.send<AttemptDto>('POST', `/api/infra/attempts/${id}/finish`);
    expect(finished.body.lab).toBeNull();
    expect(labs.labs.get('lab1')!.status).toBe('destroyed');

    const overview = await h.get<InfraOverviewDto>('/api/infra/overview');
    expect(overview.body.totals).toMatchObject({ solved: 1, independent: 1, attempts: 1 });
    expect(overview.body.skills.find((s) => s.skill === 'net.dns')!.level).toBe('proficient');
    // Labs this host cannot run are never recommended.
    for (const r of overview.body.recommendations) expect(r.scenario.runnable).toBe(true);
  });

  it('asks for the report as well when the scenario has one', async () => {
    const labs = new FakeLabs();
    const h = harness({ labs });
    const { id } = (await h.send<AttemptDto>('POST', '/api/infra/scenarios/ssh-bruteforce-triage/start')).body;
    labs.passing = new Set(SCENARIO_BY_ID.get('ssh-bruteforce-triage')!.checks.map((c) => c.id));
    expect((await h.send<AttemptDto>('POST', `/api/infra/attempts/${id}/verify`)).body.status).toBe('active');
    const report =
      'At night 203.0.113.45 guessed passwords over SSH and got into the deploy account. With sudo it created a second ' +
      'root account named support, a service dbus-update that kept running, and its own key in authorized_keys. I removed ' +
      'all of it, locked deploy, and kept the logs. Password login should be switched off and sudo for deploy narrowed.';
    const done = await h.send<AttemptDto>('PUT', `/api/infra/attempts/${id}/report`, { report });
    expect(done.body.reportResult?.passed).toBe(true);
    expect(done.body.status).toBe('solved');
  });

  it('closes an attempt whose lab has gone (expired) and counts the solution as help', async () => {
    const labs = new FakeLabs();
    const h = harness({ labs });
    const { id } = (await h.send<AttemptDto>('POST', '/api/infra/scenarios/disk-full-logs/start')).body;
    const shown = await h.send<AttemptDto>('POST', `/api/infra/attempts/${id}/solution`);
    expect(shown.body.solution).not.toBeNull();
    expect(shown.body.solutionViewed).toBe(true);
    labs.labs.get('lab1')!.status = 'expired';
    const after = await h.get<AttemptDto>(`/api/infra/attempts/${id}`);
    expect(after.body.status).toBe('expired');
    expect(after.body.lab).toBeNull();
    expect((await h.send('POST', `/api/infra/attempts/${id}/verify`)).status).toBe(409);
  });

  it('keeps working without a lab service', async () => {
    const h = harness();
    const overview = await h.get<InfraOverviewDto>('/api/infra/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.host.configured).toBe(false);
    expect(overview.body.recommendations).toEqual([]);
    const detail = await h.get<ScenarioDetailDto>('/api/infra/scenarios/disk-full-logs');
    expect(detail.body.runnable).toBe(false);
    expect((await h.send('POST', '/api/infra/scenarios/disk-full-logs/start')).status).toBe(503);
    // The mathematics mode is untouched.
    expect((await h.get('/api/dashboard')).status).toBe(200);
  });
});

describe('boundaries between accounts', () => {
  it('lets nobody reach another learner’s attempts, labs or notes', async () => {
    const labs = new FakeLabs();
    const h = instance({}, labs);
    const admin = await asAdmin(h);
    const ema = await createUser(h, admin, 'ema');
    const pavel = await createUser(h, admin, 'pavel');
    const started = await h.send<AttemptDto>('POST', '/api/infra/scenarios/dns-resolution/start', {}, { Cookie: ema });
    const id = started.body.id;
    expect(labs.labs.get('lab1')!.owner).toBe('ema');

    for (const [method, path] of [
      ['GET', `/api/infra/attempts/${id}`],
      ['POST', `/api/infra/attempts/${id}/verify`],
      ['POST', `/api/infra/attempts/${id}/hint`],
      ['POST', `/api/infra/attempts/${id}/reset`],
      ['POST', `/api/infra/attempts/${id}/finish`],
    ] as const) {
      const r = method === 'GET' ? await h.get(path, { Cookie: pavel }) : await h.send(method, path, {}, { Cookie: pavel });
      expect(r.status, `${method} ${path}`).toBe(404);
    }
    expect(labs.labs.get('lab1')!.status).toBe('ready');
    // Pavel's own lab is his: the fake, like labd, refuses a lab of another owner.
    const own = await h.send<AttemptDto>('POST', '/api/infra/scenarios/dns-resolution/start', {}, { Cookie: pavel });
    expect(labs.labs.get(own.body.lab!.id)!.owner).toBe('pavel');

    await h.send('PUT', '/api/infra/notes/dns-resolution', { body: 'ema’s private note' }, { Cookie: ema });
    const pavelView = await h.get<ScenarioDetailDto>('/api/infra/scenarios/dns-resolution', { Cookie: pavel });
    expect(pavelView.body.note).toBe('');
    expect(pavelView.body.history.map((a) => a.id)).not.toContain(id);
  });

  it('shows a teacher their students’ lab work and lets them assign — and nobody else', async () => {
    const labs = new FakeLabs();
    const h = instance({}, labs);
    const admin = await asAdmin(h);
    const ema = await createUser(h, admin, 'ema');
    const pavel = await createUser(h, admin, 'pavel');
    await setTeachers(h, admin, 'ema', ['pavel']);

    await h.send('PUT', '/api/infra/notes/dns-resolution', { body: 'private' }, { Cookie: ema });
    const { id } = (await h.send<AttemptDto>('POST', '/api/infra/scenarios/dns-resolution/start', {}, { Cookie: ema })).body;
    await h.send('POST', `/api/infra/attempts/${id}/verify`, {}, { Cookie: ema });

    const view = await h.get<InfraStudentDto>('/api/teach/students/ema/infra', { Cookie: pavel });
    expect(view.status).toBe(200);
    expect(view.body.attempts.map((a) => a.id)).toEqual([id]);
    const detail = await h.get<AttemptDto>(`/api/teach/students/ema/infra/attempts/${id}`, { Cookie: pavel });
    expect(detail.body.results?.length).toBeGreaterThan(0);
    expect(detail.body.scenario.note).toBe('');

    const assigned = await h.send('POST', '/api/teach/students/ema/infra/assignments', { scenario: 'disk-full-logs', note: 'before Friday' }, { Cookie: pavel });
    expect(assigned.status).toBe(200);
    const overview = await h.get<InfraOverviewDto>('/api/infra/overview', { Cookie: ema });
    expect(overview.body.assignments.map((a) => a.scenarioId)).toEqual(['disk-full-logs']);

    // The administrator is nobody's teacher by default; Ema does not teach Pavel.
    expect((await h.get('/api/teach/students/ema/infra', { Cookie: admin })).status).toBe(403);
    expect((await h.get('/api/teach/students/pavel/infra', { Cookie: ema })).status).toBe(403);
    // Lab host administration is the administrator's alone.
    expect((await h.get('/api/admin/labs', { Cookie: pavel })).status).toBe(403);
    expect((await h.get('/api/admin/labs', { Cookie: admin })).status).toBe(200);
  });
});

describe('PDF study guides', () => {
  it('takes PDFs from the administrator only, refuses anything else, and serves them sandboxed', async () => {
    const h = instance({}, new FakeLabs());
    const admin = await asAdmin(h);
    const ema = await createUser(h, admin, 'ema');
    const upload = (cookie: string, bytes: string, name = 'guide.pdf') => {
      const form = new FormData();
      form.set('title', 'systemd v kostce');
      form.set('skills', 'linux.systemd,not.a.skill');
      form.set('file', new File([bytes], name, { type: 'application/pdf' }));
      return h.app.request('/api/admin/infra/files', { method: 'POST', body: form, headers: { Cookie: cookie } });
    };
    expect((await upload(ema, '%PDF-1.7 x')).status).toBe(403);
    expect((await upload(admin, '<html>not a pdf</html>', 'evil.pdf')).status).toBe(400);
    const ok = await upload(admin, '%PDF-1.7\n%lab test\n');
    expect(ok.status).toBe(200);
    const file = (await ok.json()) as { id: string; url: string; skills: string[] };
    expect(file.skills).toEqual(['linux.systemd']);

    const listed = await h.get<{ id: string }[]>('/api/infra/resources', { Cookie: ema });
    expect(listed.body.map((r) => r.id)).toContain(file.id);
    const served = await h.get(file.url, { Cookie: ema });
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('application/pdf');
    expect(served.headers.get('content-security-policy')).toContain('sandbox');
    expect((await h.get(file.url)).status).toBe(401);
  });
});
