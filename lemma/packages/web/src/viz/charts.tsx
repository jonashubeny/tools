import type { MasteryLevel } from '@lemma/core';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useMemo, useState } from 'react';
import { LEVEL_NAMES } from '../app/labels';
import { useT } from '../app/i18n';
import { cn } from '../lib/cn';
import {
  ChartFrame,
  type LegendItem,
  type TableData,
  Tip,
  TipRow,
  type TipState,
  niceTicks,
  scaleLinear,
  useWidth,
} from './base';

// ---------------------------------------------------------------------------- line chart

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  /** One value per x position; null where there is no data (the line breaks there). */
  values: (number | null)[];
}

interface LineChartProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Labels of the x positions, oldest first. */
  x: string[];
  series: LineSeries[];
  format: (value: number) => string;
  height?: number;
  /** Fix the y range (e.g. 0–1 for rates); otherwise it fits the data from zero. */
  yMin?: number;
  yMax?: number;
  className?: string;
  xLabel?: string;
}

/** Trend over time. One y axis; a crosshair finds the x and lists every series there. */
export function LineChart({
  title,
  subtitle,
  x,
  series,
  format,
  height = 180,
  yMin,
  yMax,
  className,
  xLabel,
}: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const t = useT();

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const dataMax = all.length > 0 ? Math.max(...all) : 1;
  const lo = yMin ?? 0;
  const hi = yMax ?? (dataMax <= lo ? lo + 1 : dataMax);
  const ticks = niceTicks(lo, hi, 3);
  const top = Math.max(hi, ticks[ticks.length - 1] ?? hi);

  const pad = { left: 44, right: 18, top: 10, bottom: 24 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const px = scaleLinear(0, Math.max(1, x.length - 1), pad.left, pad.left + innerW);
  const py = scaleLinear(lo, top, pad.top + innerH, pad.top);

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = '';
        let pen = false;
        s.values.forEach((value, i) => {
          if (value === null) {
            pen = false;
            return;
          }
          d += `${pen ? 'L' : 'M'}${px(i).toFixed(1)},${py(value).toFixed(1)}`;
          pen = true;
        });
        return d;
      }),
    // px and py are derived from exactly these inputs.
    [series, width, lo, top, height, x.length],
  );

  const lastIndex = (values: (number | null)[]): number => {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
    return -1;
  };

  const move = (event: PointerEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - pad.left) / innerW;
    setActive(Math.max(0, Math.min(x.length - 1, Math.round(ratio * (x.length - 1)))));
  };
  const key = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setActive((current) =>
      Math.max(0, Math.min(x.length - 1, (current ?? x.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))),
    );
  };

  const every = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor(innerW / 64))));
  const table: TableData = {
    columns: [xLabel ?? t('Období', 'Period'), ...series.map((s) => s.label)],
    rows: x.map((label, i) => [
      label,
      ...series.map((s) => (s.values[i] === null || s.values[i] === undefined ? '—' : format(s.values[i]!))),
    ]),
  };
  const legend: LegendItem[] = series.map((s) => ({ label: s.label, color: s.color, mark: 'line' }));
  const single = series.length === 1 ? series[0]! : null;

  const tip: TipState | null =
    active === null
      ? null
      : {
          x: px(active),
          y: pad.top,
          content: (
            <div className="space-y-0.5">
              <div className="mono-label">{x[active]}</div>
              {series.map((s) => (
                <TipRow
                  key={s.id}
                  color={s.color}
                  value={s.values[active] === null || s.values[active] === undefined ? '—' : format(s.values[active]!)}
                  label={s.label}
                />
              ))}
            </div>
          ),
        };

  return (
    <ChartFrame title={title} subtitle={subtitle} legend={legend} table={table} className={className}>
      <div
        ref={ref}
        className="relative"
        tabIndex={0}
        onKeyDown={key}
        onBlur={() => setActive(null)}
        aria-label={typeof title === 'string' ? title : undefined}
        role="group"
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            onPointerMove={move}
            onPointerLeave={() => setActive(null)}
            className="block touch-pan-y"
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={pad.left + innerW}
                  y1={py(tick)}
                  y2={py(tick)}
                  stroke="var(--grid)"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={py(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--text-3)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {format(tick)}
                </text>
              </g>
            ))}
            <line x1={pad.left} x2={pad.left + innerW} y1={py(lo)} y2={py(lo)} stroke="var(--axis)" strokeWidth={1} />
            {x.map((label, i) =>
              i % every === 0 || i === x.length - 1 ? (
                <text
                  key={i}
                  x={px(i)}
                  y={height - 6}
                  textAnchor={i === x.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                  fontSize={11}
                  fill="var(--text-3)"
                >
                  {i === x.length - 1 && i % every !== 0 && px(i) - px(i - (i % every)) < 48 ? '' : label}
                </text>
              ) : null,
            )}
            {single && paths[0] && lastIndex(single.values) >= 0 && (
              <path
                d={`${paths[0]}L${px(lastIndex(single.values)).toFixed(1)},${py(lo)}L${px(single.values.findIndex((v) => v !== null)).toFixed(1)},${py(lo)}Z`}
                fill={single.color}
                opacity={0.1}
              />
            )}
            {series.map((s, i) => (
              <path
                key={s.id}
                d={paths[i]}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {series.map((s) => {
              const last = lastIndex(s.values);
              if (last < 0) return null;
              return (
                <circle
                  key={s.id}
                  cx={px(last)}
                  cy={py(s.values[last]!)}
                  r={4}
                  fill={s.color}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                />
              );
            })}
            {active !== null && (
              <g pointerEvents="none">
                <line
                  x1={px(active)}
                  x2={px(active)}
                  y1={pad.top}
                  y2={pad.top + innerH}
                  stroke="var(--axis)"
                  strokeWidth={1}
                />
                {series.map((s) =>
                  s.values[active] === null || s.values[active] === undefined ? null : (
                    <circle
                      key={s.id}
                      cx={px(active)}
                      cy={py(s.values[active]!)}
                      r={4}
                      fill={s.color}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            )}
          </svg>
        )}
        <Tip tip={tip} containerWidth={width} />
      </div>
    </ChartFrame>
  );
}

// ----------------------------------------------------------------------- stacked columns

interface StackedColumnsProps {
  title: ReactNode;
  subtitle?: ReactNode;
  x: string[];
  series: LineSeries[];
  format: (value: number) => string;
  height?: number;
  totalLabel?: string;
  className?: string;
}

/** Parts of a whole per period. Segments are separated by a gap of surface, not a stroke. */
export function StackedColumns({
  title,
  subtitle,
  x,
  series,
  format,
  height = 180,
  totalLabel,
  className,
}: StackedColumnsProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const t = useT();

  const totals = x.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max = Math.max(...totals) > 0 ? Math.max(...totals) : 1;
  const ticks = niceTicks(0, max, 3);
  const top = Math.max(max, ticks[ticks.length - 1] ?? max);

  const pad = { left: 36, right: 8, top: 10, bottom: 24 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const band = innerW / Math.max(1, x.length);
  const barW = Math.max(3, Math.min(24, band - 4));
  const py = scaleLinear(0, top, pad.top + innerH, pad.top);
  const GAP = 2;
  const every = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor(innerW / 64))));

  const table: TableData = {
    columns: [t('Období', 'Period'), ...series.map((s) => s.label), totalLabel ?? t('Celkem', 'Total')],
    rows: x.map((label, i) => [label, ...series.map((s) => format(s.values[i] ?? 0)), format(totals[i] ?? 0)]),
  };

  const tip: TipState | null =
    active === null
      ? null
      : {
          x: pad.left + band * active + band / 2,
          y: pad.top,
          content: (
            <div className="space-y-0.5">
              <div className="mono-label">{x[active]}</div>
              {series.map((s) => (
                <TipRow key={s.id} color={s.color} value={format(s.values[active] ?? 0)} label={s.label} />
              ))}
            </div>
          ),
        };

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={series.map((s) => ({ label: s.label, color: s.color, mark: 'rect' }))}
      table={table}
      className={className}
    >
      <div
        ref={ref}
        className="relative"
        tabIndex={0}
        role="group"
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          setActive((current) =>
            Math.max(0, Math.min(x.length - 1, (current ?? x.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))),
          );
        }}
      >
        {width > 0 && (
          <svg width={width} height={height} className="block" onPointerLeave={() => setActive(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={pad.left + innerW}
                  y1={py(tick)}
                  y2={py(tick)}
                  stroke="var(--grid)"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={py(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--text-3)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {format(tick)}
                </text>
              </g>
            ))}
            {x.map((label, i) => {
              const cx = pad.left + band * i + band / 2;
              let base = 0;
              const present = series.filter((s) => (s.values[i] ?? 0) > 0);
              return (
                <g key={i} opacity={active === null || active === i ? 1 : 0.55}>
                  {present.map((s, k) => {
                    const value = s.values[i] ?? 0;
                    const y0 = py(base);
                    const y1 = py(base + value);
                    base += value;
                    const isTop = k === present.length - 1;
                    const h = Math.max(1, y0 - y1 - (k > 0 ? GAP : 0));
                    const yTop = y0 - (k > 0 ? GAP : 0) - h;
                    const r = isTop ? Math.min(4, barW / 2, h) : 0;
                    const left = cx - barW / 2;
                    // Rounded at the data end only; square where it meets the baseline or the gap.
                    const d = `M${left},${yTop + h}V${yTop + r}Q${left},${yTop} ${left + r},${yTop}H${left + barW - r}Q${left + barW},${yTop} ${left + barW},${yTop + r}V${yTop + h}Z`;
                    return <path key={s.id} d={d} fill={s.color} />;
                  })}
                  {/* The hit target is the whole band, not just the painted column. */}
                  <rect
                    x={pad.left + band * i}
                    y={pad.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                  />
                  {(i % every === 0 || i === x.length - 1) && (
                    <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--text-3)">
                      {i === x.length - 1 && i % every !== 0 ? '' : label}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={pad.left} x2={pad.left + innerW} y1={py(0)} y2={py(0)} stroke="var(--axis)" strokeWidth={1} />
          </svg>
        )}
        <Tip tip={tip} containerWidth={width} />
      </div>
    </ChartFrame>
  );
}

// ------------------------------------------------------------------------------ bar list

export interface BarRow {
  id: string;
  label: ReactNode;
  value: number;
  /** Shown at the tip of the bar. */
  display: string;
  note?: ReactNode;
}

/**
 * Magnitudes of unordered categories: one hue for every bar (length already encodes the
 * value), the number at the tip, so nothing depends on hovering.
 */
export function BarList({
  rows,
  max,
  color = 'var(--series-1)',
  onSelect,
  selected,
  labelWidth = 150,
}: {
  rows: BarRow[];
  max?: number;
  color?: string;
  onSelect?: (id: string) => void;
  selected?: string | null;
  labelWidth?: number;
}) {
  const top = max ?? Math.max(1e-9, ...rows.map((row) => row.value));
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const inner = (
          <>
            <span className="shrink-0 truncate text-[13px] text-ink-2" style={{ width: labelWidth }}>
              {row.label}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-2.5 rounded-r-[4px]"
                style={{
                  width: `${Math.max(row.value > 0 ? 1 : 0, (row.value / top) * 100)}%`,
                  background: color,
                  minWidth: row.value > 0 ? 3 : 0,
                }}
              />
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink">{row.display}</span>
              {row.note && <span className="shrink-0 text-xs text-ink-3">{row.note}</span>}
            </span>
          </>
        );
        return (
          <li key={row.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                aria-pressed={selected === row.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-2',
                  selected === row.id && 'bg-surface-2',
                )}
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1.5 py-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------------------ dumbbell

export interface DumbbellRow {
  id: string;
  label: string;
  before: number | null;
  after: number | null;
}

/** Before and after per item: one hue, two shades, joined by a line. */
export function Dumbbell({
  title,
  subtitle,
  rows,
  format,
  beforeLabel,
  afterLabel,
  max,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: DumbbellRow[];
  format: (value: number) => string;
  beforeLabel: string;
  afterLabel: string;
  max?: number;
}) {
  const t = useT();
  const top = max ?? Math.max(1e-9, ...rows.flatMap((row) => [row.before ?? 0, row.after ?? 0])) * 1.08;
  const pos = (value: number): string => `${Math.max(0, Math.min(100, (value / top) * 100))}%`;
  const table: TableData = {
    columns: ['', beforeLabel, afterLabel],
    rows: rows.map((row) => [
      row.label,
      row.before === null ? '—' : format(row.before),
      row.after === null ? '—' : format(row.after),
    ]),
  };
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      table={table}
      legend={[
        { label: beforeLabel, color: 'var(--series-muted)', mark: 'dot' },
        { label: afterLabel, color: 'var(--series-1)', mark: 'dot' },
      ]}
    >
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate text-[13px] text-ink-2">{row.label}</span>
            <span
              className="relative h-5 min-w-0 flex-1"
              title={`${beforeLabel}: ${row.before === null ? '—' : format(row.before)} · ${afterLabel}: ${row.after === null ? '—' : format(row.after)}`}
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-grid" />
              {row.before !== null && row.after !== null && (
                <span
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                  style={{
                    left: pos(Math.min(row.before, row.after)),
                    width: `calc(${pos(Math.max(row.before, row.after))} - ${pos(Math.min(row.before, row.after))})`,
                    background: 'var(--series-muted)',
                  }}
                />
              )}
              {row.before !== null && (
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: pos(row.before),
                    background: 'var(--series-muted)',
                    boxShadow: '0 0 0 2px var(--surface-1)',
                  }}
                />
              )}
              {row.after !== null && (
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: pos(row.after),
                    background: 'var(--series-1)',
                    boxShadow: '0 0 0 2px var(--surface-1)',
                  }}
                />
              )}
            </span>
            <span className="w-24 shrink-0 text-right text-[13px] tabular-nums text-ink-2">
              {row.before === null ? '—' : format(row.before)} <span aria-hidden>→</span>{' '}
              <span className="font-medium text-ink">{row.after === null ? '—' : format(row.after)}</span>
              <span className="sr-only">{t(' (dříve → nyní)', ' (before → now)')}</span>
            </span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}

// ----------------------------------------------------------------------------- sparkline

/** The shape of a short series, no axes: context for a number, not a chart to read values from. */
export function Sparkline({
  values,
  width = 96,
  height = 26,
  label,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  label: string;
}) {
  const points = values
    .map((value, i) => ({ value, i }))
    .filter((p): p is { value: number; i: number } => p.value !== null);
  if (points.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden />;
  const lo = Math.min(...points.map((p) => p.value));
  const hi = Math.max(...points.map((p) => p.value));
  const px = scaleLinear(0, values.length - 1, 3, width - 5);
  const py = scaleLinear(lo, hi === lo ? lo + 1 : hi, height - 4, 4);
  const last = points[points.length - 1]!;
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="shrink-0">
      <polyline
        points={points.map((p) => `${px(p.i).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--series-muted)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={px(last.i)}
        cy={py(last.value)}
        r={3}
        fill="var(--accent)"
        stroke="var(--surface-1)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

// -------------------------------------------------------------------------------- levels

/** Mastery as five steps of one hue. The level's name is always given in words alongside. */
export function LevelBar({
  level,
  size = 'md',
  showName = false,
  className,
}: {
  level: MasteryLevel;
  size?: 'sm' | 'md';
  showName?: boolean;
  className?: string;
}) {
  const t = useT();
  const name = t(LEVEL_NAMES[level]);
  const w = size === 'sm' ? 5 : 8;
  const h = size === 'sm' ? 8 : 10;
  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      title={`${t('úroveň', 'level')} ${level}/5 · ${name}`}
    >
      <span
        className="inline-flex gap-[2px]"
        role="img"
        aria-label={`${t('úroveň', 'level')} ${level} ${t('z', 'of')} 5: ${name}`}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className="rounded-[2px]"
            style={{ width: w, height: h, background: step <= level ? `var(--level-${level})` : 'var(--level-0)' }}
          />
        ))}
      </span>
      {showName && <span className="text-[13px] text-ink-2">{name}</span>}
    </span>
  );
}

/** How many skills sit at each level: one bar, ordered, with the counts spelled out. */
export function LevelDistribution({ counts }: { counts: Record<MasteryLevel, number> }) {
  const t = useT();
  const levels: MasteryLevel[] = [0, 1, 2, 3, 4, 5];
  const total = levels.reduce<number>((sum, level) => sum + (counts[level] ?? 0), 0);
  if (total === 0) return null;
  return (
    <div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]"
        role="img"
        aria-label={t('Rozložení dovedností podle úrovně', 'Skills by level')}
      >
        {levels.map((level) =>
          (counts[level] ?? 0) > 0 ? (
            <span
              key={level}
              style={{ flexGrow: counts[level], flexBasis: 0, background: `var(--level-${level})` }}
              title={`${t(LEVEL_NAMES[level])}: ${counts[level]}`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-2 sm:grid-cols-3">
        {levels.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: `var(--level-${level})` }}
            />
            <span className="font-medium tabular-nums text-ink">{counts[level] ?? 0}</span>
            {t(LEVEL_NAMES[level])}
          </li>
        ))}
      </ul>
    </div>
  );
}
