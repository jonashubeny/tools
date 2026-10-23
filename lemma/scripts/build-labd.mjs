// Bundle the lab worker (labd) into a single ES module.
//
// The workspace packages (@lemma/core, @lemma/labs) export TypeScript source, so they are
// compiled into the bundle, and so is ws. labd has no native dependency.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = await build({
  entryPoints: [path.join(root, 'packages/labd/src/main.ts')],
  outfile: path.join(root, 'packages/labd/dist/labd.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: [],
  sourcemap: true,
  legalComments: 'none',
  metafile: true,
  logLevel: 'info',
  // Bundled CommonJS dependencies expect `require`, `__filename` and `__dirname`.
  banner: {
    js: [
      "import { createRequire as __lemmaCreateRequire } from 'node:module';",
      "import { fileURLToPath as __lemmaFileURLToPath } from 'node:url';",
      "import { dirname as __lemmaDirname } from 'node:path';",
      'const require = __lemmaCreateRequire(import.meta.url);',
      'const __filename = __lemmaFileURLToPath(import.meta.url);',
      'const __dirname = __lemmaDirname(__filename);',
    ].join('\n'),
  },
});

const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
console.log(`labd bundle: ${(bytes / 1024).toFixed(0)} kB (including source map)`);
