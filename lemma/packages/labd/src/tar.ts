/**
 * The smallest tar writer that a build context needs: regular files, ustar headers.
 * A build context for a lab image is one Containerfile, so nothing more is called for.
 */

const BLOCK = 512;

function header(name: string, size: number, mtime: number): Buffer {
  const block = Buffer.alloc(BLOCK, 0);
  const field = (value: string, offset: number, length: number): void => {
    block.write(value, offset, Math.min(length, Buffer.byteLength(value)), 'utf8');
  };
  const octal = (value: number, offset: number, length: number): void =>
    field(value.toString(8).padStart(length - 1, '0'), offset, length - 1);
  if (Buffer.byteLength(name) > 100) throw new Error(`tar: name too long: ${name}`);
  field(name, 0, 100);
  octal(0o644, 100, 8);
  octal(0, 108, 8);
  octal(0, 116, 8);
  octal(size, 124, 12);
  octal(mtime, 136, 12);
  block.fill(0x20, 148, 156); // checksum is computed with its own field as spaces
  field('0', 156, 1);
  field('ustar\u0000', 257, 6);
  field('00', 263, 2);
  let sum = 0;
  for (const byte of block) sum += byte;
  field(`${sum.toString(8).padStart(6, '0')}\u0000 `, 148, 8);
  return block;
}

export function tar(files: { name: string; content: Buffer }[], mtime = 0): Buffer {
  const parts: Buffer[] = [];
  for (const file of files) {
    parts.push(header(file.name, file.content.length, mtime), file.content);
    const pad = (BLOCK - (file.content.length % BLOCK)) % BLOCK;
    if (pad > 0) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return Buffer.concat(parts);
}
