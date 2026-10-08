import { describe, expect, it } from 'vitest';
import type { AnswerSpec } from '../src/answer/types';
import { verifyAnswer } from '../src/content/verify';
import { ancestorsOf, dependentsOf, findCycle, layoutGraph, topologicalOrder } from '../src/graph';
import { createRng, hashString, mixSeed } from '../src/rng';
import { addDays, dayRange, daysBetween, isDay, isValidTimeZone, studyDay, weekStart, weekdayIndex } from '../src/time';

describe('study days', () => {
  const prague = (iso: string): number => Date.parse(iso);

  it('assigns the small hours to the evening before', () => {
    // 23:30 and 01:30 local time belong to the same study day; 04:30 starts the next.
    expect(studyDay(prague('2026-10-07T21:30:00Z'), 'Europe/Prague')).toBe('2026-10-07');
    expect(studyDay(prague('2026-10-07T23:30:00Z'), 'Europe/Prague')).toBe('2026-10-07');
    expect(studyDay(prague('2026-10-08T02:30:00Z'), 'Europe/Prague')).toBe('2026-10-08');
  });

  it('follows the time zone, not UTC', () => {
    const instant = prague('2026-10-07T20:00:00Z');
    expect(studyDay(instant, 'Europe/Prague')).toBe('2026-10-07');
    expect(studyDay(instant, 'Asia/Tokyo')).toBe('2026-10-08');
    expect(studyDay(instant, 'America/Los_Angeles')).toBe('2026-10-07');
  });

  it('respects a custom rollover hour', () => {
    const justAfterMidnight = prague('2026-10-07T22:30:00Z'); // 00:30 in Prague
    expect(studyDay(justAfterMidnight, 'Europe/Prague', 0)).toBe('2026-10-08');
    expect(studyDay(justAfterMidnight, 'Europe/Prague', 4)).toBe('2026-10-07');
  });

  it('handles winter time as well as summer time', () => {
    // In January Prague is UTC+1: 04:30 local is 03:30 UTC.
    expect(studyDay(prague('2027-01-15T02:30:00Z'), 'Europe/Prague')).toBe('2027-01-14');
    expect(studyDay(prague('2027-01-15T03:30:00Z'), 'Europe/Prague')).toBe('2027-01-15');
  });

  it('does day arithmetic across months, years and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-07', '2026-10-12')).toBe(5);
    expect(daysBetween('2026-10-12', '2026-10-07')).toBe(-5);
    // Across the autumn clock change there are still exactly seven days in a week.
    expect(daysBetween('2026-10-22', '2026-10-29')).toBe(7);
    expect(dayRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('starts weeks on Monday', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-11')).toBe(6); // Sunday
    expect(weekStart('2026-10-07')).toBe('2026-10-05');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
  });

  it('validates days and time zones', () => {
    expect(isDay('2026-10-07')).toBe(true);
    expect(isDay('2026-10-7')).toBe(false);
    expect(isDay('yesterday')).toBe(false);
    expect(isDay(20261007)).toBe(false);
    expect(isValidTimeZone('Europe/Prague')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('seeded randomness', () => {
  it('repeats exactly for the same seed and differs for another', () => {
    const draw = (seed: number): number[] => {
      const rng = createRng(seed);
      return Array.from({ length: 8 }, () => rng.int(-50, 50));
    };
    expect(draw(42)).toEqual(draw(42));
    expect(draw(42)).not.toEqual(draw(43));
  });

  it('stays inside the requested ranges', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.int(-3, 4);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(4);
      expect(Number.isInteger(n)).toBe(true);
      const x = rng.float(2, 5);
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThan(5);
      expect(rng.intExcept(-2, 2, [0])).not.toBe(0);
    }
  });

  it('shuffles without losing or inventing items, and samples without repeats', () => {
    const rng = createRng(11);
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect([...rng.shuffle(items)].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7]); // the input is not modified
    const sample = rng.sample(items, 4);
    expect(new Set(sample).size).toBe(4);
    expect(() => rng.pick([])).toThrow();
  });

  it('honours weights', () => {
    const rng = createRng(3);
    let heavy = 0;
    for (let i = 0; i < 2000; i++)
      if (
        rng.weighted([
          ['a', 9],
          ['b', 1],
        ] as const) === 'a'
      )
        heavy++;
    expect(heavy).toBeGreaterThan(1650);
    expect(heavy).toBeLessThan(1950);
  });

  it('derives independent streams and stable hashes', () => {
    // A fork is reproducible from the parent's seed, and two forks of one parent differ.
    expect(createRng(5).fork().int(0, 1e6)).toBe(createRng(5).fork().int(0, 1e6));
    const parent = createRng(5);
    expect(parent.fork().int(0, 1e6)).not.toBe(parent.fork().int(0, 1e6));
    expect(hashString('quad.vertex')).toBe(hashString('quad.vertex'));
    expect(hashString('quad.vertex')).not.toBe(hashString('quad.graph'));
    expect(mixSeed(1, 2)).not.toBe(mixSeed(2, 1));
  });
});

describe('prerequisite graph', () => {
  const nodes = [
    { id: 'a', prereqs: [] },
    { id: 'b', prereqs: ['a'] },
    { id: 'c', prereqs: ['a'] },
    { id: 'd', prereqs: ['b', 'c'] },
    { id: 'e', prereqs: ['d', 'missing'] },
  ];

  it('finds cycles, and none where there are none', () => {
    expect(findCycle(nodes)).toBeNull();
    const cycle = findCycle([
      { id: 'x', prereqs: ['z'] },
      { id: 'y', prereqs: ['x'] },
      { id: 'z', prereqs: ['y'] },
    ]);
    expect(cycle).not.toBeNull();
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
    expect(findCycle([{ id: 'self', prereqs: ['self'] }])).toEqual(['self', 'self']);
  });

  it('orders prerequisites before what needs them', () => {
    const order = topologicalOrder([...nodes].reverse());
    for (const node of nodes)
      for (const pre of node.prereqs)
        if (pre !== 'missing') expect(order.indexOf(pre)).toBeLessThan(order.indexOf(node.id));
    expect(order).toHaveLength(nodes.length);
  });

  it('collects everything a node rests on, and what rests directly on it', () => {
    expect([...ancestorsOf(nodes, 'd')].sort()).toEqual(['a', 'b', 'c']);
    expect([...ancestorsOf(nodes, 'e')].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(ancestorsOf(nodes, 'a').size).toBe(0);
    expect(dependentsOf(nodes, 'a')).toEqual(['b', 'c']);
  });
});

describe('graph layout', () => {
  const options = { nodeWidth: 100, nodeHeight: 40, gapX: 10, gapY: 30, laneGap: 20, laneOrder: ['left', 'right'] };
  const nodes = [
    { id: 'a', prereqs: [], lane: 'left' },
    { id: 'b', prereqs: ['a'], lane: 'left' },
    { id: 'c', prereqs: ['a'], lane: 'left' },
    { id: 'd', prereqs: ['a'], lane: 'left' },
    { id: 'r', prereqs: ['b'], lane: 'right' },
    { id: 's', prereqs: ['r', 'c'], lane: 'right' },
  ];
  const overlaps = (layout: ReturnType<typeof layoutGraph>): boolean =>
    layout.nodes.some((p, i) =>
      layout.nodes.some(
        (q, j) => i < j && Math.abs(p.x - q.x) < options.nodeWidth && Math.abs(p.y - q.y) < options.nodeHeight,
      ),
    );

  it('puts every node below all of its prerequisites', () => {
    for (const maxPerRow of [undefined, 1, 2]) {
      const layout = layoutGraph(nodes, { ...options, maxPerRow });
      const at = new Map(layout.nodes.map((node) => [node.id, node]));
      for (const node of nodes)
        for (const pre of node.prereqs)
          expect(at.get(pre)!.y + options.nodeHeight, `${pre} above ${node.id}`).toBeLessThanOrEqual(
            at.get(node.id)!.y,
          );
      expect(overlaps(layout)).toBe(false);
      for (const placed of layout.nodes) {
        expect(placed.x).toBeGreaterThanOrEqual(0);
        expect(placed.x + options.nodeWidth).toBeLessThanOrEqual(layout.width + 1e-9);
        expect(placed.y + options.nodeHeight).toBeLessThanOrEqual(layout.height + 1e-9);
      }
    }
  });

  it('keeps nodes inside their lane, and lanes apart', () => {
    const layout = layoutGraph(nodes, options);
    const [left, right] = layout.lanes as [(typeof layout.lanes)[number], (typeof layout.lanes)[number]];
    expect(left.id).toBe('left');
    expect(right.x).toBe(left.x + left.width + options.laneGap);
    for (const placed of layout.nodes) {
      const lane = layout.lanes.find((l) => l.id === placed.lane)!;
      expect(placed.x).toBeGreaterThanOrEqual(lane.x);
      expect(placed.x + options.nodeWidth).toBeLessThanOrEqual(lane.x + lane.width + 1e-9);
    }
  });

  it('wraps a crowded depth instead of growing sideways', () => {
    const wide = layoutGraph(nodes, options);
    const narrow = layoutGraph(nodes, { ...options, maxPerRow: 1, rowGap: 6 });
    // Three nodes share depth 1 in the left lane: side by side, or stacked.
    expect(wide.lanes[0]!.width).toBe(3 * 100 + 2 * 10);
    expect(narrow.lanes[0]!.width).toBe(100);
    expect(narrow.width).toBeLessThan(wide.width);
    expect(narrow.height).toBeGreaterThan(wide.height);
    const stacked = narrow.nodes.filter((node) => ['b', 'c', 'd'].includes(node.id)).map((node) => node.y);
    expect(stacked).toEqual([70, 116, 162]);
    // The next depth starts below the whole stack.
    expect(narrow.nodes.find((node) => node.id === 'r')!.y).toBe(162 + 40 + 30);
  });

  it('drops empty lanes and survives an empty graph', () => {
    expect(
      layoutGraph(
        nodes.filter((node) => node.lane === 'left'),
        options,
      ).lanes.map((lane) => lane.id),
    ).toEqual(['left']);
    expect(layoutGraph([], options)).toEqual({ nodes: [], lanes: [], width: 0, height: 0 });
  });

  it('is deterministic', () => {
    expect(layoutGraph(nodes, { ...options, maxPerRow: 2 })).toEqual(layoutGraph(nodes, { ...options, maxPerRow: 2 }));
  });
});

describe('the answer oracle and roots the graph only touches', () => {
  const set = (...values: string[]): AnswerSpec => ({ kind: 'set', values });
  const twoPi: [number, number] = [0, 6.2831];

  it('finds a zero where the function touches the axis without crossing it', () => {
    // 2 sin²x − 3 sin x + 1 = 0: sin x = 1/2 (two crossings) or sin x = 1 (a touch at π/2).
    const verify = [{ kind: 'roots' as const, expr: '2*sin(x)^2 - 3*sin(x) + 1', range: twoPi }];
    expect(verifyAnswer(set('pi/6', 'pi/2', '5*pi/6'), verify)).toEqual([]);
    const omitted = verifyAnswer(set('pi/6', '5*pi/6'), verify);
    expect(omitted).toHaveLength(1);
    expect(omitted[0]).toMatch(/omits/);
  });

  it('still rejects values that are not zeros, and is not fooled by near misses', () => {
    const verify = [{ kind: 'roots' as const, expr: 'sin(x) - 1', range: twoPi }];
    expect(verifyAnswer(set('pi/2'), verify)).toEqual([]);
    expect(verifyAnswer(set('pi/3'), verify)[0]).toMatch(/not a zero/);
    // sin x − 1.001 comes within a thousandth of zero but has no zero at all.
    expect(
      verifyAnswer({ kind: 'set', values: [] }, [{ kind: 'roots', expr: 'sin(x) - 1.001', range: twoPi }]),
    ).toEqual([]);
    // An irrational double root of a polynomial.
    expect(verifyAnswer(set('sqrt(2)'), [{ kind: 'roots', expr: '(x - sqrt(2))^2' }])).toEqual([]);
    expect(verifyAnswer({ kind: 'set', values: [] }, [{ kind: 'roots', expr: '(x - sqrt(2))^2' }])[0]).toMatch(/omits/);
  });

  it('finds the range of a function whose extremes lie between the sample points', () => {
    // 3 sin 2x − 1 peaks at x = π/4, which no rational grid contains.
    const verify = [{ kind: 'range' as const, expr: '3*sin(2*x) - 1', over: [0, 40] as [number, number] }];
    expect(verifyAnswer({ kind: 'interval', value: '<-4; 2>' }, verify)).toEqual([]);
    expect(verifyAnswer({ kind: 'interval', value: '<-4; 3>' }, verify)[0]).toMatch(/largest value/);
    expect(verifyAnswer({ kind: 'interval', value: '<-3; 2>' }, verify)[0]).toMatch(/outside the answer/);
    // A vertex on the grid is still an exact endpoint.
    expect(verifyAnswer({ kind: 'interval', value: '<7; inf)' }, [{ kind: 'range', expr: 'x^2+6*x+16' }])).toEqual([]);
  });
});
