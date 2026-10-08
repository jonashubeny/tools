/**
 * Seeded pseudo-random numbers.
 *
 * Problem generation must be reproducible: the same (generator, seed, level) always yields
 * the same problem, which is what lets a past mistake be replayed exactly. Never use
 * Math.random() in core or content.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform integer in [min, max] excluding the listed values. */
  intExcept(min: number, max: number, except: readonly number[]): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Weighted pick; weights need not sum to 1. */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  bool(probability?: number): boolean;
  /** +1 or -1. */
  sign(): 1 | -1;
  /** A shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct items, in random order. */
  sample<T>(items: readonly T[], count: number): T[];
  /** An independent generator derived from this one. */
  fork(): Rng;
}

/** mulberry32 — small, fast, and good enough for picking coefficients. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string to an unsigned 32-bit integer; used to derive seeds from ids. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine several seed parts (numbers or strings) into one seed. */
export function mixSeed(...parts: (number | string)[]): number {
  let h = 0x9e3779b9;
  for (const part of parts) {
    const v = typeof part === 'number' ? part >>> 0 : hashString(part);
    h ^= v + 0x9e3779b9 + ((h << 6) >>> 0) + (h >>> 2);
    h >>>= 0;
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) throw new Error(`rng.int: empty range ${min}..${max}`);
      return min + Math.floor(next() * (max - min + 1));
    },
    intExcept(min, max, except) {
      const allowed: number[] = [];
      for (let v = min; v <= max; v++) if (!except.includes(v)) allowed.push(v);
      if (allowed.length === 0) throw new Error('rng.intExcept: nothing left to choose');
      return allowed[Math.floor(next() * allowed.length)]!;
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      return items[Math.floor(next() * items.length)]!;
    },
    weighted(items) {
      const total = items.reduce((sum, [, w]) => sum + w, 0);
      if (total <= 0) throw new Error('rng.weighted: weights must be positive');
      let r = next() * total;
      for (const [item, w] of items) {
        r -= w;
        if (r < 0) return item;
      }
      return items[items.length - 1]![0];
    },
    bool(probability = 0.5) {
      return next() < probability;
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    sample(items, count) {
      return rng.shuffle(items).slice(0, Math.min(count, items.length));
    },
    fork() {
      return createRng(Math.floor(next() * 4294967296));
    },
  };
  return rng;
}
