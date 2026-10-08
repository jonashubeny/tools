# Product specification

**Lemma** — Jonas's mathematical engineering laboratory.

A *lemma* is a proven statement whose purpose is to get you to a bigger theorem. That is
what this year's mathematics is for.

## 1. Who it is for

One person: a 16-year-old second-year IT student with real sysadmin and open-source
experience, who gets 2–3 in maths when he studies, loses most of his marks to careless
errors rather than missing understanding, learns from *why* and from experiments, and
wants to enter and survive FIT VUT Brno.

Designing for one known user is the product's main advantage. It allows decisions a
general learning platform cannot make:

- It assumes a technical reader. Explanations use programming and systems analogies
  without apologising, and the interface is dense.
- It treats **careless errors as the primary training target**, not as noise.
- It knows the destination. FIT publishes what it expects (see `research.md` §2.4), so
  "is this useful later?" has a sourced answer.

## 2. What it must achieve

In order of priority when they conflict:

1. **Better school results this year.** The syllabus drives the default path; nothing else
   may bury it.
2. **Fewer careless errors**, measurably.
3. **Understanding over procedure** — being able to say why a method works and to pick a
   method without being told which chapter the problem is from.
4. **A habit that survives a bad week.**
5. **Long-term readiness for FIT**: reasoning, logic, discrete structures, the
   mathematical side of programming.

## 3. Product principles

1. **Guide, don't catalogue.** The home screen proposes one session and says why. The
   catalogue exists, one click away.
2. **Evidence, not completion.** Nothing is ever "done". A skill has a level, the level has
   stated requirements, and the screen shows which are missing.
3. **Mistakes are data.** A wrong answer opens a short loop — what kind of error, try
   again, see it resurface later — instead of a red mark and the solution.
4. **Thinking before telling.** Hints are progressive and cost credit; the tutor asks
   before it explains; lessons ask for a prediction before the explanation.
5. **Honest numbers.** Every figure shown has a defined meaning. FIT data carries its source
   and date. Enrichment is labelled as enrichment.
6. **The learner decides.** Every recommendation can be skipped or replaced. No lock-in,
   no nagging, no guilt.
7. **Built to last.** One container, one database file, content in version control.

## 4. The experience

### Today (home)

Answers, without scrolling: what to do now, why, where the current topic stands, what is
weak, how the long-term goal is moving, what was accomplished recently.

- **Session plan** for a chosen time budget (15 / 30 / 45 / 60 min). Blocks: *review* →
  *current topic* → *challenge* → *error drill* → optional *experiment*. Each block has a
  one-line reason derived from the learner's state.
- **Focus card**: the current school chapter, level per skill, and the specific evidence
  still missing for the next level.
- **Weak spots**: the lowest relevant skills and the dominant error type.
- **Activity heatmap** (53 weeks), consistency and streak.
- **Trajectory**: coverage of the mathematics FIT's own bridging seminar covers.
- **Recent**: level changes, records, corrected errors.

### Learning a concept

A concept page has four parts:

- **Lesson** — five to ten short steps: predict, explore (interactive figure), explain,
  worked example with fading, check. No step is more than a few sentences.
- **Why?** — five lenses on the same idea: intuition, formal definition, picture, algebra,
  IT connection. The IT lens is omitted when there is no honest connection.
- **Practice** — adaptive problems for this skill.
- **Links** — prerequisites, what it unlocks, the school textbook chapter, Lab preset,
  related mission.

### Solving a problem

Free input wherever possible: numbers, expressions, solution sets, intervals, points,
complex numbers. Multiple choice only where the choice *is* the skill (which method, which
graph, which line contains the error).

- Input is typed as text (`x^2-4x+3`, `<1; 3)`, `K={-1; 3}`) and typeset live, so the
  learner sees how it was understood before submitting.
- Czech and English notation are both accepted.
- A wrong answer shows the inferred error type and offers a second attempt. Hints go from
  "what kind of object is this?" to a concrete intermediate step. The full solution is
  the last resort and is recorded as such.
- After an error the learner confirms or corrects the classification with one click.

### Error Lab

The differentiating feature. Shows which error types occur most, in which topics, whether
each is trending down, and the actual past mistakes. From any error type it starts a
**targeted drill**: problems dense in that trap plus "find the mistake" items of the same
kind. Any past mistake can be replayed exactly.

### School mode

The 17 syllabus topics in order, each with its skills, level, textbook chapter and
practice. The learner marks the current chapter and enters test dates. A dated test
changes the daily plan: mixed retrieval on the test's topics, a timed mock a few days
before, error review the day before. The **annual review test** has its own mode — the
basic problem types of every chapter covered so far, mixed.

### Exam simulation

Timed, no hints, no feedback until the end, mixed topics. The report shows score, result
per skill, time per item against expectation, a slips-versus-concepts breakdown, and a
ranked list of what to practise next.

### Skill tree

The prerequisite graph, laid out automatically, coloured by level, dimmed where memory is
predicted to have faded. Clicking a node opens the concept. A weak prerequisite of the
current topic is flagged on the node that depends on it.

### Math Lab

A sandbox of interactive tools: function grapher with parameters, transformation explorer,
quadratic explorer, absolute-value builder, exponential/logarithm pair, unit circle,
sinusoid builder, complex plane. Lessons deep-link into the Lab with presets.

### FIT roadmap

Four stages — school mathematics, reasoning, VUT foundations, admission — each mapped to
skills in the tree. Two things are kept visibly apart:

- **Current official information**: the admission snapshot and the first-year course list,
  each with source link, academic year and retrieval date, plus a warning when stale.
- **Long-term preparation**: what Lemma recommends building regardless of how the rules
  change.

### Missions

Engineering tasks that need mathematics: a quadratic visualiser in C#, a server-load
model, a complex-number library, a raycaster. Each has a brief, milestones, the concepts
it exercises and a place for the repository link. Done outside the app; tracked inside.

### Tutor

An optional AI tutor with ten modes (Socratic, explain simply, explain formally, hint,
check my solution, find my mistake, challenge me, connect to programming, connect to real
life, oral exam). It defaults to questions. It never decides whether an answer is correct —
the evaluator does. It can be backed by Claude or by any OpenAI-compatible endpoint,
including a local model; with none configured the rest of the app is unaffected.

### Analytics

Accuracy, level distribution, retention, time per problem, slip rate and concept-error
rate over time, review success, consistency — with trend statements such as "sign errors:
18 % → 7 % over six weeks".

## 5. Motivation design

The feeling to produce is "I am getting better", so the rewards are facts about
competence:

- **Levels with requirements.** Reaching *proficient* means something specific.
- **The heatmap** scores meaningful work; clicks and time alone score nothing.
- **Consistency over streak.** The headline is "active days in the last 28". The streak is
  shown too, with rest days earned by work and applied automatically. A declared break
  (holiday, illness) pauses everything.
- **Records and milestones**, stated plainly: first mastered skill, a week under 5 % slips,
  a boss problem solved without hints.
- **No** XP, coins, lives, leagues, mascots, confetti, push notifications or loss-framed
  messages.

## 6. Language

Interface and content are **bilingual, Czech and English**, switchable at any time.

Why both: school tests, the maturita and FIT are in Czech, and their notation differs from
English conventions (`⟨a; b)`, decimal comma, `tg`, `K = {…}`). Practising in English and
performing in Czech adds a translation step exactly where careless errors happen. The
brief, however, was written in English and asks for a developer-tool feel, and English
mathematical vocabulary is worth having. So: either language for reading, both notations
for writing, Czech terms always available.

## 7. Deliberately out of scope

- Multi-user features, classes, teachers, sharing.
- A general content-management interface. Content is authored in the repository.
- Automatic grading of free-text proofs. Explanation questions are self-assessed against a
  rubric, or discussed with the tutor.
- Scraping or reproducing third-party exercises.
- Mobile apps. The web interface is responsive.

## 8. How success will be judged

Measured inside the app:

- Slip rate (errors on skills the model rates as strong) falling.
- Mixed-context accuracy approaching blocked-practice accuracy.
- Review success ≥ 85 % at growing intervals.
- Consistency ≥ 16 of 28 days, sustained.
- Every taught syllabus topic at *proficient* before its test.

Measured outside: test marks, and whether the learner opens it without being reminded.
