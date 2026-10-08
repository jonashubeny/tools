import { L, type FigureSpec } from '@lemma/core';

/**
 * Triangles for the trigonometry and planimetry generators.
 *
 * A triangle is always built in coordinates and measured there, so the numbers a problem
 * quotes never depend on the formula the problem is about. Standard labelling: side a
 * lies opposite vertex A, and the angles at A, B, C are α, β, γ (in degrees).
 */

type Point = [number, number];

export interface Triangle {
  A: Point;
  B: Point;
  C: Point;
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const dist = (p: Point, q: Point): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** The angle at `vertex` between the rays to p and q, in degrees. */
function angleAt(vertex: Point, p: Point, q: Point): number {
  const [ux, uy] = [p[0] - vertex[0], p[1] - vertex[1]];
  const [vx, vy] = [q[0] - vertex[0], q[1] - vertex[1]];
  return (Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) * 180) / Math.PI;
}

function measure(A: Point, B: Point, C: Point): Triangle {
  return {
    A,
    B,
    C,
    a: dist(B, C),
    b: dist(C, A),
    c: dist(A, B),
    alpha: angleAt(A, B, C),
    beta: angleAt(B, C, A),
    gamma: angleAt(C, A, B),
  };
}

/** Two sides and the angle between them: a = |BC|, b = |CA|, γ at C. */
export function triangleSAS(a: number, b: number, gamma: number): Triangle {
  const C: Point = [0, 0];
  const B: Point = [a, 0];
  const A: Point = [b * Math.cos(toRad(gamma)), b * Math.sin(toRad(gamma))];
  return measure(A, B, C);
}

/** A side and the two angles on it: c = |AB|, α at A, β at B. The rays from A and B are intersected. */
export function triangleASA(c: number, alpha: number, beta: number): Triangle {
  const A: Point = [0, 0];
  const B: Point = [c, 0];
  // A + s·(cos α, sin α) = B + t·(−cos β, sin β), solved by Cramer's rule.
  const [ux, uy] = [Math.cos(toRad(alpha)), Math.sin(toRad(alpha))];
  const [vx, vy] = [-Math.cos(toRad(beta)), Math.sin(toRad(beta))];
  const det = ux * -vy - uy * -vx;
  const s = (c * -vy) / det;
  return measure(A, B, [s * ux, s * uy]);
}

/** Three sides (which must satisfy the triangle inequality), by intersecting two circles. */
export function triangleSSS(a: number, b: number, c: number): Triangle {
  const A: Point = [0, 0];
  const B: Point = [c, 0];
  const x = (b * b - a * a + c * c) / (2 * c);
  return measure(A, B, [x, Math.sqrt(Math.max(0, b * b - x * x))]);
}

/** Throw unless two numbers agree: a generator's formula checked against the construction. */
export function agree(formula: number, measured: number, what: string): void {
  if (!(Math.abs(formula - measured) < 1e-6 * Math.max(1, Math.abs(measured))))
    throw new Error(`${what}: the formula gives ${formula}, the construction ${measured}`);
}

export interface TriangleLabels {
  /** Text along each side, e.g. { a: 'a = 7' }. */
  sides?: Partial<Record<'a' | 'b' | 'c', string>>;
  /** Text inside each corner, e.g. { C: '60°' }. */
  angles?: Partial<Record<'A' | 'B' | 'C', string>>;
  /** Vertex names; A, B, C by default. */
  vertices?: [string, string, string];
}

/** A drawing of the triangle with its givens written in. Not to be relied on for measuring. */
export function triangleFigure(t: Triangle, labels: TriangleLabels = {}): FigureSpec {
  const points = [t.A, t.B, t.C];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const pad = Math.max(w, h) * 0.22;
  const centre: Point = [(t.A[0] + t.B[0] + t.C[0]) / 3, (t.A[1] + t.B[1] + t.C[1]) / 3];
  const out: NonNullable<FigureSpec['labels']> = [];
  const sides: Record<'a' | 'b' | 'c', [Point, Point]> = { a: [t.B, t.C], b: [t.C, t.A], c: [t.A, t.B] };
  for (const key of ['a', 'b', 'c'] as const) {
    const text = labels.sides?.[key];
    if (!text) continue;
    const [p, q] = sides[key];
    const mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    // Away from the centre, so the text sits outside the triangle.
    const away = Math.hypot(mid[0] - centre[0], mid[1] - centre[1]) || 1;
    out.push({
      x: mid[0] + ((mid[0] - centre[0]) / away) * pad * 0.55,
      y: mid[1] + ((mid[1] - centre[1]) / away) * pad * 0.55,
      text,
    });
  }
  const corners: Record<'A' | 'B' | 'C', Point> = { A: t.A, B: t.B, C: t.C };
  for (const key of ['A', 'B', 'C'] as const) {
    const text = labels.angles?.[key];
    if (!text) continue;
    const p = corners[key];
    out.push({ x: p[0] + (centre[0] - p[0]) * 0.3, y: p[1] + (centre[1] - p[1]) * 0.3, text, color: 'muted' });
  }
  return {
    view: {
      xMin: Math.min(...xs) - pad,
      xMax: Math.max(...xs) + pad,
      yMin: Math.min(...ys) - pad,
      yMax: Math.max(...ys) + pad,
    },
    aspect: Math.min(0.85, Math.max(0.4, (h + 2 * pad) / (w + 2 * pad))),
    bare: true,
    polygons: [{ points, color: 'a', labels: labels.vertices ?? ['A', 'B', 'C'] }],
    labels: out,
  };
}

/** A number rounded to `digits` places, as parser input and as bilingual TeX (decimal comma in Czech). */
export function rounded(value: number, digits = 1): { input: string; tex: L } {
  const text = value.toFixed(digits);
  return { input: text, tex: L(text.replace('.', '{,}'), text) };
}

export const ROUND_ONE = L('Zaokrouhlete na jedno desetinné místo.', 'Round to one decimal place.');
