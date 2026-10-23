import { type ReactNode, Fragment } from 'react';

/**
 * The Markdown of scenarios and resources, rendered to React elements — never through
 * innerHTML, so nothing in a text can become markup. What the content uses is supported:
 * headings, paragraphs, lists, fenced code, tables, `code`, **bold**, *italics* and links
 * (http and https only, opened in a new tab).
 */

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = key;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [token] = match;
    if (match[1]) out.push(<code key={n++} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.88em]">{token.slice(1, -1)}</code>);
    else if (match[2]) out.push(<strong key={n++}>{inline(token.slice(2, -2), n * 100)}</strong>);
    else if (match[3]) out.push(<em key={n++}>{token.slice(1, -1)}</em>);
    else if (match[4]) {
      const label = token.slice(1, token.indexOf(']'));
      out.push(
        <a key={n++} href={match[5]} target="_blank" rel="noreferrer noopener">
          {label}
        </a>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!);
      i++;
      blocks.push(
        <pre key={key++} className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed">
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(
        <div key={key++} className={level <= 2 ? 'text-base font-semibold' : 'text-sm font-semibold'}>
          {inline(heading[2]!)}
        </div>,
      );
      i++;
      continue;
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3}/.test(lines[i + 1]!)) {
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) body.push(cells(lines[i++]!));
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th key={c} className="border-b border-border px-2 py-1.5 text-left font-medium text-ink-2">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border-b border-border px-2 py-1.5 align-top">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const listItem = /^\s*(-|\d+\.)\s+(.*)$/;
    if (listItem.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && listItem.test(lines[i]!)) items.push(listItem.exec(lines[i++]!)![2]!);
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={key++} className={ordered ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}>
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !/^(```|#{1,4}\s|\s*(-|\d+\.)\s|\s*\|)/.test(lines[i]!)) paragraph.push(lines[i++]!);
    if (paragraph.length === 0) paragraph.push(lines[i++]!);
    blocks.push(<p key={key++}>{inline(paragraph.join(' '))}</p>);
  }
  return (
    <div className={className ?? 'space-y-3 text-sm leading-relaxed'}>
      {blocks.map((block, n) => (
        <Fragment key={n}>{block}</Fragment>
      ))}
    </div>
  );
}
