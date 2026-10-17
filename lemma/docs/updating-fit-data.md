# Updating the FIT VUT information

Lemma shows what the Faculty of Information Technology of Brno University of Technology
officially says about its bachelor's programme and its admission. That information
**changes every year**, and the version in this repository is a snapshot with a date on
it. This page explains how to make the next one.

## Why snapshots, and why they are never edited

- The admission directive is issued anew for each academic year, roughly a year ahead.
  The one in the first snapshot (No. 2/2026, approved on 22 September 2026) governs
  admission for **2027/2028**.
- The learner this was built for would start in **2029/2030**. Those rules do not exist
  yet. The programme's accreditation also ends on 25 June 2029, so the study plan itself
  will be a new one.
- An old snapshot is a record of what was true when it was read. Editing it in place would
  destroy that record and make it impossible to see *what changed*. So: a new file per
  reading, the old ones kept.

The app compares today's date with the snapshot's `reviewAfter` date and shows a notice on
the FIT page once it has passed. Nothing else breaks when a snapshot is old — it is simply
labelled as old.

## When to do it

Once a year, in **October**: the directive for the following year has usually been
approved by then, and the study plan of the current year is final. Do it again whenever
you hear that something changed (a new entrance-exam rule, a restructured first year).

## What to read

Read the **primary sources**, in Czech, on the faculty's own pages. Do not rely on
summaries, forum posts, or what an assistant "remembers".

| What | Where it was in 2026 |
|---|---|
| Programme details: length, credits, accreditation dates | `https://www.fit.vut.cz/study/program/9865/.cs` (the number changes with a new accreditation) |
| How to apply, deadlines | `https://www.fit.vut.cz/applicants/application/.cs` |
| The admission directive (PDF) | `https://www.fit.vut.cz/fit/info/smernice/` → the current year's "Pravidla přijímacího řízení" |
| First-year courses and their annotations | the study plan linked from the programme page; each course has a card at `https://www.fit.vut.cz/study/course/<id>/.cs` |
| What the faculty expects from secondary school | the card of the optional course *Matematický seminář* (ISM) — the closest thing to an official list |
| The preparatory course | `https://www.fit.vut.cz/applicants/pripravny-kurz-matematika/.cs` |
| The national comparative exams | `https://www.scio.cz/` — only if the directive still refers to them |

If a page has moved, find the new one from `https://www.fit.vut.cz/` — do not guess a URL.

## Steps

1. **Copy the latest snapshot** to a new file named after the month you are reading in:

   ```sh
   cd packages/content/src/fit
   cp snapshot-2026-10.ts snapshot-2027-10.ts
   ```

2. **Go through the new file fact by fact** with the sources open.
   - Rename the exported constant (`SNAPSHOT_2027_10`).
   - Set `admissionFor`, `studyPlanFor`, `retrievedOn` (today, ISO format) and
     `reviewAfter` (about a year later).
   - Update the `sources` list. Every fact's `source` must be one of the listed URLs —
     a test enforces it.
   - For each fact: confirm it, correct it, or delete it. Add what is new. Keep each fact
     to what the source says; if you are inferring, it is not a fact.
   - Admission routes: the directive lists them in an article of their own. `relevance`
     and `note` are **Lemma's commentary**, shown as such in the app — keep them clearly
     separate from what the directive says.
   - Courses: check that each course still exists, and its year, semester, credits and
     whether it is compulsory. Re-read its annotation: `covers` is a paraphrase of it and
     `statedPrerequisite` quotes what the card says is expected. `url` must be the
     course's own card. `prepNote` is commentary.
   - The bridge (`bridge.items`): re-read the outline of the mathematics seminar. For each
     item, `onSyllabus` says whether the school syllabus covers it, and `concepts` links it
     to skills in Lemma — that link is Lemma's reading of the outline, not the faculty's.

3. **Register it** in `packages/content/src/fit/index.ts` by appending it to
   `FIT_SNAPSHOTS`. The last entry is the current one; the earlier ones stay.

4. **Update the timeline and the roadmap** in the same file if what is known has changed:
   `FIT_TIMELINE` (for example, once a directive for the learner's own year exists) and
   the `vut` stage of `ROADMAP`, whose groups name the courses they prepare for.

5. **Record the reading** in `docs/research.md` §2: date, what was read, what changed
   since the previous snapshot.

6. **Check and ship**:

   ```sh
   npm test                         # the structure tests check dates, sources and links
   docker compose up -d --build
   ```

## Rules that keep this honest

1. **No fact without a source.** If it cannot be pointed at on the faculty's pages, it
   does not go into `facts`.
2. **Official and recommended are different things.** Roadmap stages carry a `basis`
   (`official-fit`, `school-syllabus`, `lemma-recommendation`) and the interface shows it.
   Never move something from "recommended" to "official" because it seems obviously true.
3. **Say what is unknown.** The admission rules for the learner's own year are unknown
   until the directive for that year is published. The app says so; keep it saying so.
4. **Dates everywhere.** A fact about admission without the academic year it applies to is
   worse than no fact.
5. **When the programme is re-accredited (2029)**, do not patch the course list. Read the
   new study plan and redo the mapping from courses to concepts from scratch.
