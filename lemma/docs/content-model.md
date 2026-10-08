# Content model

What "content" is in Lemma, how it is structured, and how to add to it.
Code: `packages/content/`. Types: `packages/core/src/content/types.ts`.

## 1. Decisions

**Content is typed TypeScript in the repository**, not rows in the database and not YAML.

- Most problems are *generated*. A generator is a function, so content has to live where
  code lives.
- The compiler checks every reference: a problem cannot point at a concept that does not
  exist, a lesson cannot omit a language.
- It is versioned, diffable and reviewable like any other source — the workflow of a docs
  contributor.
- The database stores only what the learner did, keyed by stable content IDs.

Trade-off: adding content means editing files and rebuilding the image. For one technical
owner that is the right cost. A file-based importer could be added later without changing
the model.

**IDs are permanent.** History refers to them. A concept or generator is deprecated
(`deprecated: true`), never renamed or deleted.

**Every text is bilingual**: `{ cs: string, en: string }`, written with the helper
`L(cs, en)`. Mathematics inside text uses `$…$` (inline) and `$$…$$` (display), rendered by
KaTeX.

**Provenance is explicit.** Each concept carries a `track`:

| track | meaning | shown as |
|---|---|---|
| `school` | on the official 2nd-year syllabus | School |
| `foundation` | prerequisite from earlier years, needed by the syllabus | Foundation |
| `reasoning` | logic, proof, problem-solving habits | Enrichment · reasoning |
| `vut` | preparation for first-year FIT courses | Enrichment · VUT prep |

Only `school` concepts have a `syllabusTopic` number, and the linter rejects any other
combination. This is how "do not silently extend the syllabus" is enforced.

## 2. Entities

```
Syllabus topic ──< Concept >── prerequisite ── Concept
                     │  ╲
                     │   encompasses (weighted)
                     ├──< Lesson step
                     ├──< Generator ──> Problem instance (per seed)
                     ├──< Static problem
                     ├──  Why-lenses (5)
                     ├──  Resources (textbook chapter, docs)
                     ├──  FIT relevance (course codes)
                     └──  Lab preset
Mission >── Concept          Exam blueprint >── Concept
FIT snapshot (admission rules, study plan) — dated, sourced
```

### Concept

The node of the skill tree and the unit of mastery.

```ts
{
  id: 'quad.vertex',                 // permanent
  title: L('Vrchol paraboly', 'Vertex of a parabola'),
  summary: L(…),                     // one sentence
  area: 'functions',                 // column in the tree
  track: 'school',
  syllabusTopic: 3,                  // only for track 'school'
  prereqs: ['quad.equation', 'fn.transform'],
  encompasses: [{ id: 'alg.complete-square', w: 0.5 }],
  why: { intuition, formal, visual, algebraic, it },   // each optional L
  terms: [{ cs: 'vrchol paraboly', en: 'vertex' }],
  resources: [{ kind: 'textbook', title, url }],
  fit: ['ISM', 'IMA1'],              // first-year courses it feeds
  lab: { tool: 'quadratic', preset: {…} },
  annualReview: true                 // has "basic problem types" for the year-end test
}
```

### Lesson

An ordered list of small steps for one concept. Step kinds:

| kind | purpose |
|---|---|
| `predict` | a question asked *before* the explanation; any answer continues |
| `explore` | an interactive figure with a guiding question |
| `text` | at most a few sentences |
| `worked` | a solved example revealed line by line, with optional "why is this allowed?" |
| `complete` | a worked example with the last steps left to the learner |
| `check` | a real problem from a generator or the static pool |
| `summary` | what to remember, as a short list |

### Generator

A deterministic function `(rng, level) → ProblemInstance`. The same seed always yields the
same problem; this is what makes "replay this mistake" and reproducible exams possible.

```ts
gen({
  id: 'quad.vertex.from-standard',   // permanent: stored with every issued problem
  concept: 'quad.vertex',
  kind: 'core',                      // warmup | core | hard | boss | speed | debug | reverse
                                     // | applied | programming | estimate | explain | graph
  levels: [1, 2, 3],
  title: L('Vrchol z obecného tvaru', 'The vertex from standard form'),
  tags: ['annual-review'],           // one of the chapter's basic problem types
  est: (level) => 60 + 40 * level,   // expected seconds
  make(r, level) { … return instance; },
});
```

Three rules make generators trustworthy:

1. **Answer first.** Choose the roots, the vertex, the angle — then derive the question.
   The numbers stay friendly and the canonical answer is right by construction.
2. **Check it another way.** Each instance carries `verify` specifications that the linter
   evaluates independently of the generator: the answer set must be exactly the real zeros
   of an expression, an interval exactly where an inequality holds, a value equal to an
   expression computed by a different route. Geometry is built in coordinates and measured
   there (`triangle-kit`), so a length never depends on the formula the problem is about;
   positions in the cube are computed from vectors, truth tables by evaluating the formula.
3. **Write the answer the way a person writes it.** `2 - 2i`, not `2 + -2i`; `√13`, not
   `1·√13`. The canonical answer is shown to the learner, so the linter rejects awkward
   ones.

Shared vocabulary lives in small kits next to the generators: `helpers` (steps,
misconceptions, signed terms), `trig-kit` (angles as multiples of π, exact values),
`triangle-kit`, `logic-kit` (formulas, truth tables, equivalence).

**The annual review.** A generator tagged `annual-review` is one of its chapter's basic
problem types. The tag is the single source of truth: a concept's `annualReview` flag is
derived from it, never authored, and tests require every syllabus chapter to have at
least one. Which types count as "basic" is Lemma's judgement — the syllabus only says
that such a test exists.

### Problem instance

```ts
{
  prompt: L(…),
  figure?: FigureSpec,           // optional plot, drawn by the figure kit
  answer: AnswerSpec,            // what is expected and how to check it
  hints: L[],                    // progressive, 2–4
  solution: SolutionStep[],      // { text: L, math?: string }
  misconceptions: [{ answer, error, note: L, skill? }],
  context?: { it?: boolean, applied?: boolean }
}
```

### Answer specifications

| kind | accepts | checked by |
|---|---|---|
| `number` | `7`, `-3/4`, `2,5`, `2*sqrt(3)`, `pi/6`, `45°` | numeric value; `tol` for rounded answers; `unit: 'deg' \| 'rad'` for angles |
| `expr` | `x^2-4x+3`, `2(x-1)^2+3` | equality at pseudo-random points; optional form: `expanded`, `factored`, `vertex` |
| `set` | `{-1; 3}`, `K={2}`, `x1=-1, x2=3`, `∅`, `R` | unordered comparison of values; `unit: 'rad'` for sets of angles |
| `interval` | `(-inf; 2>`, `<1;3) u (5;inf)`, `R \ {2}` | canonical union of intervals, endpoints and closedness |
| `point` | `[2; -1]`, `V[2;-1]`, `(2, -1)` | coordinate-wise; also used for pairs such as (modulus, argument) |
| `complex` | `3-2i`, `-1 + sqrt(3) i` | complex value; `form: 'algebraic'` insists on `a + bi` |
| `choice` | option id(s) | exact match; `multi` allows several correct options |
| `spot` | index of the faulty line (find-the-mistake) | exact match |
| `self` | free text | self-assessed against a rubric; half weight as evidence |

The check returns one of three verdicts — correct, incorrect, or *invalid* ("not an answer
yet", which costs nothing) — the answer as understood (typeset), and, when wrong, an
inferred error type (`learning-model.md` §6). What makes an input invalid rather than
wrong is listed in `architecture.md` §5; the important case is an answer that is still a
computation, such as `sin(5π/6)` where `1/2` was asked for.

### Static problem

Same shape as an instance, with an `id` and metadata. Used where generation adds nothing:
explanation questions, proof-like reasoning, "which approach is better", boss problems.

### Figure spec

Serialisable description of a drawing: viewport, function curves (as expression strings),
points, segments, circles, polygons with vertex names, free labels, an optional π-scaled
axis, axis names, and a preferred width. `bare: true` drops the grid and axes for pure
geometry. Rendered by the same component in lessons, problems and the Lab, so content
never contains drawing code.

### Mission

`{ id, title, brief, concepts, stack, milestones: [{ id, title, detail }], stretch }`.
Progress (checked milestones, notes, repository URL) is user data.

### Exam blueprint

`{ id, title, kind: 'chapter' | 'annual' | 'custom', concepts, items, levelMix, minutes }`.

### FIT snapshot

```ts
{
  validFor: '2027/2028',
  retrievedOn: '2026-10-07',
  reviewAfter: '2027-10-01',     // UI shows a "re-verify" banner after this date
  sources: [{ title, url }],
  facts: [{ id, text: L, source }],
  routes: [{ id, title: L, detail: L, relevance: 'high' | 'medium' | 'low' }]
}
```

Snapshots accumulate; none is edited after the fact. The newest is "current", older ones
remain as history. The procedure for adding one is in `updating-fit-data.md`.

## 3. Metadata the brief asked for, and where it lives

| Requirement | Location |
|---|---|
| topic, subtopic | concept → `syllabusTopic`, `area`; concept itself is the subtopic |
| difficulty | generator `levels`; instance generated at a level |
| prerequisites | concept `prereqs` |
| skill | concept id |
| estimated time | generator `estSeconds(level)` |
| answer, solution, hints, common errors | instance `answer`, `solution`, `hints`, `misconceptions` |
| tags | generator `tags`, `kind` |
| school relevance | concept `track`, `syllabusTopic`, `annualReview` |
| FIT relevance | concept `fit` (course codes) |
| IT relevance | instance `context.it`; concept `why.it` |
| review priority | derived at runtime from retention, not authored |

## 4. Quality gates

`npm run content:lint` (part of `npm test`) fails the build when:

- an ID is duplicated, or a reference points nowhere;
- the prerequisite graph has a cycle;
- a `school` concept lacks a syllabus topic, or a non-school concept has one;
- a syllabus topic has no concept, a concept has no problems, or a concept has problems
  at fewer than two levels;
- a syllabus chapter has no problem type tagged for the annual review;
- a text is missing a language;
- a FIT fact has no listed source, or a course link is not a course card;
- a generator, for 40 seeds at each declared level:
  - throws, or is not deterministic for a fixed seed;
  - produces an answer its own evaluator rejects (in either decimal notation);
  - fails one of its independent `verify` specifications;
  - writes its canonical answer awkwardly (`x + -3`, `1x`, `1√2`, `+ 0i`);
  - produces a misconception that equals the right answer, repeats another one, or
    cannot be read at all;
  - has fewer than two hints or an empty solution;
  - emits LaTeX that KaTeX cannot parse, or shows the artefacts of careless string
    building (`+ -3`, `undefined`, an unbalanced `$`);
- a hand-written table is false: every trigonometric simplification must equal the
  function it names at several angles, every Boolean law must hold on every row of the
  truth table;
- a content source file contains a single-backslash TeX spacing command (`\;` inside a
  JavaScript string is silently reduced to `;`).

The generator group is the important one: it is the automated answer to "can the app mark
a correct answer wrong?".

What the linter cannot judge is whether a problem is *worth solving* and reads well. For
that there is no substitute for reading the output:

```sh
npx tsx scripts/sample-problems.ts trigeq.basic 3 cs
```

Every generator in the repository was read this way, and most of the wording fixes, the
degenerate cases that were removed and several of the lint rules above came from that
reading, not from the tests.

## 5. Adding content

1. Add the concept to `src/concepts/<area>.ts`; set `track` honestly — only what is in the
   school's plan is `school`.
2. Write at least two generators in `src/generators/`, covering at least two levels, with
   misconceptions for the errors you actually expect and `verify` specifications for the
   answer. Tag the chapter's basic type `annual-review`. Register the list in
   `src/index.ts`.
3. Read what they produce (`scripts/sample-problems.ts`) in both languages. Fix what
   reads badly; a problem that passes the linter can still be a bad problem.
4. Optionally add a lesson (`src/lessons*.ts`): predict, explore in the Lab, a worked
   example with reasons, two check problems, a summary.
5. `npm test`, bump `CONTENT_VERSION` in `src/index.ts`.
6. Rebuild: `docker compose up -d --build`.

Writing guidance for explanations: one idea per step; ask before telling; say *why* a
manipulation is allowed, not just that it is; use an IT analogy only when it is literally
true of the mathematics.
