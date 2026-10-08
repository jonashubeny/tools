/**
 * Authoring aid: print what a generator actually produces.
 *
 *   npx tsx scripts/sample-problems.ts <generator-id | concept-id | prefix> [count=3] [locale=cs]
 *
 * The linter proves that answers are consistent; only reading the output shows whether a
 * problem is well worded and worth solving.
 */
import { type Level, type Locale, answerToTex, createRng, mixSeed, pick } from '@lemma/core';
import { GENERATORS } from '../packages/content/src/index';

const [, , query, countArg, localeArg] = process.argv;
if (!query) {
  console.error('usage: tsx scripts/sample-problems.ts <generator-id | concept-id | prefix> [count] [cs|en]');
  process.exit(2);
}
const count = Number(countArg ?? 3);
const locale: Locale = localeArg === 'en' ? 'en' : 'cs';
const matches = GENERATORS.filter((g) => g.id === query || g.concept === query || g.id.startsWith(query));
if (matches.length === 0) {
  console.error(`no generator matches "${query}"`);
  process.exit(1);
}

for (const generator of matches) {
  for (const level of generator.levels) {
    for (let seed = 1; seed <= count; seed++) {
      const instance = generator.generate(createRng(mixSeed(generator.id, level, seed)), level as Level);
      const answer = instance.answer;
      console.log(
        `\n── ${generator.id} · level ${level} · seed ${seed} · ${generator.kind} · ~${Math.round(generator.estSeconds(level as Level))} s`,
      );
      console.log(`Q: ${pick(instance.prompt, locale)}`);
      if (answer.kind === 'choice') {
        for (const option of answer.options)
          console.log(`   ${answer.correct.includes(option.id) ? '●' : '○'} ${pick(option.text, locale)}`);
      } else if (answer.kind === 'spot') {
        answer.lines.forEach((line, index) =>
          console.log(`   ${index === answer.wrongLine ? '✗' : ' '} ${index + 1}. ${line.tex}`),
        );
      } else if (answer.kind === 'self') {
        console.log(`A (model): ${pick(answer.model, locale)}`);
      } else {
        console.log(`A: ${'label' in answer && answer.label ? `${answer.label} ` : ''}${answerToTex(answer, locale)}`);
      }
      instance.hints.forEach((hint, index) => console.log(`   hint ${index + 1}: ${pick(hint, locale)}`));
      instance.solution.forEach((s, index) =>
        console.log(
          `   step ${index + 1}: ${pick(s.text, locale)}${s.math === undefined ? '' : `   [ ${typeof s.math === 'string' ? s.math : pick(s.math, locale)} ]`}`,
        ),
      );
      for (const m of instance.misconceptions ?? [])
        console.log(`   wrong "${m.answer}" → ${m.error}: ${pick(m.note, locale)}`);
    }
  }
}
