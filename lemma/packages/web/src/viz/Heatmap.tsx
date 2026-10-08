import type { DayCellDto } from '@lemma/core';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../app/i18n';
import { dayToDate, formatDay, monthLabel } from '../lib/format';
import { useWidth } from './base';

const LEFT = 26;
const TOP = 16;

/**
 * Cell size follows the space available, within limits: a year fits a wide card without
 * scrolling, and on a narrow one the cells stay large enough to hit and the grid scrolls.
 */
function sizeFor(width: number, columns: number): { cell: number; gap: number; step: number } {
  const step = Math.max(11, Math.min(16, Math.floor((width - LEFT) / Math.max(1, columns))));
  const gap = step >= 13 ? 3 : 2;
  return { cell: step - gap, gap, step };
}

/** Contributions from a code forge, bucketed like the activity score. */
const forgeLevel = (count: number): 0 | 1 | 2 | 3 | 4 =>
  count <= 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;

interface Props {
  cells: DayCellDto[];
  /** Which measure the cells show. */
  measure: 'score' | 'forge';
  today: string;
  selected: string | null;
  onSelect: (day: string) => void;
}

/**
 * A year of days, one cell each, Monday on top. One hue, five steps: the cell says how
 * much happened, the tooltip and the day panel say what. Arrow keys move between days.
 */
export function Heatmap({ cells, measure, today, selected, onSelect }: Props) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const [outer, available] = useWidth<HTMLDivElement>();
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<{ day: string; x: number; y: number } | null>(null);

  const { columns, months, byDay } = useMemo(() => {
    // Pad the front so the first column starts on a Monday.
    const first = cells[0] ? (dayToDate(cells[0].day).getDay() + 6) % 7 : 0;
    const padded: (DayCellDto | null)[] = [...Array.from({ length: first }, () => null), ...cells];
    const cols: (DayCellDto | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    const labels: { column: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((column, index) => {
      const firstDay = column.find((cell): cell is DayCellDto => cell !== null);
      if (!firstDay) return;
      const month = dayToDate(firstDay.day).getMonth();
      if (month !== lastMonth) {
        // Skip a label that would collide with the previous one.
        if (labels.length === 0 || index - labels[labels.length - 1]!.column >= 3)
          labels.push({ column: index, label: monthLabel(firstDay.day, t.locale) });
        lastMonth = month;
      }
    });
    return { columns: cols, months: labels, byDay: new Map(cells.map((cell) => [cell.day, cell])) };
  }, [cells, t.locale]);

  const { cell: CELL, step: STEP } = sizeFor(available, columns.length);

  // Start scrolled to the present.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [columns.length, STEP]);

  const levelOf = (cell: DayCellDto): number => (measure === 'score' ? cell.level : forgeLevel(cell.forge));
  const describe = (cell: DayCellDto): string => {
    const date = formatDay(cell.day, t.locale, 'weekday');
    if (measure === 'forge') return `${date} · ${cell.forge} ${t('příspěvků', 'contributions')}`;
    return cell.score > 0
      ? `${date} · ${cell.score} ${t('bodů', 'points')}`
      : `${date} · ${t('bez aktivity', 'no activity')}`;
  };

  const tabStop = focus ?? selected ?? today;
  const move = (event: KeyboardEvent<SVGRectElement>, day: string): void => {
    const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const index = cells.findIndex((cell) => cell.day === day);
    const next = cells[index + delta];
    if (!next) return;
    setFocus(next.day);
    scroller.current?.querySelector<SVGRectElement>(`[data-day="${next.day}"]`)?.focus();
  };

  const width = LEFT + columns.length * STEP;
  const height = TOP + 7 * STEP;
  const weekdays = t.locale === 'cs' ? ['po', '', 'st', '', 'pá', '', ''] : ['Mon', '', 'Wed', '', 'Fri', '', ''];
  const hovered = hover ? byDay.get(hover.day) : undefined;

  return (
    <div ref={outer} className="relative">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={height}
          role="grid"
          aria-label={
            measure === 'score'
              ? t('Aktivita za poslední rok', 'Activity over the last year')
              : t('Příspěvky do repozitářů za poslední rok', 'Repository contributions over the last year')
          }
          className="block"
        >
          {months.map((month) => (
            <text key={month.column} x={LEFT + month.column * STEP} y={10} fontSize={10} fill="var(--text-3)">
              {month.label}
            </text>
          ))}
          {weekdays.map((label, row) =>
            label ? (
              <text key={row} x={0} y={TOP + row * STEP + CELL - 2} fontSize={10} fill="var(--text-3)">
                {label}
              </text>
            ) : null,
          )}
          {columns.map((column, c) => (
            <g key={c} role="row">
              {column.map((cell, row) => {
                if (!cell) return null;
                const x = LEFT + c * STEP;
                const y = TOP + row * STEP;
                const isSelected = cell.day === selected;
                return (
                  <rect
                    key={cell.day}
                    data-day={cell.day}
                    role="gridcell"
                    aria-label={describe(cell)}
                    aria-selected={isSelected}
                    tabIndex={cell.day === tabStop ? 0 : -1}
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2.5}
                    fill={`var(--heat-${levelOf(cell)})`}
                    stroke={isSelected ? 'var(--text)' : cell.day === today ? 'var(--text-3)' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 1}
                    className="cursor-pointer outline-none focus-visible:stroke-[var(--accent)] focus-visible:[stroke-width:2]"
                    onClick={() => onSelect(cell.day)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(cell.day);
                      } else move(event, cell.day);
                    }}
                    onFocus={() => {
                      setFocus(cell.day);
                      setHover({ day: cell.day, x, y });
                    }}
                    onBlur={() => setHover(null)}
                    onPointerEnter={() => setHover({ day: cell.day, x, y })}
                    onPointerLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      {hover && hovered && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-xs whitespace-nowrap text-ink"
          style={{
            left: Math.max(
              0,
              Math.min(
                hover.x - (scroller.current?.scrollLeft ?? 0) - 40,
                (scroller.current?.clientWidth ?? 300) - 190,
              ),
            ),
            top: hover.y - 30 < 0 ? hover.y + CELL + 6 : hover.y - 30,
            boxShadow: 'var(--shadow)',
          }}
        >
          {describe(hovered)}
        </div>
      )}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-ink-3">
        {t('méně', 'less')}
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="inline-block rounded-[2.5px]"
            style={{ width: 11, height: 11, background: `var(--heat-${level})` }}
          />
        ))}
        {t('více', 'more')}
      </div>
    </div>
  );
}
