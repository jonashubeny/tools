import type { Locale } from '@lemma/core';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Tex } from '../lib/Math';

/** Shared pieces of the Lab tools: parameter sliders, readouts, and number formatting. */

/** A number for an expression string the parser reads: plain decimal point, no exponent. */
export function ex(value: number): string {
  const rounded = Math.round(value * 10_000) / 10_000;
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return rounded < 0 ? `(${text})` : text;
}

/** A number for TeX in the given language: decimal comma in Czech, a real minus sign. */
export function tx(value: number, locale: Locale, digits = 2): string {
  if (!Number.isFinite(value)) return value > 0 ? '\\infty' : value < 0 ? '-\\infty' : '\\text{?}';
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return locale === 'cs' ? text.replace('.', '{,}') : text;
}

/** "+ 3", "- 2" or nothing: the tail of a sum in TeX. */
export function tail(value: number, locale: Locale, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  if (rounded === 0) return '';
  return rounded > 0 ? `+ ${tx(rounded, locale, digits)}` : `- ${tx(-rounded, locale, digits)}`;
}

/** "+ 3x", "- x" or nothing: a term with a symbol in the tail of a sum. */
export function tailTerm(value: number, symbol: string, locale: Locale): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return '';
  const magnitude = Math.abs(rounded) === 1 ? '' : tx(Math.abs(rounded), locale);
  return `${rounded > 0 ? '+' : '-'} ${magnitude}${symbol}`;
}

/** "x - 2", "x + 3" or "x": a shifted variable in TeX, without brackets. */
export function shiftedBare(shift: number, locale: Locale): string {
  const rounded = Math.round(shift * 100) / 100;
  if (rounded === 0) return 'x';
  return rounded > 0 ? `x - ${tx(rounded, locale)}` : `x + ${tx(-rounded, locale)}`;
}

/** "(x - 2)", "(x + 3)" or "x": the same, bracketed when it is a sum. */
export function shifted(shift: number, locale: Locale): string {
  const bare = shiftedBare(shift, locale);
  return bare === 'x' ? bare : `(${bare})`;
}

/** A number for running text in the given language. */
export function plain(value: number, locale: Locale, digits = 2): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  const text = String(Object.is(rounded, -0) ? 0 : rounded).replace('-', '−');
  return locale === 'cs' ? text.replace('.', ',') : text;
}

/** A leading coefficient in TeX: nothing for 1, "-" for −1. */
export function lead(value: number, locale: Locale): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 1) return '';
  if (rounded === -1) return '-';
  return tx(rounded, locale);
}

export function Param({
  name,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: string;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-7 shrink-0 text-right">
        <Tex tex={name} />
      </span>
      <input
        type="range"
        className="slider min-w-0 flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-14 shrink-0 text-right font-mono text-[13px] text-ink-2">
        {display ?? String(Math.round(value * 100) / 100).replace('-', '−')}
      </span>
    </label>
  );
}

export function Readout({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 border-t border-border py-1.5 text-sm first:border-0',
        className,
      )}
    >
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 overflow-x-auto text-right">{children}</span>
    </div>
  );
}

/** The frame of a tool: plot on one side, controls and readouts on the other. */
export function ToolLayout({
  plot,
  controls,
  readouts,
  compact,
}: {
  plot: ReactNode;
  controls: ReactNode;
  readouts?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-5',
        compact ? 'md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]',
      )}
    >
      <div className="min-w-0">{plot}</div>
      <div className="min-w-0 space-y-4">
        <div className="space-y-2.5">{controls}</div>
        {readouts && <div>{readouts}</div>}
      </div>
    </div>
  );
}

/** Keep a slider away from a forbidden value (a coefficient that must not be zero). */
export const avoid = (value: number, forbidden: number, step: number): number =>
  Math.abs(value - forbidden) < step / 2 ? forbidden + step : value;
