import { type FigureColor, type FigureSpec, type MathNode, evalReal, tryParse } from '@lemma/core';
import { type PointerEvent, type ReactNode, useMemo, useRef } from 'react';
import { useT } from '../app/i18n';
import { cn } from '../lib/cn';
import { niceTicks, scaleLinear, useWidth } from '../viz/base';

/**
 * Draws a FigureSpec: a coordinate plane with curves, points, segments and polygons.
 * The same component serves problem figures, lesson illustrations and the Math Lab, so a
 * figure authored once looks the same everywhere and follows the theme.
 */

const COLORS: Record<FigureColor, string> = {
  a: 'var(--series-1)',
  b: 'var(--series-2)',
  c: 'var(--series-3)',
  d: 'var(--series-4)',
  muted: 'var(--text-3)',
  good: 'var(--good)',
  bad: 'var(--critical)',
};

const colorOf = (color: FigureColor | undefined, fallback: FigureColor = 'a'): string => COLORS[color ?? fallback];

export interface FigureApi {
  /** Math coordinates → pixels. */
  px: (x: number) => number;
  py: (y: number) => number;
  width: number;
  height: number;
}

interface Props {
  spec: FigureSpec;
  className?: string;
  maxWidth?: number;
  /** Pointer position in math coordinates, for interactive tools. */
  onPointer?: (point: { x: number; y: number }, phase: 'down' | 'move' | 'up') => void;
  /** Extra SVG drawn on top, with access to the coordinate mapping. */
  overlay?: (api: FigureApi) => ReactNode;
  label?: string;
}

/** Sample a curve into SVG path data, lifting the pen at gaps and across asymptotes. */
function curvePath(
  node: MathNode,
  from: number,
  to: number,
  px: (x: number) => number,
  py: (y: number) => number,
  yMin: number,
  yMax: number,
  widthPx: number,
): string {
  const steps = Math.max(40, Math.min(900, Math.round(widthPx / 1.25)));
  const range = yMax - yMin;
  const lo = yMin - range * 2;
  const hi = yMax + range * 2;
  let d = '';
  let pen = false;
  let prev = Number.NaN;
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    let y: number;
    try {
      y = evalReal(node, { x });
    } catch {
      y = Number.NaN;
    }
    if (!Number.isFinite(y)) {
      pen = false;
      prev = Number.NaN;
      continue;
    }
    // A jump from far above the view to far below it (or back) is a pole, not a line.
    if (
      pen &&
      Number.isFinite(prev) &&
      ((prev > yMax + range && y < yMin - range) || (prev < yMin - range && y > yMax + range))
    )
      pen = false;
    const clamped = Math.max(lo, Math.min(hi, y));
    d += `${pen ? 'L' : 'M'}${px(x).toFixed(1)},${py(clamped).toFixed(1)}`;
    pen = true;
    prev = y;
  }
  return d;
}

const PI_LABELS: Record<string, string> = {
  '0': '0',
  '1': 'π/2',
  '2': 'π',
  '3': '3π/2',
  '4': '2π',
  '-1': '−π/2',
  '-2': '−π',
  '-3': '−3π/2',
  '-4': '−2π',
};

function piLabel(k: number): string {
  const known = PI_LABELS[String(k)];
  if (known) return known;
  if (k % 2 === 0) return `${k / 2}π`.replace('-', '−');
  return `${k}π/2`.replace('-', '−');
}

export function Figure({ spec, className, maxWidth = 560, onPointer, overlay, label }: Props) {
  const t = useT();
  const [ref, measured] = useWidth<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const limit = Math.min(maxWidth, spec.maxWidth ?? maxWidth);
  const width = Math.min(measured, limit);
  const height = Math.round(width * (spec.aspect ?? 0.62));
  const { xMin, xMax, yMin, yMax } = spec.view;
  const pad = spec.bare ? 8 : 6;
  const px = scaleLinear(xMin, xMax, pad, width - pad);
  const py = scaleLinear(yMin, yMax, height - pad, pad);

  const parsed = useMemo(
    () =>
      (spec.curves ?? []).map((curve) => {
        const result = tryParse(curve.expr, { decimalComma: false, variables: ['x'] });
        return result.ok ? result.node : null;
      }),
    [spec.curves],
  );

  const number = (value: number): string => {
    const rounded = Math.round(value * 1000) / 1000;
    const text = String(Object.is(rounded, -0) ? 0 : rounded);
    return (t.locale === 'cs' ? text.replace('.', ',') : text).replace('-', '−');
  };

  const xTicks = spec.piAxis
    ? (() => {
        const half = Math.PI / 2;
        const step = (xMax - xMin) / half > 12 ? 2 : 1;
        const out: { value: number; label: string }[] = [];
        for (let k = Math.ceil(xMin / half); k * half <= xMax + 1e-9; k++)
          if (k % step === 0) out.push({ value: k * half, label: piLabel(k) });
        return out;
      })()
    : niceTicks(xMin, xMax, Math.max(4, Math.round(width / 56))).map((value) => ({ value, label: number(value) }));
  const yTicks = niceTicks(yMin, yMax, Math.max(3, Math.round(height / 48))).map((value) => ({
    value,
    label: number(value),
  }));

  // The axes sit at zero when zero is in view, otherwise along the nearest edge.
  const axisX = Math.max(xMin, Math.min(xMax, 0));
  const axisY = Math.max(yMin, Math.min(yMax, 0));

  const toMath = (event: PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const box = event.currentTarget.getBoundingClientRect();
    const fx = (event.clientX - box.left - pad) / (width - 2 * pad);
    const fy = (event.clientY - box.top - pad) / (height - 2 * pad);
    return { x: xMin + fx * (xMax - xMin), y: yMax - fy * (yMax - yMin) };
  };

  return (
    <div ref={ref} className={cn('w-full', className)} style={{ maxWidth }}>
      {width > 0 && (
        <svg
          ref={svg}
          width={width}
          height={height}
          role="img"
          aria-label={label ?? t('Graf', 'Graph')}
          className={cn(
            'block rounded-lg border border-border bg-surface-1 select-none',
            onPointer && 'cursor-crosshair touch-none',
          )}
          onPointerDown={
            onPointer
              ? (event) => {
                  dragging.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onPointer(toMath(event), 'down');
                }
              : undefined
          }
          onPointerMove={onPointer ? (event) => dragging.current && onPointer(toMath(event), 'move') : undefined}
          onPointerUp={
            onPointer
              ? (event) => {
                  dragging.current = false;
                  onPointer(toMath(event), 'up');
                }
              : undefined
          }
        >
          {!spec.bare && (
            <g>
              {xTicks.map((tick) => (
                <line
                  key={`gx${tick.value}`}
                  x1={px(tick.value)}
                  x2={px(tick.value)}
                  y1={pad}
                  y2={height - pad}
                  stroke="var(--grid)"
                  strokeWidth={1}
                />
              ))}
              {yTicks.map((tick) => (
                <line
                  key={`gy${tick.value}`}
                  x1={pad}
                  x2={width - pad}
                  y1={py(tick.value)}
                  y2={py(tick.value)}
                  stroke="var(--grid)"
                  strokeWidth={1}
                />
              ))}
              <line x1={pad} x2={width - pad} y1={py(axisY)} y2={py(axisY)} stroke="var(--axis)" strokeWidth={1.25} />
              <line x1={px(axisX)} x2={px(axisX)} y1={pad} y2={height - pad} stroke="var(--axis)" strokeWidth={1.25} />
              {xTicks.map((tick) =>
                Math.abs(tick.value - axisX) < 1e-9 ||
                px(tick.value) < pad + 10 ||
                px(tick.value) > width - pad - 10 ? null : (
                  <text
                    key={`tx${tick.value}`}
                    x={px(tick.value)}
                    y={Math.min(height - pad - 3, py(axisY) + 13)}
                    textAnchor="middle"
                    fontSize={10.5}
                    fill="var(--text-3)"
                  >
                    {tick.label}
                  </text>
                ),
              )}
              {yTicks.map((tick) =>
                Math.abs(tick.value - axisY) < 1e-9 ||
                py(tick.value) < pad + 8 ||
                py(tick.value) > height - pad - 8 ? null : (
                  <text
                    key={`ty${tick.value}`}
                    x={Math.max(pad + 3, px(axisX) - 5)}
                    y={py(tick.value)}
                    dy="0.32em"
                    textAnchor={px(axisX) - 5 < pad + 24 ? 'start' : 'end'}
                    fontSize={10.5}
                    fill="var(--text-3)"
                  >
                    {tick.label}
                  </text>
                ),
              )}
              <text
                x={width - pad - 4}
                y={py(axisY) - 5}
                textAnchor="end"
                fontSize={11}
                fontStyle="italic"
                fill="var(--text-3)"
              >
                {spec.axisLabels?.[0] ?? 'x'}
              </text>
              <text x={px(axisX) + 6} y={pad + 10} fontSize={11} fontStyle="italic" fill="var(--text-3)">
                {spec.axisLabels?.[1] ?? 'y'}
              </text>
            </g>
          )}

          {(spec.polygons ?? []).map((polygon, i) => (
            <g key={`pg${i}`}>
              <polygon
                points={polygon.points.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ')}
                fill={colorOf(polygon.color)}
                fillOpacity={0.1}
                stroke={colorOf(polygon.color)}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {polygon.labels?.map((text, k) => {
                const point = polygon.points[k];
                if (!point) return null;
                // Push each vertex label away from the polygon's centre.
                const cx = polygon.points.reduce((sum, p) => sum + p[0], 0) / polygon.points.length;
                const cy = polygon.points.reduce((sum, p) => sum + p[1], 0) / polygon.points.length;
                const dx = px(point[0]) - px(cx);
                const dy = py(point[1]) - py(cy);
                const norm = Math.hypot(dx, dy) || 1;
                return (
                  <text
                    key={k}
                    x={px(point[0]) + (dx / norm) * 13}
                    y={py(point[1]) + (dy / norm) * 13}
                    dy="0.32em"
                    textAnchor="middle"
                    fontSize={13}
                    fontStyle="italic"
                    fill="var(--text)"
                  >
                    {text}
                  </text>
                );
              })}
            </g>
          ))}

          {(spec.vlines ?? []).map((line, i) => (
            <line
              key={`vl${i}`}
              x1={px(line.x)}
              x2={px(line.x)}
              y1={pad}
              y2={height - pad}
              stroke={colorOf(line.color, 'muted')}
              strokeWidth={1.5}
              strokeDasharray={line.dashed ? '5 4' : undefined}
            />
          ))}
          {(spec.hlines ?? []).map((line, i) => (
            <line
              key={`hl${i}`}
              x1={pad}
              x2={width - pad}
              y1={py(line.y)}
              y2={py(line.y)}
              stroke={colorOf(line.color, 'muted')}
              strokeWidth={1.5}
              strokeDasharray={line.dashed ? '5 4' : undefined}
            />
          ))}
          {(spec.circles ?? []).map((circle, i) => (
            <ellipse
              key={`ci${i}`}
              cx={px(circle.cx)}
              cy={py(circle.cy)}
              rx={Math.abs(px(circle.cx + circle.r) - px(circle.cx))}
              ry={Math.abs(py(circle.cy + circle.r) - py(circle.cy))}
              fill="none"
              stroke={colorOf(circle.color, 'muted')}
              strokeWidth={1.75}
              strokeDasharray={circle.dashed ? '5 4' : undefined}
            />
          ))}

          {(spec.curves ?? []).map((curve, i) => {
            const node = parsed[i];
            if (!node) return null;
            const from = Math.max(xMin, curve.domain?.[0] ?? xMin);
            const to = Math.min(xMax, curve.domain?.[1] ?? xMax);
            if (to <= from) return null;
            const fallback: FigureColor = (['a', 'b', 'c', 'd'] as const)[i % 4]!;
            return (
              <path
                key={`cu${i}`}
                d={curvePath(node, from, to, px, py, yMin, yMax, width)}
                fill="none"
                stroke={colorOf(curve.color, fallback)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={curve.dashed ? '6 5' : undefined}
              />
            );
          })}

          {(spec.segments ?? []).map((segment, i) => (
            <line
              key={`sg${i}`}
              x1={px(segment.from[0])}
              y1={py(segment.from[1])}
              x2={px(segment.to[0])}
              y2={py(segment.to[1])}
              stroke={colorOf(segment.color, 'muted')}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={segment.dashed ? '5 4' : undefined}
            />
          ))}

          {(spec.points ?? []).map((point, i) => (
            <g key={`pt${i}`}>
              <circle
                cx={px(point.x)}
                cy={py(point.y)}
                r={4.5}
                fill={point.hollow ? 'var(--surface-1)' : colorOf(point.color)}
                stroke={point.hollow ? colorOf(point.color) : 'var(--surface-1)'}
                strokeWidth={2}
              />
              {point.label && (
                <text
                  x={px(point.x) + 8}
                  y={py(point.y) - 8}
                  fontSize={12}
                  fill="var(--text)"
                  stroke="var(--surface-1)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {point.label}
                </text>
              )}
            </g>
          ))}

          {(spec.labels ?? []).map((item, i) => (
            <text
              key={`lb${i}`}
              x={px(item.x)}
              y={py(item.y)}
              dy="0.32em"
              textAnchor="middle"
              fontSize={12.5}
              fill={item.color ? colorOf(item.color) : 'var(--text)'}
              stroke="var(--surface-1)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {item.text}
            </text>
          ))}

          {overlay?.({ px, py, width, height })}
        </svg>
      )}
      {(spec.curves ?? []).filter((curve) => curve.label).length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {(spec.curves ?? []).map((curve, i) =>
            curve.label ? (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3.5 rounded-full"
                  style={{ background: colorOf(curve.color, (['a', 'b', 'c', 'd'] as const)[i % 4]!) }}
                />
                {curve.label}
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}
