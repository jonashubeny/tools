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
| `basic` | primary and lower-secondary mathematics: the material of the unified entrance examination | Entrance examination |

Only `school` concepts have a `syllabusTopic` number, and the linter rejects any other
combination. This is how "do not silently extend the syllabus" is enforced.

The `basic` track stands on its own. Its concepts name the items of the official
specification they cover, and a prerequisite never crosses between it and the other
tracks: a learner preparing for an entrance examination is never sent to second-year
material, and the other way round. Linear equations therefore exist twice — `eqn.linear`
for somebody meeting them, `alg.linear-eq` as a foundation of the second-year syllabus —
and that is deliberate.

**What an examination tests is derived, not authored.** No concept says "this is in the
test" or "this is worth 6 %". Both follow from two sources kept in the repository in a
form that can be checked against the originals: the official specification of
requirements, item by item, and the classification of past papers, task by task (§2,
*Goal*). `docs/cermat-coverage.md` is generated from them.

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

Goal ──< Goal skill (role, weight) >── Concept (track basic) >── Specification item
  │                 ╲
  │                  derived from ── Past paper ──< Task (number, points, format, skills)
  ├── Examination facts (time, points, aids, dates) — dated, sourced
  ├── Anchors of the placement test
  └── Practice test: Exam blueprint of kind `entrance` ──< Slot
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

A `basic` concept has no syllabus topic. It has these instead:

```ts
{
  id: 'frac.operations',
  area: 'numbers',
  track: 'basic',
  spec: ['B1.1.6', 'B1.1.7'],        // items of the specification it covers; required
  prereqs: ['frac.concept', 'num.divisibility'],
  paperOnly: true,                   // only geom.constructions: cannot be done on a screen,
                                     // and is exempt from having problems
  …
}
```

`stage` (5, 7 or 9) is derived: the earliest part of the specification that lists the
concept. The order of the concepts in `concepts/basic.ts` is the teaching order, and the
placement test relies on it to find the nearest prerequisite.

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
misconceptions, signed terms, Czech counts), `trig-kit` (angles as multiples of π, exact
values), `triangle-kit`, `logic-kit` (formulas, truth tables, equivalence).

**Czech counts.** A word problem that prints a number beside a noun has to decline the
noun, and often the verb: *1 díl*, *3 díly*, *5 dílů*; *jsou potřeba 4 dvojice*, *je potřeba
7 trojic*. `plural(n, 'díl', 'díly', 'dílů')` in `helpers` does that, `zPrep(n)` chooses
between *z* and *ze* in front of a number, and the linter looks for what a template written
only for the general case produces (§4).

**Closed formats.** A generator that produces one of the examination's closed formats
carries a tag saying so: `mc5` (five options, one right), `tf` (a statement that is true or
not), `match6` (one of six options shared by a group). A slot of a practice test with
that format draws only from generators so tagged; everything untagged is a typed answer.
The tests count the options each tagged generator really produces. `tf` generators are
never used in a placement test, and what they prove is limited by design
(`learning-model.md` §4).

The generators of the `basic` track share `basic-kit` — numbers written the Czech and the
English way, the builders of five-option and true/false answers, small tables — and every
scenario in them is Lemma's own. No task, figure or number is taken from an official
test.

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
| `number` | `7`, `-3/4`, `2,5`, `2*sqrt(3)`, `pi/6`, `45°` | numeric value; `tol` for rounded answers; `unit: 'deg' \| 'rad'` for angles; `form: 'reduced'` insists on an integer or a fraction in lowest terms |
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
computation, such as `sin(5π/6)` where `1/2` was asked for. The same holds for `6/8` where
a fraction in lowest terms was asked for: the value is right, the answer is not finished,
and the learner is told so instead of being marked wrong.

Each specification also has a **chance of being guessed** (`guessChance`): one in five for
five options, one in two for a true/false statement, none for a typed answer. It is
stored with every issued problem, and the learner model trusts a right answer the less,
the easier it was to guess (`learning-model.md` §3).

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

A blueprint of kind `entrance` follows one examination instead, and belongs to one goal:

```ts
{
  id: 'jpz-9-practice',
  kind: 'entrance',
  goal: 'jpz-9',                      // only learners with this goal are offered it
  minutes: 63,                        // 70, shortened by the share of what is left out
  offScreenPoints: 5,                 // construction tasks of the real test
  slots: [
    { label: '2.1', points: 1, format: 'open', level: 2, skills: ['frac.operations'] },
    { label: '11.1', points: 0, format: 'truefalse', level: 2, bundle: 'tf',
      skills: ['data.tables-charts', 'data.mean'] },   // a part of a bundle has no points of its own
    …
  ],
  bundles: { tf: [0, 0, 2, 4], match: [0, 2, 4, 6] },   // points by the number of parts right
}
```

One slot is one answer field of the real test. The structure — how many fields, in which
format, for how many points — follows the tests of 2025 and 2026; the skills offered for
a slot are those the papers put at that place. Among a slot's skills one is drawn by its
weight in the examination, so two practice tests differ the way two terms of the real one
do. Where the real test marks the working, a screen can check only the result.

### Goal

What a learner is preparing for (`goals.ts`). The second-year syllabus is one goal and the
default; each variant of the unified entrance examination is another.

```ts
{
  id: 'jpz-9',                        // 'school-it-2' | 'jpz-9' | 'jpz-7' | 'jpz-5'
  kind: 'entrance',
  grade: 9,
  facts: { minutes: 70, points: 50, tasks: 16, open: 11, closed: 5, aids, terms, sources,
           retrievedOn: '2026-10-09', reviewAfter: '2027-02-01' },
  skills: [{ id: 'frac.operations', role: 'tested', weight: 0.0685, tasks: { read: 22, rules: 13 } }, …],
  anchors: ['frac.operations', 'num.integers', 'pct.basics', …],   // where the placement test starts
  papersRead: 20,
  provisional: false,                 // true below ten papers read
}
```

`facts` are official and dated, like the FIT snapshot: after `reviewAfter` the interface
asks for them to be read again. `skills` are computed:

- **tested** — a task of a paper that was *read* was assigned to the skill, or the
  examination's own part of the specification lists it. (Papers classified by keyword
  rules count only for skills the specification allows at that stage, and only from
  three tasks.)
- **prerequisite** — needed by a tested skill, or required by an earlier part of the
  specification, and not tested itself.
- **enrichment** — belongs to the next part of the specification: there to stretch a
  strong learner.
- **weight** — the skill's share of the points in the papers that were read, a task's
  points being split equally among the skills named for it. A tested skill that no read
  paper contained keeps a small floor (0.4 %).

The weights are Lemma's reading of the papers, not something the Centre publishes, and
they are only as good as the number of papers behind them: twenty for the four-year
examination, four each for the other two, which are therefore marked provisional
everywhere they are shown.

### Specification item and past paper

`jpz/spec.ts` holds the specification of requirements as one entry per bullet of the
official document: an id that encodes part, area and position (`C1.1.4`), and a
**paraphrase**. The wording that counts is the document's, which is linked.

`jpz/evidence-data.ts` holds one line per official test booklet:

```
M9-2026-1 read booklet /files/files/dokumenty/M9A_2026_TS.pdf | 1/3o=frac.operations+data.mean; … ; 9/3K=geom.constructions; … ; 12/2C=pct.basics; …
```

For every task: its number, its points, its format (`o` open, `K` construction, `T`
true/false bundle, `C` choice, `M` matching) and the one to three skills it was assigned
to — and nothing else. **No wording, no figure and no answer of an official task
is in the repository**; the booklets are protected, and the path leads to the official
file. `basis` says whether every task was classified by reading it (`read`) or by keyword
rules (`rules`); the header of the file says how well the rules agree with reading, which
is why weights use read papers alone.

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

For an examination goal:

| Requirement | Location |
|---|---|
| target examination | `Goal`; the learner's choice is a setting, the teacher can change it |
| official requirement behind a skill | concept `spec` → `jpz/spec.ts` → the linked document |
| tested · prerequisite · enrichment | `GoalSkill.role`, derived |
| how much the examination asks for it | `GoalSkill.weight` and `tasks`, derived from the papers |
| task format | generator tags `mc5`, `tf`, `match6`; slot `format` |
| what cannot be practised on a screen | concept `paperOnly`; blueprint `offScreenPoints` |
| coverage matrix | `docs/cermat-coverage.md`, generated by `npm run jpz:coverage` |

## 4. Quality gates

`npm run content:lint` (part of `npm test`) fails the build when:

- an ID is duplicated, or a reference points nowhere;
- the prerequisite graph has a cycle;
- a `school` concept lacks a syllabus topic, or a non-school concept has one;
- a syllabus topic has no concept, a concept has no problems, or a concept has problems
  at fewer than two levels (a `paperOnly` concept is exempt, and may have none);
- a prerequisite crosses between the `basic` track and the others, or a `basic` concept
  names no item of the specification;
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
  JavaScript string is silently reduced to `;`);
- a number formatted for mathematics ended up in prose, where its TeX would show; or a
  number reached Czech prose straight from JavaScript, with a decimal point;
- a Czech text counts wrongly: a genitive plural after 1, or after 2 to 4 where the
  genitive cannot be right — at the start of a sentence, or after a verb or a preposition
  that asks for another case (*3 dílů*, *za 4 hodin*, *je 2 trojúhelníků*). Where the
  genitive may be right (*ze 3 dílů*, *součet 4 čísel*) the check stays silent, so it has no
  false alarms and does not find every error; reading samples remains necessary.

The examination data has tests of its own (`packages/content/test/goals.test.ts`): every
paper adds up to 50 points; every task is assigned to skills that exist; every concept
names real items of the specification, and the items no concept covers are listed rather
than hidden; a goal contains the prerequisites of all its skills; a practice test adds up
to the 50 points of the real one once the construction tasks are counted, and every one
of its slots can be filled with a problem of the right skill, format and level. A further
test fails when `docs/cermat-coverage.md` no longer says what the data says.

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

For the entrance track the same steps apply, with these differences: the concept goes to
`src/concepts/basic.ts` at its place in the teaching order and names its `spec` items;
its prerequisites stay inside the track; closed-format generators carry their tag; and
after any change to the concepts, the specification or the classified papers,
`npm run jpz:coverage` regenerates the coverage document. Correcting the classification
of a paper is an edit of its line in `jpz/evidence-data.ts` — and its basis becomes `read`
only once every task of that paper has been checked against the booklet.

Writing guidance for explanations: one idea per step; ask before telling; say *why* a
manipulation is allowed, not just that it is; use an IT analogy only when it is literally
true of the mathematics.
