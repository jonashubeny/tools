import { Table as TableIcon } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useT } from '../app/i18n';
import { cn } from '../lib/cn';

/**
 * Shared chart furniture. The rules the charts follow (docs/architecture.md §9):
 * colour encodes one thing per chart; two or more series always have a legend; values
 * are reachable without hovering through the table view; text wears ink, never the
 * series colour; grid and axes are solid hairlines.
 */

/** The rendered width of an element, tracked as it resizes. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A width of zero means the element is momentarily not laid out (a hidden ancestor, a
    // viewport being swapped). Keeping the last real width avoids tearing the chart down.
    const update = (): void => {
      const next = Math.floor(element.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export const scaleLinear =
  (d0: number, d1: number, r0: number, r1: number) =>
  (value: number): number =>
    d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);

/** Round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max === min) return [min];
  const rough = (max - min) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= rough) ?? power * 10;
  const start = Math.ceil(min / unit - 1e-9) * unit;
  const ticks: number[] = [];
  // "+ 0" turns a negative zero into a plain one, which would otherwise be printed as "-0".
  for (let value = start; value <= max + unit * 1e-9; value += unit) ticks.push(Math.round(value / unit) * unit + 0);
  return ticks;
}

export interface LegendItem {
  label: string;
  color: string;
  /** How the series is drawn, so the key mirrors the mark. */
  mark?: 'rect' | 'line' | 'dot';
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <LegendKey color={item.color} mark={item.mark ?? 'rect'} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function LegendKey({ color, mark = 'rect' }: { color: string; mark?: 'rect' | 'line' | 'dot' }) {
  if (mark === 'line')
    return <span aria-hidden className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: color }} />;
  if (mark === 'dot')
    return <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
  return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
}

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

export function DataTable({ data, className }: { data: TableData; className?: string }) {
  return (
    <div className={cn('max-h-72 overflow-auto rounded-lg border border-border', className)}>
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-surface-2 text-ink-2">
          <tr>
            {data.columns.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={cn('px-3 py-1.5 font-medium whitespace-nowrap', i > 0 && 'text-right')}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, r) => (
            <tr key={r} className="border-t border-border">
              {row.map((cell, i) => (
                <td key={i} className={cn('px-3 py-1.5', i > 0 && 'text-right')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The container every chart sits in: a title that says what is plotted, an optional
 * legend, and a switch to the same data as a table.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
  controls,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: TableData;
  children: ReactNode;
  className?: string;
  controls?: ReactNode;
}) {
  const t = useT();
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="mt-0.5 text-[13px] text-ink-2">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {controls}
          {table && (
            <button
              type="button"
              onClick={() => setAsTable((value) => !value)}
              aria-pressed={asTable}
              title={asTable ? t('Zobrazit graf', 'Show the chart') : t('Zobrazit jako tabulku', 'Show as a table')}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
                asTable
                  ? 'border-border-strong bg-surface-3 text-ink'
                  : 'border-border text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              <TableIcon size={13} aria-hidden />
              {t('Tabulka', 'Table')}
            </button>
          )}
        </div>
      </figcaption>
      {asTable && table ? (
        <DataTable data={table} />
      ) : (
        <>
          {legend && legend.length > 1 && <Legend items={legend} className="mb-2" />}
          {children}
        </>
      )}
    </figure>
  );
}

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * A tooltip positioned inside a relatively positioned parent. It flips to stay inside
 * the chart and never takes pointer events, so it cannot steal the hover it reports on.
 */
export function Tip({ tip, containerWidth }: { tip: TipState | null; containerWidth: number }) {
  if (!tip) return null;
  const flip = tip.x > containerWidth * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 max-w-64 rounded-lg border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2"
      style={{
        left: flip ? undefined : tip.x + 12,
        right: flip ? containerWidth - tip.x + 12 : undefined,
        top: Math.max(0, tip.y - 8),
        boxShadow: 'var(--shadow)',
      }}
    >
      {tip.content}
    </div>
  );
}

/** A tooltip row: the value leads, the series name follows, keyed by a short stroke. */
export function TipRow({ color, value, label }: { color?: string; value: ReactNode; label: ReactNode }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {color && <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />}
      <span className="font-semibold text-ink">{value}</span>
      <span>{label}</span>
    </div>
  );
}
