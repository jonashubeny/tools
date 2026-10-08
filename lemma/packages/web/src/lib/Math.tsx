import katex from 'katex';
import { Fragment, type ReactNode, memo } from 'react';
import { cn } from './cn';

const cache = new Map<string, string>();

function renderTex(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    // trust stays off: no \href, no raw HTML — the output is safe to insert.
    html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
    });
  } catch {
    html = '';
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, html);
  return html;
}

/** A formula. `tex` is LaTeX without delimiters. */
export const Tex = memo(function Tex({
  tex,
  display = false,
  className,
}: {
  tex: string;
  display?: boolean;
  className?: string;
}) {
  const html = renderTex(tex, display);
  if (html === '') return <code className={className}>{tex}</code>;
  return display ? (
    <div className={cn('overflow-x-auto', className)} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
});

const INLINE = /(\$\$[\s\S]+?\$\$|\$(?:\\\$|[^$\n])+?\$|\*\*(?:[^*\n]|\*(?!\*))+?\*\*|`[^`\n]+?`)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at).replaceAll('\\$', '$'));
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith('$$')) out.push(<Tex key={key} tex={token.slice(2, -2).trim()} display />);
    else if (token.startsWith('$')) out.push(<Tex key={key} tex={token.slice(1, -1)} />);
    else if (token.startsWith('**')) out.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    else out.push(<code key={key}>{token.slice(1, -1)}</code>);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last).replaceAll('\\$', '$'));
  return out;
}

function lines(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split('\n');
  return parts.flatMap((line, i) =>
    i === 0
      ? inline(line, `${keyPrefix}-${i}`)
      : [<br key={`${keyPrefix}-br-${i}`} />, ...inline(line, `${keyPrefix}-${i}`)],
  );
}

const isBullet = (line: string): boolean => /^\s*[-*•]\s+/.test(line);
const isNumbered = (line: string): boolean => /^\s*\d+[.)]\s+/.test(line);

function block(text: string, key: string): ReactNode {
  const rows = text.split('\n').filter((row) => row.trim() !== '');
  if (rows.length > 0 && rows.every(isBullet)) {
    return (
      <ul key={key}>
        {rows.map((row, i) => (
          <li key={i}>{inline(row.replace(/^\s*[-*•]\s+/, ''), `${key}-${i}`)}</li>
        ))}
      </ul>
    );
  }
  if (rows.length > 1 && rows.every(isNumbered)) {
    return (
      <ol key={key}>
        {rows.map((row, i) => (
          <li key={i}>{inline(row.replace(/^\s*\d+[.)]\s+/, ''), `${key}-${i}`)}</li>
        ))}
      </ol>
    );
  }
  return <p key={key}>{lines(text, key)}</p>;
}

/**
 * Text with mathematics. Understands `$inline$` and `$$display$$` LaTeX, `**bold**`,
 * `code`, fenced code blocks, lists and paragraphs — and nothing else: everything that is
 * not one of these is inserted as plain text, so content and model output cannot inject
 * markup.
 */
export const RichText = memo(function RichText({
  text,
  className,
  inlineOnly = false,
}: {
  text: string;
  className?: string;
  inlineOnly?: boolean;
}) {
  if (inlineOnly) return <span className={cn('prose-lemma', className)}>{inline(text, 'i')}</span>;
  const nodes: ReactNode[] = [];
  const fences = text.split(/```/);
  fences.forEach((chunk, i) => {
    if (i % 2 === 1) {
      const body = chunk.replace(/^[A-Za-z0-9#+-]*\n/, '').replace(/\n$/, '');
      nodes.push(
        <pre key={`c${i}`}>
          <code>{body}</code>
        </pre>,
      );
      return;
    }
    chunk
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/^\n+|\n+$/g, ''))
      .filter((paragraph) => paragraph.trim() !== '')
      .forEach((paragraph, j) => nodes.push(block(paragraph, `p${i}-${j}`)));
  });
  return (
    <div className={cn('prose-lemma', className)}>
      {nodes.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </div>
  );
});
