import { type FigureSpec, type LabTool as LabToolName, type Locale, evalReal, tryParse } from '@lemma/core';
import { Minus, Plus, RotateCcw, Volume2 } from 'lucide-react';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../app/i18n';
import { Figure } from '../figure/Figure';
import { cn } from '../lib/cn';
import { Tex } from '../lib/Math';
import { Button, IconButton, Segmented, Switch, TextInput } from '../ui';
import { Param, Readout, ToolLayout, avoid, ex, lead, plain, shifted, shiftedBare, tail, tailTerm, tx } from './kit';

/**
 * The Math Lab tools. Each is a small instrument for one idea: parameters you can move,
 * a picture that follows, and readouts that say in symbols what the picture shows.
 */

type Preset = Record<string, number | string | boolean>;

export interface ToolProps {
  preset?: Preset;
  compact?: boolean;
}

const num = (preset: Preset | undefined, key: string, fallback: number): number =>
  typeof preset?.[key] === 'number' ? (preset[key] as number) : fallback;
const str = (preset: Preset | undefined, key: string, fallback: string): string =>
  typeof preset?.[key] === 'string' ? (preset[key] as string) : fallback;

/** A point written the way the language writes it. */
const pt = (x: number, y: number, locale: Locale): string =>
  locale === 'cs' ? `[${plain(x, locale)}; ${plain(y, locale)}]` : `(${plain(x, locale)}, ${plain(y, locale)})`;
const ptTex = (x: number, y: number, locale: Locale): string =>
  locale === 'cs' ? `[${tx(x, locale)};\\, ${tx(y, locale)}]` : `(${tx(x, locale)},\\, ${tx(y, locale)})`;

/** One of a few formulas to choose from. */
function FormulaChoice({ tex, selected, onSelect }: { tex: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'h-9 min-w-11 rounded-md border px-2.5 text-sm',
        selected ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-2 hover:bg-surface-3',
      )}
    >
      <Tex tex={tex} />
    </button>
  );
}

// --------------------------------------------------------------------------------- linear

function Linear({ preset, compact }: ToolProps) {
  const t = useT();
  const [a, setA] = useState(num(preset, 'a', 1));
  const [b, setB] = useState(num(preset, 'b', 0));
  const zero = a === 0 ? null : -b / a;
  const spec: FigureSpec = {
    view: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 },
    curves: [{ expr: `${ex(a)}*x + ${ex(b)}`, color: 'a' }],
    segments:
      a === 0
        ? []
        : [
            { from: [0, b], to: [1, b], color: 'muted', dashed: true },
            { from: [1, b], to: [1, b + a], color: 'b' },
          ],
    points: [
      { x: 0, y: b, color: 'a', label: pt(0, b, t.locale) },
      ...(zero !== null && Math.abs(zero) <= 8 ? [{ x: zero, y: 0, color: 'c' as const, hollow: true }] : []),
    ],
  };
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} label={t('Graf lineární funkce', 'Graph of a linear function')} />}
      controls={
        <>
          <Param name="a" value={a} min={-5} max={5} step={0.25} onChange={setA} />
          <Param name="b" value={b} min={-6} max={6} step={0.5} onChange={setB} />
        </>
      }
      readouts={
        <>
          <Readout label={t('Předpis', 'Formula')}>
            <Tex tex={a === 0 ? `y = ${tx(b, t.locale)}` : `y = ${lead(a, t.locale)}x ${tail(b, t.locale)}`} />
          </Readout>
          <Readout label={t('Krok o 1 doprava', 'One step right')}>
            <span className="text-ink-2">
              {a === 0
                ? t('nic se nemění', 'nothing changes')
                : a > 0
                  ? t(`o ${plain(a, 'cs')} nahoru`, `${plain(a, 'en')} up`)
                  : t(`o ${plain(-a, 'cs')} dolů`, `${plain(-a, 'en')} down`)}
            </span>
          </Readout>
          <Readout label={t('Průsečík s osou y', 'y-intercept')}>
            <Tex tex={ptTex(0, b, t.locale)} />
          </Readout>
          <Readout label={t('Nulový bod', 'Zero')}>
            {zero === null ? (
              <span className="text-ink-2">{b === 0 ? t('všechna x', 'every x') : t('žádný', 'none')}</span>
            ) : (
              <Tex tex={`x = ${tx(zero, t.locale)}`} />
            )}
          </Readout>
          <Readout label={t('Monotonie', 'Monotonicity')}>
            <span className="text-ink-2">
              {a > 0 ? t('rostoucí', 'increasing') : a < 0 ? t('klesající', 'decreasing') : t('konstantní', 'constant')}
            </span>
          </Readout>
        </>
      }
    />
  );
}

// ------------------------------------------------------------------------------ quadratic

type QuadForm = 'standard' | 'vertex' | 'factored';

function Quadratic({ preset, compact }: ToolProps) {
  const t = useT();
  const startForm =
    (['standard', 'vertex', 'factored'] as const).find((f) => f === str(preset, 'form', 'vertex')) ?? 'vertex';
  const initial = (() => {
    const a0 = avoid(num(preset, 'a', 1), 0, 0.25);
    if (startForm === 'standard' && preset && 'b' in preset) {
      const b0 = num(preset, 'b', 0);
      const c0 = num(preset, 'c', 0);
      return { a: a0, m: -b0 / (2 * a0), n: c0 - (b0 * b0) / (4 * a0) };
    }
    return { a: a0, m: num(preset, 'm', 1), n: num(preset, 'n', -4) };
  })();
  const [form, setForm] = useState<QuadForm>(startForm);
  // One parabola, kept as (a, m, n); the other forms are views of it.
  const [{ a, m, n }, setP] = useState(initial);
  const b = -2 * a * m;
  const c = a * m * m + n;
  const disc = b * b - 4 * a * c;
  const roots =
    disc < -1e-9
      ? []
      : Math.abs(disc) <= 1e-9
        ? [m]
        : [m - Math.sqrt(disc) / (2 * Math.abs(a)), m + Math.sqrt(disc) / (2 * Math.abs(a))];

  const fromStandard = (na: number, nb: number, nc: number): void =>
    setP({ a: na, m: -nb / (2 * na), n: nc - (nb * nb) / (4 * na) });
  const fromRoots = (na: number, x1: number, x2: number): void =>
    setP({ a: na, m: (x1 + x2) / 2, n: -na * ((x1 - x2) / 2) ** 2 });

  const spec: FigureSpec = {
    view: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
    aspect: 0.8,
    curves: [{ expr: `${ex(a)}*(x - ${ex(m)})^2 + ${ex(n)}`, color: 'a' }],
    vlines: [{ x: m, color: 'muted', dashed: true }],
    points: [
      { x: m, y: n, color: 'a', label: 'V' },
      ...roots.map((x) => ({ x, y: 0, color: 'c' as const, hollow: true })),
      { x: 0, y: c, color: 'b' as const },
    ],
  };

  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} label={t('Graf kvadratické funkce', 'Graph of a quadratic function')} />}
      controls={
        <>
          <Segmented
            label={t('Tvar předpisu', 'Form of the formula')}
            size="sm"
            value={form}
            onChange={setForm}
            options={[
              { value: 'standard', label: t('obecný', 'standard') },
              { value: 'vertex', label: t('vrcholový', 'vertex') },
              { value: 'factored', label: t('součinový', 'factored') },
            ]}
          />
          {form === 'vertex' && (
            <>
              <Param
                name="a"
                value={a}
                min={-3}
                max={3}
                step={0.25}
                onChange={(v) => setP({ a: avoid(v, 0, 0.25), m, n })}
              />
              <Param name="m" value={m} min={-6} max={6} step={0.5} onChange={(v) => setP({ a, m: v, n })} />
              <Param name="n" value={n} min={-7} max={7} step={0.5} onChange={(v) => setP({ a, m, n: v })} />
            </>
          )}
          {form === 'standard' && (
            <>
              <Param
                name="a"
                value={a}
                min={-3}
                max={3}
                step={0.25}
                onChange={(v) => fromStandard(avoid(v, 0, 0.25), b, c)}
              />
              <Param name="b" value={b} min={-12} max={12} step={0.5} onChange={(v) => fromStandard(a, v, c)} />
              <Param name="c" value={c} min={-8} max={8} step={0.5} onChange={(v) => fromStandard(a, b, v)} />
            </>
          )}
          {form === 'factored' &&
            (roots.length === 0 ? (
              <p className="text-[13px] text-ink-2">
                {t(
                  'Tahle parabola osu x neprotíná, takže součinový tvar v reálných číslech nemá. Přepni na vrcholový a posuň ji.',
                  'This parabola does not cross the x-axis, so it has no factored form over the reals. Switch to vertex form and move it.',
                )}
              </p>
            ) : (
              <>
                <Param
                  name="a"
                  value={a}
                  min={-3}
                  max={3}
                  step={0.25}
                  onChange={(v) => fromRoots(avoid(v, 0, 0.25), roots[0]!, roots[roots.length - 1]!)}
                />
                <Param
                  name="x_1"
                  value={roots[0]!}
                  min={-7}
                  max={7}
                  step={0.5}
                  onChange={(v) => fromRoots(a, v, roots[roots.length - 1]!)}
                />
                <Param
                  name="x_2"
                  value={roots[roots.length - 1]!}
                  min={-7}
                  max={7}
                  step={0.5}
                  onChange={(v) => fromRoots(a, roots[0]!, v)}
                />
              </>
            ))}
        </>
      }
      readouts={
        <>
          <Readout label={t('Obecný', 'Standard')}>
            <Tex tex={`y = ${lead(a, t.locale)}x^2 ${tailTerm(b, 'x', t.locale)} ${tail(c, t.locale)}`} />
          </Readout>
          <Readout label={t('Vrcholový', 'Vertex')}>
            <Tex tex={`y = ${lead(a, t.locale)}${shifted(m, t.locale)}^2 ${tail(n, t.locale)}`} />
          </Readout>
          <Readout label={t('Součinový', 'Factored')}>
            {roots.length === 0 ? (
              <span className="text-ink-2">{t('neexistuje v ℝ', 'none over ℝ')}</span>
            ) : (
              <Tex
                tex={`y = ${lead(a, t.locale)}${shifted(roots[0]!, t.locale)}${roots.length === 1 ? '^2' : shifted(roots[1]!, t.locale)}`}
              />
            )}
          </Readout>
          <Readout label={t('Vrchol', 'Vertex point')}>
            <Tex tex={`V = ${ptTex(m, n, t.locale)}`} />
          </Readout>
          <Readout label={t('Diskriminant', 'Discriminant')}>
            <Tex tex={`D = ${tx(disc, t.locale)}`} />{' '}
            <span className="text-ink-2">
              ·{' '}
              {roots.length === 2
                ? t('dva kořeny', 'two roots')
                : roots.length === 1
                  ? t('jeden dvojnásobný', 'one double root')
                  : t('žádný reálný', 'no real root')}
            </span>
          </Readout>
          <Readout label={t('Obor hodnot', 'Range')}>
            <Tex
              tex={
                a > 0
                  ? t.locale === 'cs'
                    ? `\\langle ${tx(n, t.locale)};\\, \\infty)`
                    : `[${tx(n, t.locale)},\\, \\infty)`
                  : t.locale === 'cs'
                    ? `(-\\infty;\\, ${tx(n, t.locale)}\\rangle`
                    : `(-\\infty,\\, ${tx(n, t.locale)}]`
              }
            />
          </Readout>
        </>
      }
    />
  );
}

// ------------------------------------------------------------------------------- absolute

function Absolute({ preset, compact }: ToolProps) {
  const t = useT();
  const [a, setA] = useState(avoid(num(preset, 'a', 1), 0, 0.25));
  const [m, setM] = useState(num(preset, 'm', 2));
  const [n, setN] = useState(num(preset, 'n', 0));
  const [c, setC] = useState(num(preset, 'c', 3));
  const [line, setLine] = useState(true);
  const d = (c - n) / a;
  const solutions = d < -1e-9 ? [] : Math.abs(d) <= 1e-9 ? [m] : [m - d, m + d];
  const spec: FigureSpec = {
    view: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 },
    curves: [{ expr: `${ex(a)}*abs(x - ${ex(m)}) + ${ex(n)}`, color: 'a' }],
    hlines: line ? [{ y: c, color: 'b', dashed: true }] : [],
    points: [
      { x: m, y: n, color: 'a', label: 'V' },
      ...(line ? solutions.map((x) => ({ x, y: c, color: 'b' as const })) : []),
    ],
    segments: line
      ? solutions.map((x) => ({
          from: [x, c] as [number, number],
          to: [x, 0] as [number, number],
          color: 'muted' as const,
          dashed: true,
        }))
      : [],
  };
  const set = (values: number[]): string =>
    values.length === 0 ? '\\emptyset' : `\\{${values.map((v) => tx(v, t.locale)).join(';\\, ')}\\}`;
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} label={t('Graf funkce s absolutní hodnotou', 'Graph of an absolute-value function')} />}
      controls={
        <>
          <Param name="a" value={a} min={-3} max={3} step={0.25} onChange={(v) => setA(avoid(v, 0, 0.25))} />
          <Param name="m" value={m} min={-6} max={6} step={0.5} onChange={setM} />
          <Param name="n" value={n} min={-5} max={5} step={0.5} onChange={setN} />
          <Switch
            checked={line}
            onChange={setLine}
            label={t('Řešit rovnici s pravou stranou c', 'Solve the equation with right-hand side c')}
          />
          {line && <Param name="c" value={c} min={-6} max={6} step={0.5} onChange={setC} />}
        </>
      }
      readouts={
        <>
          <Readout label={t('Předpis', 'Formula')}>
            <Tex tex={`y = ${lead(a, t.locale)}|${shiftedBare(m, t.locale)}| ${tail(n, t.locale)}`} />
          </Readout>
          <Readout label={t('Vrchol', 'Vertex')}>
            <Tex tex={`V = ${ptTex(m, n, t.locale)}`} />
          </Readout>
          {line && (
            <>
              <Readout label={t('Rovnice', 'Equation')}>
                <Tex
                  tex={`${lead(a, t.locale)}|${shiftedBare(m, t.locale)}| ${tail(n, t.locale)} = ${tx(c, t.locale)}`}
                />
              </Readout>
              <Readout label={t('Vzdálenost od m', 'Distance from m')}>
                <Tex tex={`|${shiftedBare(m, t.locale)}| = ${tx(d, t.locale)}`} />{' '}
                {d < 0 && (
                  <span className="text-ink-2">
                    · {t('vzdálenost nemůže být záporná', 'a distance cannot be negative')}
                  </span>
                )}
              </Readout>
              <Readout label={t('Řešení', 'Solutions')}>
                <Tex tex={`K = ${set(solutions)}`} />
              </Readout>
            </>
          )}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------------- power

const EXPONENTS: { id: string; tex: string; expr: string; n: number }[] = [
  { id: '-3', tex: 'x^{-3}', expr: 'x^(-3)', n: -3 },
  { id: '-2', tex: 'x^{-2}', expr: 'x^(-2)', n: -2 },
  { id: '-1', tex: 'x^{-1}', expr: 'x^(-1)', n: -1 },
  { id: '1/2', tex: '\\sqrt{x}', expr: 'sqrt(x)', n: 0.5 },
  { id: '1/3', tex: '\\sqrt[3]{x}', expr: 'cbrt(x)', n: 1 / 3 },
  { id: '1', tex: 'x', expr: 'x', n: 1 },
  { id: '2', tex: 'x^2', expr: 'x^2', n: 2 },
  { id: '3', tex: 'x^3', expr: 'x^3', n: 3 },
  { id: '4', tex: 'x^4', expr: 'x^4', n: 4 },
  { id: '5', tex: 'x^5', expr: 'x^5', n: 5 },
];

function Power({ preset, compact }: ToolProps) {
  const t = useT();
  const start = EXPONENTS.find((e) => e.n === num(preset, 'n', 2)) ?? EXPONENTS[6]!;
  const [id, setId] = useState(start.id);
  const [compare, setCompare] = useState<string | null>(null);
  const current = EXPONENTS.find((e) => e.id === id)!;
  const other = EXPONENTS.find((e) => e.id === compare) ?? null;
  const integer = Number.isInteger(current.n);
  const even = integer && current.n % 2 === 0;
  const R = '\\mathbb{R}';
  const closed0 = t.locale === 'cs' ? '\\langle 0;\\, \\infty)' : '[0,\\, \\infty)';
  const open0 = t.locale === 'cs' ? '(0;\\, \\infty)' : '(0,\\, \\infty)';
  const domain = current.n === 0.5 ? closed0 : current.n < 0 ? `${R} \\setminus \\{0\\}` : R;
  const range =
    current.n === 0.5 ? closed0 : current.n < 0 ? (even ? open0 : `${R} \\setminus \\{0\\}`) : even ? closed0 : R;
  const parity =
    current.n === 0.5
      ? t('ani sudá, ani lichá', 'neither even nor odd')
      : even
        ? t('sudá — souměrná podle osy y', 'even — symmetric about the y-axis')
        : t('lichá — souměrná podle počátku', 'odd — symmetric about the origin');
  const spec: FigureSpec = {
    view: { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
    aspect: 0.8,
    curves: [
      ...(other ? [{ expr: other.expr, color: 'muted' as const, dashed: true }] : []),
      { expr: current.expr, color: 'a' as const },
    ],
    points: [{ x: 1, y: 1, color: 'a', label: pt(1, 1, t.locale) }],
  };
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} label={t('Graf mocninné funkce', 'Graph of a power function')} />}
      controls={
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('Funkce', 'Function')}>
            {EXPONENTS.map((e) => (
              <FormulaChoice key={e.id} tex={e.tex} selected={e.id === id} onSelect={() => setId(e.id)} />
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            {t('Porovnat s', 'Compare with')}
            <select
              value={compare ?? ''}
              onChange={(event) => setCompare(event.target.value || null)}
              className="h-8 rounded-md border border-border-strong bg-surface-2 px-2 text-sm"
            >
              <option value="">—</option>
              {EXPONENTS.filter((e) => e.id !== id).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.expr}
                </option>
              ))}
            </select>
          </label>
        </>
      }
      readouts={
        <>
          <Readout label={t('Definiční obor', 'Domain')}>
            <Tex tex={`D(f) = ${domain}`} />
          </Readout>
          <Readout label={t('Obor hodnot', 'Range')}>
            <Tex tex={`H(f) = ${range}`} />
          </Readout>
          <Readout label={t('Parita', 'Parity')}>
            <span className="text-ink-2">{parity}</span>
          </Readout>
          <Readout label={t('Všechny procházejí', 'All pass through')}>
            <Tex tex={ptTex(1, 1, t.locale)} />
          </Readout>
          {current.n < 0 && (
            <Readout label={t('Asymptoty', 'Asymptotes')}>
              <span className="text-ink-2">
                {t(
                  'obě osy: k nule se blíží, nikdy ji nedosáhne',
                  'both axes: it approaches zero and never reaches it',
                )}
              </span>
            </Readout>
          )}
        </>
      }
    />
  );
}

// ------------------------------------------------------------------------------ transform

/** `bare` is the argument as written ("x - 2"); `wrapped` is the same in brackets when it needs them. */
const BASES: { id: string; tex: (bare: string, wrapped: string) => string; expr: (u: string) => string }[] = [
  { id: 'sq', tex: (_bare, wrapped) => `${wrapped}^2`, expr: (u) => `(${u})^2` },
  { id: 'abs', tex: (bare) => `|${bare}|`, expr: (u) => `abs(${u})` },
  { id: 'sqrt', tex: (bare) => `\\sqrt{${bare}}`, expr: (u) => `sqrt(${u})` },
  { id: 'inv', tex: (bare) => `\\dfrac{1}{${bare}}`, expr: (u) => `1/(${u})` },
  { id: 'sin', tex: (_bare, wrapped) => `\\sin ${wrapped}`, expr: (u) => `sin(${u})` },
  { id: 'exp', tex: (bare) => `2^{${bare}}`, expr: (u) => `2^(${u})` },
];

function Transform({ preset, compact }: ToolProps) {
  const t = useT();
  const [baseId, setBaseId] = useState(str(preset, 'base', 'sq'));
  const [a, setA] = useState(avoid(num(preset, 'a', 1), 0, 0.25));
  const [m, setM] = useState(num(preset, 'm', 0));
  const [n, setN] = useState(num(preset, 'n', 0));
  const base = BASES.find((b) => b.id === baseId) ?? BASES[0]!;
  const spec: FigureSpec = {
    view: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 },
    curves: [
      { expr: base.expr('x'), color: 'muted', dashed: true, label: `f(x)` },
      { expr: `${ex(a)}*(${base.expr(`x - ${ex(m)}`)}) + ${ex(n)}`, color: 'a', label: 'g(x) = a·f(x − m) + n' },
    ],
  };
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} label={t('Transformace grafu', 'Graph transformation')} />}
      controls={
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('Výchozí funkce', 'Base function')}>
            {BASES.map((b) => (
              <FormulaChoice
                key={b.id}
                tex={b.tex('x', 'x')}
                selected={b.id === baseId}
                onSelect={() => setBaseId(b.id)}
              />
            ))}
          </div>
          <Param name="a" value={a} min={-3} max={3} step={0.25} onChange={(v) => setA(avoid(v, 0, 0.25))} />
          <Param name="m" value={m} min={-5} max={5} step={0.5} onChange={setM} />
          <Param name="n" value={n} min={-5} max={5} step={0.5} onChange={setN} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setA(1);
              setM(0);
              setN(0);
            }}
          >
            <RotateCcw size={13} />
            {t('Vrátit', 'Reset')}
          </Button>
        </>
      }
      readouts={
        <>
          <Readout label={t('Předpis', 'Formula')}>
            <Tex
              tex={`g(x) = ${lead(a, t.locale)}${base.tex(shiftedBare(m, t.locale), shifted(m, t.locale))} ${tail(n, t.locale)}`}
            />
          </Readout>
          <Readout label="a">
            <span className="text-ink-2">
              {Math.abs(a) === 1
                ? t('beze změny výšky', 'height unchanged')
                : Math.abs(a) > 1
                  ? t(
                      `natažení ${plain(Math.abs(a), 'cs')}× svisle`,
                      `stretched ${plain(Math.abs(a), 'en')}× vertically`,
                    )
                  : t(
                      `stlačení na ${plain(Math.abs(a), 'cs')} svisle`,
                      `compressed to ${plain(Math.abs(a), 'en')} vertically`,
                    )}
              {a < 0 && t(', překlopení podle osy x', ', flipped in the x-axis')}
            </span>
          </Readout>
          <Readout label="m">
            <span className="text-ink-2">
              {m === 0
                ? t('bez posunu', 'no shift')
                : m > 0
                  ? t(
                      `posun o ${plain(m, 'cs')} doprava (v předpisu je x − ${plain(m, 'cs')})`,
                      `shift ${plain(m, 'en')} right (the formula has x − ${plain(m, 'en')})`,
                    )
                  : t(
                      `posun o ${plain(-m, 'cs')} doleva (v předpisu je x + ${plain(-m, 'cs')})`,
                      `shift ${plain(-m, 'en')} left (the formula has x + ${plain(-m, 'en')})`,
                    )}
            </span>
          </Readout>
          <Readout label="n">
            <span className="text-ink-2">
              {n === 0
                ? t('bez posunu', 'no shift')
                : n > 0
                  ? t(`posun o ${plain(n, 'cs')} nahoru`, `shift ${plain(n, 'en')} up`)
                  : t(`posun o ${plain(-n, 'cs')} dolů`, `shift ${plain(-n, 'en')} down`)}
            </span>
          </Readout>
        </>
      }
    />
  );
}

// -------------------------------------------------------------------------------- inverse

const INVERTIBLE: {
  id: string;
  f: string;
  inv: string | null;
  short: string;
  fTex: string;
  invTex: string;
  domain?: [number, number];
  branches?: string[];
}[] = [
  {
    id: 'lin',
    f: '2*x + 1',
    inv: '(x - 1)/2',
    short: '2x + 1',
    fTex: 'f(x) = 2x + 1',
    invTex: 'f^{-1}(x) = \\dfrac{x - 1}{2}',
  },
  { id: 'cube', f: 'x^3', inv: 'cbrt(x)', short: 'x^3', fTex: 'f(x) = x^3', invTex: 'f^{-1}(x) = \\sqrt[3]{x}' },
  {
    id: 'sqpos',
    f: 'x^2',
    inv: 'sqrt(x)',
    short: 'x^2,\\; x \\ge 0',
    fTex: 'f(x) = x^2,\\; x \\ge 0',
    invTex: 'f^{-1}(x) = \\sqrt{x}',
    domain: [0, 8],
  },
  { id: 'exp', f: '2^x', inv: 'ln(x)/ln(2)', short: '2^x', fTex: 'f(x) = 2^x', invTex: 'f^{-1}(x) = \\log_2 x' },
  {
    id: 'sq',
    f: 'x^2',
    inv: null,
    short: 'x^2,\\; x \\in \\mathbb{R}',
    fTex: 'f(x) = x^2,\\; x \\in \\mathbb{R}',
    invTex: '',
    branches: ['sqrt(x)', '-sqrt(x)'],
  },
];

function Inverse({ compact }: ToolProps) {
  const t = useT();
  const [id, setId] = useState('lin');
  const [x0, setX0] = useState(1);
  const item = INVERTIBLE.find((i) => i.id === id)!;
  const fNode = useMemo(() => tryParse(item.f, { decimalComma: false, variables: ['x'] }), [item.f]);
  const x = item.domain ? Math.max(item.domain[0], x0) : x0;
  const y = fNode.ok ? evalReal(fNode.node, { x }) : Number.NaN;
  const spec: FigureSpec = {
    view: { xMin: -6, xMax: 6, yMin: -6, yMax: 6 },
    aspect: 1,
    curves: [
      { expr: 'x', color: 'muted', dashed: true, label: 'y = x' },
      { expr: item.f, color: 'a', domain: item.domain, label: 'f' },
      ...(item.inv
        ? [{ expr: item.inv, color: 'b' as const, label: 'f⁻¹' }]
        : (item.branches ?? []).map((branch) => ({ expr: branch, color: 'bad' as const, dashed: true }))),
    ],
    points:
      Number.isFinite(y) && Math.abs(y) <= 6
        ? [
            { x, y, color: 'a' as const, label: pt(x, y, t.locale) },
            { x: y, y: x, color: item.inv ? ('b' as const) : ('bad' as const), label: pt(y, x, t.locale) },
          ]
        : [],
    segments:
      Number.isFinite(y) && Math.abs(y) <= 6 ? [{ from: [x, y], to: [y, x], color: 'muted', dashed: true }] : [],
  };
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} maxWidth={440} label={t('Funkce a její inverze', 'A function and its inverse')} />}
      controls={
        <>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('Funkce', 'Function')}>
            {INVERTIBLE.map((i) => (
              <FormulaChoice key={i.id} tex={i.short} selected={i.id === id} onSelect={() => setId(i.id)} />
            ))}
          </div>
          <Param name="x_0" value={x} min={item.domain ? item.domain[0] : -3} max={3} step={0.25} onChange={setX0} />
        </>
      }
      readouts={
        <>
          <Readout label={t('Funkce', 'Function')}>
            <Tex tex={item.fTex} />
          </Readout>
          {item.inv ? (
            <Readout label={t('Inverze', 'Inverse')}>
              <Tex tex={item.invTex} />
            </Readout>
          ) : (
            <Readout label={t('Inverze', 'Inverse')}>
              <span className="text-ink-2">{t('neexistuje', 'does not exist')}</span>
            </Readout>
          )}
          <Readout label={t('Bod a jeho obraz', 'A point and its image')}>
            <Tex tex={`${ptTex(x, y, t.locale)} \\leftrightarrow ${ptTex(y, x, t.locale)}`} />
          </Readout>
          <p className="pt-2 text-[13px] text-ink-2">
            {item.inv
              ? t(
                  'Inverze jen prohodí souřadnice každého bodu, proto je její graf zrcadlem podle přímky y = x.',
                  'The inverse just swaps the coordinates of every point, which is why its graph is the mirror image in the line y = x.',
                )
              : t(
                  'Dvě různá x dávají stejné y, takže zrcadlový obraz přiřazuje jednomu x dvě hodnoty — to není funkce. Omez definiční obor na x ≥ 0 a inverze existuje.',
                  'Two different x give the same y, so the mirror image assigns two values to one x — that is not a function. Restrict the domain to x ≥ 0 and the inverse exists.',
                )}
          </p>
        </>
      }
    />
  );
}

// --------------------------------------------------------------------------------- explog

function ExpLog({ preset, compact }: ToolProps) {
  const t = useT();
  const [a, setA] = useState(2);
  const [showLog, setShowLog] = useState(str(preset, 'show', 'both') !== 'exp');
  const base = avoid(a, 1, 0.1);
  const growing = base > 1;
  const doubling = Math.log(growing ? 2 : 0.5) / Math.log(base);
  const spec: FigureSpec = {
    view: { xMin: -6, xMax: 6, yMin: -6, yMax: 6 },
    aspect: 1,
    curves: [
      ...(showLog ? [{ expr: 'x', color: 'muted' as const, dashed: true }] : []),
      { expr: `${ex(base)}^x`, color: 'a', label: 'y = aˣ' },
      ...(showLog ? [{ expr: `ln(x)/ln(${ex(base)})`, color: 'b' as const, label: 'y = logₐ x' }] : []),
    ],
    points: [
      { x: 0, y: 1, color: 'a' },
      { x: 1, y: base, color: 'a', label: pt(1, base, t.locale) },
      ...(showLog
        ? [
            { x: 1, y: 0, color: 'b' as const },
            { x: base, y: 1, color: 'b' as const },
          ]
        : []),
    ],
  };
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} maxWidth={440} label={t('Exponenciála a logaritmus', 'Exponential and logarithm')} />}
      controls={
        <>
          <Param name="a" value={base} min={0.2} max={4} step={0.1} onChange={setA} />
          <Switch
            checked={showLog}
            onChange={setShowLog}
            label={t('Zobrazit i logaritmus', 'Show the logarithm too')}
          />
        </>
      }
      readouts={
        <>
          <Readout label={t('Funkce', 'Function')}>
            <Tex tex={`y = ${tx(base, t.locale)}^{x}`} />
          </Readout>
          <Readout label={t('Krok o 1 doprava', 'One step right')}>
            <span className="text-ink-2">
              {t(`hodnota se násobí ${plain(base, 'cs')}×`, `the value is multiplied by ${plain(base, 'en')}`)}
            </span>
          </Readout>
          <Readout
            label={growing ? t('Zdvojnásobí se za', 'Doubles every') : t('Klesne na polovinu za', 'Halves every')}
          >
            <Tex tex={`${tx(doubling, t.locale)}`} /> <span className="text-ink-2">{t('kroku', 'steps')}</span>
          </Readout>
          {showLog && (
            <Readout label={t('Logaritmus se ptá', 'The logarithm asks')}>
              <Tex tex={`\\log_{${tx(base, t.locale)}} y = x \\iff ${tx(base, t.locale)}^{x} = y`} />
            </Readout>
          )}
          <p className="pt-2 text-[13px] text-ink-2">
            {growing
              ? t(
                  'Základ větší než 1: růst. Čím dál doprava, tím strměji — každý krok přidá násobek toho, co už je.',
                  'Base above 1: growth. The further right, the steeper — each step adds a multiple of what is already there.',
                )
              : t(
                  'Základ mezi 0 a 1: rozpad. Hodnota se blíží nule a nikdy jí nedosáhne.',
                  'Base between 0 and 1: decay. The value approaches zero and never reaches it.',
                )}
          </p>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------- unit circle

const SPECIAL: Record<number, [string, string]> = {
  0: ['0', '1'],
  30: ['\\tfrac{1}{2}', '\\tfrac{\\sqrt{3}}{2}'],
  45: ['\\tfrac{\\sqrt{2}}{2}', '\\tfrac{\\sqrt{2}}{2}'],
  60: ['\\tfrac{\\sqrt{3}}{2}', '\\tfrac{1}{2}'],
  90: ['1', '0'],
};

/** Exact sine and cosine at multiples of 30° and 45°, by reduction to the first quadrant. */
function exactTrig(deg: number): { sin: string; cos: string } | null {
  const d = ((deg % 360) + 360) % 360;
  const ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const base = SPECIAL[ref];
  if (!base) return null;
  const signed = (value: string, negative: boolean): string => (negative && value !== '0' ? `-${value}` : value);
  return { sin: signed(base[0], d > 180), cos: signed(base[1], d > 90 && d < 270) };
}

function radTex(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  if (d === 0) return '0';
  const g = gcd(d, 180);
  const p = d / g;
  const q = 180 / g;
  return q === 1 ? `${p === 1 ? '' : p}\\pi` : `\\tfrac{${p === 1 ? '' : p}\\pi}{${q}}`;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function UnitCircle({ compact }: ToolProps) {
  const t = useT();
  const [deg, setDeg] = useState(45);
  const [snap, setSnap] = useState(true);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const exact = Number.isInteger(deg) ? exactTrig(deg) : null;
  const circle: FigureSpec = {
    view: { xMin: -1.6, xMax: 1.6, yMin: -1.3, yMax: 1.3 },
    aspect: 2.6 / 3.2,
    circles: [{ cx: 0, cy: 0, r: 1, color: 'muted' }],
    segments: [
      { from: [0, 0], to: [cos, sin], color: 'a' },
      { from: [cos, 0], to: [cos, sin], color: 'b' },
      { from: [0, 0], to: [cos, 0], color: 'c' },
    ],
    points: [{ x: cos, y: sin, color: 'a', label: 'P' }],
  };
  const wave: FigureSpec = {
    view: { xMin: 0, xMax: 2 * Math.PI, yMin: -1.3, yMax: 1.3 },
    aspect: 0.42,
    piAxis: true,
    curves: [{ expr: 'sin(x)', color: 'b' }],
    segments: [{ from: [rad, 0], to: [rad, sin], color: 'b' }],
    points: [{ x: rad, y: sin, color: 'b' }],
  };
  return (
    <ToolLayout
      compact={compact}
      plot={
        <div className="space-y-3">
          <Figure
            spec={circle}
            maxWidth={440}
            label={t('Jednotková kružnice — bod P lze táhnout', 'Unit circle — the point P can be dragged')}
            onPointer={(point) => {
              let angle = (Math.atan2(point.y, point.x) * 180) / Math.PI;
              if (angle < 0) angle += 360;
              setDeg(snap ? (Math.round(angle / 15) * 15) % 360 : Math.round(angle));
            }}
          />
          <Figure spec={wave} maxWidth={440} label={t('Sinus rozvinutý do grafu', 'Sine unrolled into a graph')} />
        </div>
      }
      controls={
        <>
          <Param
            name={'\\alpha'}
            value={deg}
            min={0}
            max={360}
            step={snap ? 15 : 1}
            onChange={setDeg}
            display={`${deg}°`}
          />
          <Switch checked={snap} onChange={setSnap} label={t('Přichytávat po 15°', 'Snap to 15°')} />
          <p className="text-[13px] text-ink-3">
            {t(
              'Bod na kružnici jde táhnout myší nebo prstem.',
              'The point on the circle can be dragged with the mouse or a finger.',
            )}
          </p>
        </>
      }
      readouts={
        <>
          <Readout label={t('Úhel', 'Angle')}>
            <Tex
              tex={`\\alpha = ${deg}^\\circ = ${Number.isInteger(deg) && deg % 15 === 0 ? radTex(deg) : tx(rad, t.locale, 3)}`}
            />
          </Readout>
          <Readout
            label={
              <span>
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-0.5 w-3 rounded-full align-middle"
                  style={{ background: 'var(--series-3)' }}
                />
                cos α
              </span>
            }
          >
            <Tex tex={`${exact ? `${exact.cos} \\approx ` : ''}${tx(cos, t.locale, 3)}`} />
          </Readout>
          <Readout
            label={
              <span>
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-0.5 w-3 rounded-full align-middle"
                  style={{ background: 'var(--series-2)' }}
                />
                sin α
              </span>
            }
          >
            <Tex tex={`${exact ? `${exact.sin} \\approx ` : ''}${tx(sin, t.locale, 3)}`} />
          </Readout>
          <Readout label={t.locale === 'cs' ? 'tg α' : 'tan α'}>
            {Math.abs(cos) < 1e-9 ? (
              <span className="text-ink-2">{t('není definován', 'undefined')}</span>
            ) : (
              <Tex tex={tx(sin / cos, t.locale, 3)} />
            )}
          </Readout>
          <Readout label={t('Bod', 'Point')}>
            <Tex
              tex={`P = ${t.locale === 'cs' ? '[\\cos\\alpha;\\, \\sin\\alpha]' : '(\\cos\\alpha,\\, \\sin\\alpha)'}`}
            />
          </Readout>
          <Readout label={t('Vždy platí', 'Always true')}>
            <Tex tex={`\\sin^2\\alpha + \\cos^2\\alpha = ${tx(sin * sin + cos * cos, t.locale, 3)}`} />
          </Readout>
        </>
      }
    />
  );
}

// ------------------------------------------------------------------------------- sinusoid

function Sinusoid({ compact }: ToolProps) {
  const t = useT();
  const [A, setA] = useState(1);
  const [w, setW] = useState(1);
  const [phi, setPhi] = useState(0);
  const [d, setD] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => () => void audio.current?.close(), []);

  const play = (): void => {
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    audio.current ??= new Ctor();
    const context = audio.current;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 220 * w;
    // A short fade in and out, so the tone does not click.
    const now = context.currentTime;
    const level = Math.min(0.25, 0.08 * Math.abs(A));
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.03);
    gain.gain.setValueAtTime(level, now + 0.9);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 1.05);
  };

  const spec: FigureSpec = {
    view: { xMin: -2 * Math.PI, xMax: 2 * Math.PI, yMin: -4, yMax: 4 },
    piAxis: true,
    curves: [
      { expr: 'sin(x)', color: 'muted', dashed: true },
      { expr: `${ex(A)}*sin(${ex(w)}*x + ${ex(phi)}) + ${ex(d)}`, color: 'a' },
    ],
    hlines: d !== 0 ? [{ y: d, color: 'muted', dashed: true }] : [],
  };
  const period = (2 * Math.PI) / w;
  return (
    <ToolLayout
      compact={compact}
      plot={<Figure spec={spec} label={t('Sinusoida', 'Sinusoid')} />}
      controls={
        <>
          <Param name="A" value={A} min={-3} max={3} step={0.25} onChange={(v) => setA(avoid(v, 0, 0.25))} />
          <Param name={'\\omega'} value={w} min={0.25} max={4} step={0.25} onChange={setW} />
          <Param
            name={'\\varphi'}
            value={phi}
            min={-3.14}
            max={3.14}
            step={0.157}
            onChange={setPhi}
            display={`${Math.round((phi / Math.PI) * 100) / 100}π`.replace('-', '−')}
          />
          <Param name="d" value={d} min={-2} max={2} step={0.25} onChange={setD} />
          <Button size="sm" onClick={play}>
            <Volume2 size={13} />
            {t(`Přehrát jako tón (${Math.round(220 * w)} Hz)`, `Play as a tone (${Math.round(220 * w)} Hz)`)}
          </Button>
        </>
      }
      readouts={
        <>
          <Readout label={t('Předpis', 'Formula')}>
            <Tex
              tex={`y = ${lead(A, t.locale)}\\sin(${lead(w, t.locale)}x ${tail(phi, t.locale)}) ${tail(d, t.locale)}`}
            />
          </Readout>
          <Readout label={t('Amplituda', 'Amplitude')}>
            <Tex tex={`|A| = ${tx(Math.abs(A), t.locale)}`} />
          </Readout>
          <Readout label={t('Perioda', 'Period')}>
            <Tex tex={`T = \\dfrac{2\\pi}{\\omega} \\approx ${tx(period, t.locale)}`} />
          </Readout>
          <Readout label={t('Posun ve směru x', 'Shift along x')}>
            <Tex tex={`-\\dfrac{\\varphi}{\\omega} \\approx ${tx(-phi / w, t.locale)}`} />
          </Readout>
          <Readout label={t('Obor hodnot', 'Range')}>
            <Tex
              tex={
                t.locale === 'cs'
                  ? `\\langle ${tx(d - Math.abs(A), t.locale)};\\, ${tx(d + Math.abs(A), t.locale)} \\rangle`
                  : `[${tx(d - Math.abs(A), t.locale)},\\, ${tx(d + Math.abs(A), t.locale)}]`
              }
            />
          </Readout>
          <p className="pt-2 text-[13px] text-ink-2">
            {t(
              'Tón: ω určuje výšku (dvojnásobné ω je o oktávu výš), A hlasitost. Fázi samotnou ucho neslyší.',
              'As a tone: ω sets the pitch (double ω is an octave up), A the loudness. Phase alone is inaudible.',
            )}
          </p>
        </>
      }
    />
  );
}

// -------------------------------------------------------------------------------- complex

function ComplexPlane({ preset, compact }: ToolProps) {
  const t = useT();
  const [mode, setMode] = useState<'add' | 'multiply'>(str(preset, 'mode', 'add') === 'multiply' ? 'multiply' : 'add');
  const [z, setZ] = useState({ re: 2, im: 1 });
  const [w, setW] = useState({ re: 1, im: 2 });
  const grabbed = useRef<'z' | 'w' | null>(null);
  const result =
    mode === 'add'
      ? { re: z.re + w.re, im: z.im + w.im }
      : { re: z.re * w.re - z.im * w.im, im: z.re * w.im + z.im * w.re };
  const mod = (c: { re: number; im: number }): number => Math.hypot(c.re, c.im);
  const arg = (c: { re: number; im: number }): number => (Math.atan2(c.im, c.re) * 180) / Math.PI;
  const algebraic = (c: { re: number; im: number }): string => {
    if (c.im === 0) return tx(c.re, t.locale);
    if (c.re === 0) return `${lead(c.im, t.locale)}\\mathrm{i}`;
    return `${tx(c.re, t.locale)} ${tailTerm(c.im, '\\mathrm{i}', t.locale)}`;
  };
  const spec: FigureSpec = {
    view: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 },
    aspect: 0.75,
    circles: mode === 'multiply' ? [{ cx: 0, cy: 0, r: 1, color: 'muted', dashed: true }] : [],
    segments: [
      { from: [0, 0], to: [z.re, z.im], color: 'a' },
      { from: [0, 0], to: [w.re, w.im], color: 'b' },
      { from: [0, 0], to: [result.re, result.im], color: 'c' },
      ...(mode === 'add'
        ? [
            {
              from: [z.re, z.im] as [number, number],
              to: [result.re, result.im] as [number, number],
              color: 'muted' as const,
              dashed: true,
            },
            {
              from: [w.re, w.im] as [number, number],
              to: [result.re, result.im] as [number, number],
              color: 'muted' as const,
              dashed: true,
            },
          ]
        : []),
    ],
    points: [
      { x: z.re, y: z.im, color: 'a', label: 'z' },
      { x: w.re, y: w.im, color: 'b', label: 'w' },
      { x: result.re, y: result.im, color: 'c', label: mode === 'add' ? 'z + w' : 'z · w', hollow: true },
    ],
  };
  const snap = (v: number): number => Math.max(-7.5, Math.min(7.5, Math.round(v * 2) / 2));
  return (
    <ToolLayout
      compact={compact}
      plot={
        <Figure
          spec={spec}
          label={t(
            'Komplexní rovina — body z a w lze táhnout',
            'The complex plane — the points z and w can be dragged',
          )}
          onPointer={(point, phase) => {
            if (phase === 'down')
              grabbed.current =
                Math.hypot(point.x - z.re, point.y - z.im) <= Math.hypot(point.x - w.re, point.y - w.im) ? 'z' : 'w';
            const next = { re: snap(point.x), im: snap(point.y) };
            if (grabbed.current === 'z') setZ(next);
            else if (grabbed.current === 'w') setW(next);
            if (phase === 'up') grabbed.current = null;
          }}
        />
      }
      controls={
        <>
          <Segmented
            label={t('Operace', 'Operation')}
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'add', label: t('sčítání', 'addition') },
              { value: 'multiply', label: t('násobení', 'multiplication') },
            ]}
          />
          <p className="text-[13px] text-ink-3">
            {t('Táhni body z a w. Přichytávají se po polovinách.', 'Drag the points z and w. They snap to halves.')}
          </p>
        </>
      }
      readouts={
        <>
          <Readout label="z">
            <Tex tex={`${algebraic(z)} \\;\\; |z| = ${tx(mod(z), t.locale)},\\; ${tx(arg(z), t.locale, 0)}^\\circ`} />
          </Readout>
          <Readout label="w">
            <Tex tex={`${algebraic(w)} \\;\\; |w| = ${tx(mod(w), t.locale)},\\; ${tx(arg(w), t.locale, 0)}^\\circ`} />
          </Readout>
          <Readout label={mode === 'add' ? 'z + w' : 'z · w'}>
            <Tex
              tex={`${algebraic(result)} \\;\\; ${tx(mod(result), t.locale)},\\; ${tx(arg(result), t.locale, 0)}^\\circ`}
            />
          </Readout>
          <p className="pt-2 text-[13px] text-ink-2">
            {mode === 'add'
              ? t(
                  'Sčítání je skládání posunů: výsledek je čtvrtý vrchol rovnoběžníku.',
                  'Addition composes shifts: the result is the fourth corner of the parallelogram.',
                )
              : t(
                  `Násobení je otočení a natažení: velikosti se násobí (${plain(mod(z), 'cs')} · ${plain(mod(w), 'cs')}), úhly sčítají (${Math.round(arg(z))}° + ${Math.round(arg(w))}°).`,
                  `Multiplication is a turn and a stretch: the moduli multiply (${plain(mod(z), 'en')} · ${plain(mod(w), 'en')}), the angles add (${Math.round(arg(z))}° + ${Math.round(arg(w))}°).`,
                )}
          </p>
        </>
      }
    />
  );
}

// -------------------------------------------------------------------------------- grapher

const DEFAULT_VIEW = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };

function Grapher({ preset, compact }: ToolProps) {
  const t = useT();
  const [exprs, setExprs] = useState<string[]>([str(preset, 'expr', 'x^2 - 3'), '', '']);
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const parsed = exprs.map((expr) =>
    expr.trim() === '' ? null : tryParse(expr, { decimalComma: false, variables: ['x'] }),
  );
  const colors = ['a', 'b', 'c'] as const;
  const spec: FigureSpec = {
    view,
    curves: exprs.flatMap((expr, index) => (parsed[index]?.ok ? [{ expr, color: colors[index]! }] : [])),
  };
  const zoom = (factor: number): void => {
    const cx = (view.xMin + view.xMax) / 2;
    const cy = (view.yMin + view.yMax) / 2;
    const hw = ((view.xMax - view.xMin) / 2) * factor;
    const hh = ((view.yMax - view.yMin) / 2) * factor;
    if (hw < 0.05 || hw > 5000) return;
    setView({ xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh });
  };
  return (
    <ToolLayout
      compact={compact}
      plot={
        <Figure
          spec={spec}
          label={t('Graf — tažením se posouvá', 'Graph — drag to pan')}
          onPointer={(point, phase) => {
            if (phase === 'down') {
              drag.current = point;
              return;
            }
            if (phase === 'up') {
              drag.current = null;
              return;
            }
            const start = drag.current;
            if (!start) return;
            // Keep the grabbed point under the pointer.
            const dx = start.x - point.x;
            const dy = start.y - point.y;
            setView((v) => ({ xMin: v.xMin + dx, xMax: v.xMax + dx, yMin: v.yMin + dy, yMax: v.yMax + dy }));
          }}
        />
      }
      controls={
        <>
          {exprs.map((expr, index) => {
            const result = parsed[index];
            return (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-0.5 w-4 shrink-0 rounded-full"
                    style={{ background: `var(--series-${index + 1})` }}
                  />
                  <span className="shrink-0 text-sm">
                    <Tex tex={`${['f', 'g', 'h'][index]}(x) =`} />
                  </span>
                  <TextInput
                    value={expr}
                    onChange={(event) =>
                      setExprs((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                    }
                    placeholder={index === 0 ? 'x^2 - 3' : index === 1 ? 'abs(x) - 1' : 'sin(x)'}
                    spellCheck={false}
                    autoCapitalize="off"
                    className="font-mono"
                    aria-label={`${['f', 'g', 'h'][index]}(x)`}
                  />
                </div>
                {result && !result.ok && (
                  <div className="mt-1 pl-7 text-xs text-ink-3">
                    {t('Tomuhle zápisu nerozumím', 'I cannot read this')} ({result.error.code})
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-1">
            <IconButton label={t('Přiblížit', 'Zoom in')} onClick={() => zoom(0.6)}>
              <Plus size={16} />
            </IconButton>
            <IconButton label={t('Oddálit', 'Zoom out')} onClick={() => zoom(1 / 0.6)}>
              <Minus size={16} />
            </IconButton>
            <IconButton label={t('Výchozí pohled', 'Reset the view')} onClick={() => setView(DEFAULT_VIEW)}>
              <RotateCcw size={15} />
            </IconButton>
          </div>
          <p className="text-[13px] text-ink-3">
            {t('Zápis: ', 'Syntax: ')}
            <code>x^2</code>, <code>sqrt(x)</code>, <code>abs(x)</code> {t('nebo', 'or')} <code>|x|</code>,{' '}
            <code>sin(x)</code>, <code>2^x</code>, <code>log(x)</code>, <code>ln(x)</code>, <code>pi</code>.{' '}
            {t('V předpisech se píše desetinná tečka.', 'Formulas use a decimal point.')}
          </p>
        </>
      }
    />
  );
}

// ------------------------------------------------------------------------------- registry

const TOOLS: Record<LabToolName, (props: ToolProps) => JSX.Element> = {
  grapher: Grapher,
  transform: Transform,
  linear: Linear,
  quadratic: Quadratic,
  absolute: Absolute,
  power: Power,
  inverse: Inverse,
  explog: ExpLog,
  unitcircle: UnitCircle,
  sinusoid: Sinusoid,
  complex: ComplexPlane,
};

export const isLabTool = (value: string | undefined): value is LabToolName => value !== undefined && value in TOOLS;

export function LabTool({ tool, preset, compact }: { tool: LabToolName; preset?: Preset; compact?: boolean }) {
  const Tool = TOOLS[tool];
  return <Tool preset={preset} compact={compact} />;
}
