'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SETTINGS,
  normalizeDomain,
  parseDomainList,
  isHostExcluded,
  normalizeSettings,
  hasRoom,
  quantizeStep,
} = require('../src/shared.js');

test('normalizeDomain přijme doménu, URL i zástupný znak', () => {
  assert.equal(normalizeDomain('Example.COM'), 'example.com');
  assert.equal(normalizeDomain('https://www.google.com/maps/@50,15'), 'www.google.com');
  assert.equal(normalizeDomain('*.openstreetmap.org'), 'openstreetmap.org');
  assert.equal(normalizeDomain('localhost:8080'), 'localhost');
  assert.equal(normalizeDomain('   '), '');
  assert.equal(normalizeDomain('# komentář'), '');
});

test('parseDomainList odstraní duplicity a prázdné řádky', () => {
  assert.deepEqual(parseDomainList('b.cz\n\na.cz, b.cz\n https://a.cz/x '), ['a.cz', 'b.cz']);
  assert.deepEqual(parseDomainList(['x.cz', 'X.cz']), ['x.cz']);
});

test('isHostExcluded pokrývá subdomény, ale ne podobná jména', () => {
  const list = ['google.com'];
  assert.ok(isHostExcluded('google.com', list));
  assert.ok(isHostExcluded('maps.google.com', list));
  assert.ok(isHostExcluded('MAPS.GOOGLE.COM.', list));
  assert.ok(!isHostExcluded('notgoogle.com', list));
  assert.ok(!isHostExcluded('google.com.evil.cz', list));
  assert.ok(!isHostExcluded('', list));
});

test('normalizeSettings doplní výchozí hodnoty a ořízne meze', () => {
  assert.deepEqual(normalizeSettings({}), { ...DEFAULT_SETTINGS, excludedDomains: [] });
  assert.equal(normalizeSettings({ factor: 5 }).factor, 1);
  assert.equal(normalizeSettings({ factor: 0 }).factor, 0.1);
  assert.equal(normalizeSettings({ factor: 'abc' }).factor, 0.5);
  assert.equal(normalizeSettings({ enabled: 'yes' }).enabled, true);
  assert.equal(normalizeSettings({ highResQuantum: 7.6 }).highResQuantum, 8);
  assert.deepEqual(normalizeSettings({ excludedDomains: ['A.cz', 'a.cz'] }).excludedDomains, ['a.cz']);
});

test('hasRoom: konce scrolleru a tolerance zlomkových pozic', () => {
  // scrollHeight 1000, výška 400 → maximum 600
  assert.ok(hasRoom(0, 1000, 400, 10));
  assert.ok(!hasRoom(0, 1000, 400, -10), 'nahoře nejde nahoru');
  assert.ok(!hasRoom(600, 1000, 400, 10), 'dole nejde dolů');
  assert.ok(!hasRoom(599.6, 1000, 400, 10), 'zlomek pod půl pixelu je konec');
  assert.ok(hasRoom(599.6, 1000, 400, -10));
  assert.ok(!hasRoom(100, 1000, 400, 0), 'nulová delta nikam nejede');
  assert.ok(!hasRoom(0, 400, 400, 10), 'obsah se vejde, není co scrollovat');
});

test('quantizeStep: zbytek se nesčítá do ztracena', () => {
  // Faktor 0.3 na deltách 1 px: bez přenosu zbytku by se nikdy nepohnulo.
  let carry = 0;
  let moved = 0;
  for (let i = 0; i < 10; i++) {
    const q = quantizeStep(1 * 0.3 + carry, 1);
    moved += q.step;
    carry = q.carry;
  }
  assert.equal(moved, 3);
  assert.ok(Math.abs(carry) < 1e-9);
});

test('quantizeStep: na HiDPI se zarovnává na fyzické pixely, funguje i záporně', () => {
  assert.deepEqual(quantizeStep(1.3, 2), { step: 1, carry: 1.3 - 1 });
  const q = quantizeStep(-1.8, 2);
  assert.equal(q.step, -1.5);
  assert.ok(Math.abs(q.carry - -0.3) < 1e-9);
  assert.equal(quantizeStep(5, 0).step, 5, 'neplatné dpr se bere jako 1');
});
