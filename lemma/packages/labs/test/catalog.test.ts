import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  MISTAKES,
  OFFICIAL_HOSTS,
  RESOURCES,
  SCENARIOS,
  SKILLS,
  lintScenarios,
  roadmap,
} from '../src';

describe('the scenario catalog', () => {
  it('passes its own lint', () => {
    expect(lintScenarios()).toEqual([]);
  });

  it('has bilingual texts everywhere a learner reads', () => {
    for (const s of SCENARIOS) {
      for (const text of [s.title, s.summary, s.briefing, s.solution, s.explanation, ...s.objectives, ...s.hints.map((h) => h.text)]) {
        expect(text.cs.trim(), s.id).not.toBe('');
        expect(text.en.trim(), s.id).not.toBe('');
      }
      for (const check of s.checks) {
        expect(check.label.cs && check.label.en && check.failHint.cs && check.failHint.en, `${s.id}/${check.id}`).toBeTruthy();
      }
    }
  });

  // Every script is parsed by bash, so a quoting slip is caught here and not in a lab.
  it('has scripts that bash can parse', () => {
    for (const s of SCENARIOS) {
      const scripts = [
        ...s.provision.map((step) => [step.label, step.script]),
        ...s.fault.map((step) => [step.label, step.script]),
        ...s.selfTest.map((step) => [step.label, step.script]),
        ...s.checks.map((check) => [`check ${check.id}`, check.script]),
      ];
      for (const [label, script] of scripts) {
        expect(() => execFileSync('bash', ['-n'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] }), `${s.id}: ${label}`).not.toThrow();
      }
    }
  });

  it('gives every scenario a reference fix and a mistake label for every check', () => {
    for (const s of SCENARIOS) {
      expect(s.selfTest.length, s.id).toBeGreaterThan(0);
      for (const check of s.checks) expect(MISTAKES[check.mistake], `${s.id}/${check.id}`).toBeDefined();
    }
  });

  it('never sends a lab anywhere but private address space', () => {
    for (const s of SCENARIOS) {
      for (const net of s.networks ?? []) expect(net.subnet).toMatch(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/);
      // Synthetic attackers come from the documentation ranges (RFC 5737), never real hosts.
      const text = JSON.stringify(s);
      for (const ip of text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) ?? []) {
        expect(ip, `${s.id}: ${ip}`).toMatch(/^(10\.|127\.|0\.0\.0\.0|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/);
      }
    }
  });
});

describe('the resource library', () => {
  it('links to official documentation only, over HTTPS', () => {
    for (const r of RESOURCES.filter((entry) => entry.kind === 'link')) {
      const url = new URL(r.url!);
      expect(url.protocol, r.id).toBe('https:');
      expect(OFFICIAL_HOSTS, r.id).toContain(url.host);
    }
  });

  it('says what each written resource was checked against', () => {
    for (const r of RESOURCES.filter((entry) => entry.kind !== 'link')) {
      expect(r.body?.cs && r.body.en, r.id).toBeTruthy();
      expect(r.verifiedOn, r.id).toBeTruthy();
    }
  });

  it('only names skills that exist', () => {
    const skills = new Set(SKILLS.map((s) => s.id));
    for (const r of RESOURCES) for (const skill of r.skills) expect(skills.has(skill), `${r.id}: ${skill}`).toBe(true);
  });
});

describe('the roadmap', () => {
  it('covers every category and every scenario once', () => {
    const map = roadmap();
    expect(map.map((c) => c.category)).toEqual(['linux', 'networking', 'operations', 'deployment', 'security']);
    const listed = map.flatMap((c) => c.skills.flatMap((s) => s.scenarios));
    expect(listed.sort()).toEqual(SCENARIOS.map((s) => s.id).sort());
  });
});
