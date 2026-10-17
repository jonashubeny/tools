# Lemma

A self-hosted mathematics laboratory for one learner: the second-year syllabus of a Czech
IT-focused secondary school, taught for understanding, with a model of what you actually
know, a log of the errors you actually make, and a long view towards studying at FIT VUT.
Whoever runs it can give friends [accounts of their own](#accounts); each of them is then
that one learner, with data nobody else sees.

An account can instead prepare for the Czech unified
[entrance examination](#entrance-examinations) in mathematics, with a placement test, an
adaptive choice of every next problem and practice tests in the examination's format —
and whoever tutors that learner can be given a [teacher's view](#teaching) of their work.

It is not a course platform and not a quiz game. The thing it optimises is the next useful
piece of work: what to do today, why that, and what the evidence says about how well you
know it.

- **Learn** — concepts with five ways of explaining *why* (intuitive, formal, visual,
  algebraic, IT), short lessons that ask before they tell, and an interactive Math Lab.
- **Practise** — generated problems with typed answers (`2x^2 - 3`, `{-1; 3}`,
  `(-inf; 2>`, `5pi/6`, `-1 + sqrt(3) i`), progressive hints and worked solutions.
- **Know where you stand** — a mastery level per skill that asks for evidence: unaided,
  mixed with other topics, after a delay, on hard problems. Ten easy examples are not
  mastery.
- **Error Lab** — every wrong answer is classified (slip, procedure, concept), trends are
  tracked, and targeted drills are built from your own mistakes.
- **Mock exams**, a non-punishing activity heatmap and streak, a skill tree, analytics,
  missions, an optional AI tutor that never decides whether an answer is right, and a
  dated, sourced view of what FIT VUT currently asks for.
- **Entrance examinations** — primary and lower-secondary mathematics as the official
  specification lists it, weighed by what past papers asked for; a placement test; a next
  problem chosen for a stated reason; readiness told as several statements, never as a
  chance of being admitted.
- **Teaching** — for a tutor: what each student understands, what is in the way and what
  to do next; assignments; a mode for the lesson itself; notes the student cannot see.

The interface is in Czech and English. All data stays in one SQLite file on your server.

> **State of the project.** Working software with tests, not a finished product. What is
> done, what is thin and what is missing is listed honestly in
> [`docs/roadmap.md`](docs/roadmap.md#current-state).

## Requirements

To run it:

| What | Needed |
|---|---|
| Container engine | Docker Engine with the Compose plugin — `docker compose version` should answer with v2 or newer. Podman with `podman-compose` works as well. |
| Machine | Anything that runs Linux containers on x86-64. 64-bit ARM should work — the image carries the SQLite driver's arm64 binary — but has not been tried. 32-bit ARM (an older Raspberry Pi OS) will not: the driver has no binary for it. |
| Memory | About 250 MB while running: 190 MB idle after a start, 245 MB at the most in a test with four accounts, two of them with seventy days of history. Building the image peaks at about 530 MB, in the dependency install, so have 1 GB free for the first start. |
| Disk | About 250 MB for the image, and about 650 MB in all while it is being built. The data is small: 2 MB for 750 solved problems, and fifteen times that with the daily backups. |
| Network | Only for the build: the Node base image from Docker Hub and about 80 MB of packages from the npm registry. Running needs no outside connection — nothing is loaded from a CDN. The AI tutor and the GitHub/Forgejo view call out, and only once you configure them. |
| Port | One TCP port on the host: 8000, or whatever `LEMMA_PORT` says. |
| Browser | Chrome 111, Safari 16.4, Firefox 128, or newer — the baseline of Tailwind CSS 4, which the interface is built with. It has been looked at in Chromium only. |

To work on the code: Node 22.12 or newer with npm, and about 300 MB for `node_modules`. No
compiler is needed; the SQLite driver comes prebuilt.

The numbers were measured on the development machine (2 cores, 4 GB of memory). Lemma has
been run there with Podman 5.8.7, `podman-compose` 1.6.0 and Docker Compose 5.6.0; Docker
Engine itself has not run it yet, and [`docs/roadmap.md`](docs/roadmap.md#current-state)
says what that leaves untested.

## Quick start

Everything below is run in this directory, the one with `compose.yaml`.

```sh
cp .env.example .env
$EDITOR .env                      # set LEMMA_PASSWORD (at least 8 characters)
docker compose up -d --build
```

Open <http://localhost:8000> and sign in with the password. The first build takes a few
minutes; later starts take a second. That password is the administrator's: the account
that exists from the first start, and the only one that can [create others](#accounts).

**That address answers on the Docker host itself and nowhere else.** By default the port
is published on the host's `127.0.0.1` only, so that nothing is exposed by accident. To
open Lemma from another device, set `LEMMA_BIND=0.0.0.0` in `.env`, run
`docker compose up -d` again and use `http://<address of the host>:8000` — or, better, put
it behind HTTPS as described below. The app's log says which of the two applies, and
`LEMMA_PORT` moves it off 8000 if something else on the host already has that port.

Start with a plain password — letters, digits, `-`, `_`, `.` — and change it to anything
you like in Settings: inside `.env`, `$` and `#` have a meaning of their own
([`.env.example`](.env.example) has the details).

Podman works as well, with `podman-compose` in place of `docker compose`; see
[Rootless Podman](#rootless-podman). On Fedora and RHEL the `docker` command itself may be
Podman's `podman-docker` wrapper: if `docker --version` answers `podman version …`, that
section is the one for you.

```sh
docker compose logs -f            # JSON lines, one per event
docker compose ps                 # shows "healthy" once /healthz answers
docker compose down               # stops it; your data stays in the volume
```

### If the build cannot download

The build installs about 80 MB of packages from the npm registry. When that step ends in
`npm error network read ETIMEDOUT`, or another network error, the connection between
Docker's build containers and the internet gave way on that host — the checkout is fine.

1. **Run the same command again.** What was downloaded is kept between builds, and each
   build makes three attempts that only fetch what is still missing.
2. **If it keeps failing, build on the host's own network**, which goes around Docker's
   bridge, and start the result:

   ```sh
   docker build --network host -t lemma:local .
   docker compose up -d --no-build
   ```

3. **To find the cause**, try one download both ways. If only the first of these fails,
   it is the bridge network — a common reason is an MTU of 1500 on `docker0` where the
   host's uplink allows less (`ip link` shows both).

   ```sh
   docker run --rm node:22-bookworm-slim npm pack typescript --pack-destination /tmp
   docker run --rm --network host node:22-bookworm-slim npm pack typescript --pack-destination /tmp
   ```

## Configuration

Everything is set in `.env`; [`.env.example`](.env.example) documents every variable.
Only the password is required.

| Variable | Default | Purpose |
|---|---|---|
| `LEMMA_PASSWORD` | — | The administrator's password, read **once** on first start and then stored hashed. Change it later in Settings. |
| `LEMMA_BIND`, `LEMMA_PORT` | `127.0.0.1`, `8000` | Where the container is published on the host. |
| `COOKIE_SECURE`, `TRUST_PROXY` | `0` | Set both to `1` behind HTTPS (reverse proxy or tunnel). |
| `LEMMA_TIMEZONE`, `DAY_START_HOUR` | `Europe/Prague`, `4` | When a study day begins — a session after midnight still counts for the evening. |
| `BACKUP_KEEP` | `14` | Number of daily backups kept; `0` switches them off. |
| `ANTHROPIC_API_KEY` or `OPENAI_BASE_URL` | — | Switches the optional AI tutor on (see below). |
| `GITHUB_USERNAME`, `FORGEJO_*` | — | Optional: shows your public contribution counts beside the maths activity. |

### Forgotten password

The administrator's: put a new password in `LEMMA_PASSWORD`, add `LEMMA_PASSWORD_RESET=1`,
restart once, then remove that line again. The administrator is signed out everywhere.
Whoever can edit `.env` on the server owns the instance anyway, so this is deliberately the
only way back in. A user's: the administrator sets a new one in Settings.

## Accounts

There is always one account, the **administrator**: the name `admin` and the password from
`LEMMA_PASSWORD`. An instance with nobody else signs in with the password alone, exactly
as a single-user Lemma does.

The administrator can create more accounts in **Settings → Users**: a name and a first
password, to be passed on and changed by its owner. From then on the sign-in page asks for
a name as well. The same panel gives a user a new password, or removes the account.

- **A user is a learner, not a second administrator.** They get the whole application —
  plan, practice, exams, Error Lab, settings, their own export — and nothing of anybody
  else's: no shared progress, no leaderboard, no list of who else is here.
- **Every account has a database of its own** (see [Your data](#your-data)), so one
  learner's work cannot leak into another's, and each has separate daily backups.
- **The AI tutor runs on your API key**, so a new account does not get it until you switch
  it on for that account in the same panel.
- **Your integrations stay yours.** `GITHUB_USERNAME`, the tokens and the Forgejo settings
  from `.env` apply to the administrator only. A user may name their own GitHub account;
  a Forgejo address, which makes the server call a host, is the administrator's to set.
- **Removing an account** signs it out at once and moves its data to
  `/data/users/.deleted/<name>-<time>/`. Nothing is erased until you delete that directory.

A name has 2 to 32 characters: lower-case letters, digits, dots, dashes and underscores.
`AUTH_DISABLED=1` leaves one learner, the administrator, and no use for other accounts.

## Entrance examinations

Every account has a **goal**. The default is the second-year syllabus, and an account that
keeps it sees Lemma as it always was. The other goals are the three variants of the
unified entrance examination in mathematics (*jednotná přijímací zkouška*): for four-year
fields (written in grade 9), six-year grammar schools (grade 7) and eight-year grammar
schools (grade 5). A new account chooses on its first page; **Settings → Goal** changes it
later, and so can the learner's teacher. Nothing is lost by switching: the log is kept, and
each goal reads from it what belongs to it.

With an examination goal the application is a different one:

- **A placement test** first — at most 18 problems, no hints, nothing marked until the
  end. It can be skipped; then everything starts from the basics.
- **Today** proposes one adaptive session. Each problem in it is chosen when it is asked:
  what the examination weighs most and you know least, what is due for review, what an
  error pattern points at, what a weak prerequisite is holding back. The problem says why
  it was chosen.
- **Curriculum map** — every skill of the examination with its state (not started,
  diagnosed, learning, practising, consolidating, mastered, needs review), the rule
  behind the state, the official requirement it covers, and what past papers asked of it.
- **Practice tests** in the examination's structure: the same answer fields, formats,
  points and bundles, a time limit, and a report by skill.
- **Readiness** — how much of the examination has been practised, how much is known, how
  much is remembered, how a timed test went, and what is in the way. Each part appears
  only once there is enough behind it. There is no single score and no probability.

What this rests on, and how far it goes, is in
[`docs/cermat-coverage.md`](docs/cermat-coverage.md), which is generated from the data.
Three limits are worth knowing before relying on it:

- **Geometric constructions cannot be done on a screen.** They are about a tenth of every
  test. Lemma lists them, counts them out of its figures, and says so on the practice
  test; they have to be practised on paper.
- **The weights are Lemma's reading of past papers**, not something the examination's
  authors publish: twenty papers were read for the four-year variant, four each for the
  other two, whose weights are therefore marked provisional.
- **Dates and rules are a snapshot** of the official site on 9 October 2026, for the
  examination of spring 2027. The application asks for them to be checked again after
  1 February 2027. The official source is [prijimacky.cermat.cz](https://prijimacky.cermat.cz).

No task, figure or answer of an official test is in Lemma. The problems are its own.

## Teaching

In **Settings → Users** the administrator can name, for each account, who teaches it —
the administrator or any other account. A teacher then has a **Students** page:

- **Each student at a glance**: this week and the week before, readiness, what needs
  attention (no placement test yet, days without practice, a skill that is stuck, a
  recurring error, guessing, leaning on hints, an assignment overdue), and one suggested
  next step with its reason.
- **One student in detail**: every skill with its state and evidence, the solutions the
  student actually submitted with time, hints and attempts, recurring errors, placement
  and practice tests.
- **Things to set**: the goal and the examination date; an assignment (practice of chosen
  skills, a review, the repair of one skill, a lesson, a practice test), which goes to the
  top of the student's plan; a skill to come back to.
- **Side by side**: two or more students, skill by skill. No ranking and no total.
- **A tutoring session**: before it, what to check and what to teach; during it, problems
  to show on a shared screen with the answer one click away, and a mark of how each went;
  after it, what was covered, what was hard, homework, and a note for next time.
- **Private notes** about a student, optionally tied to a skill.

Four rules hold, and the tests check each of them:

- A teacher sees only the accounts they were named for. The administrator is nobody's
  teacher by default — creating an account does not open its work.
- A learner can read in Settings who sees their work.
- Notes and session records are stored with the teacher. Nothing a student can ask for
  contains them.
- Nothing a teacher does changes a mastery level. Problems solved together in a session
  are not recorded as the student's attempts; an assignment or a noted difficulty only
  changes what is selected next.

## Putting it on the network

Lemma speaks plain HTTP on one port and is meant to sit behind something that adds HTTPS.
In every case below set `COOKIE_SECURE=1` and `TRUST_PROXY=1` in `.env`.

**Caddy**

```
lemma.example.org {
    reverse_proxy 127.0.0.1:8000
}
```

**nginx**

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;              # the tutor streams its answers
}
```

**Cloudflare Tunnel** — point a public hostname at `http://localhost:8000`. Putting
Cloudflare Access in front of it is a good idea and needs no change in the app.

**Tailscale** — `tailscale serve --bg 8000` gives you HTTPS inside your tailnet.

If the address in the browser differs from the `Host` header the app receives (some proxy
set-ups rewrite it), list the public address in `ALLOWED_ORIGINS`; otherwise state-changing
requests are refused as cross-site.

## Your data

Everything personal lives in the volume `lemma-data`:

```
/data/lemma.sqlite                    the administrator's database (attempts, the event log,
                                      settings) — and the list of accounts
/data/backups/lemma-YYYY-MM-DD.sqlite one consistent copy per study day, the last 14 kept
/data/backups/lemma-before-schema-…   taken automatically before a schema migration
/data/backups/lemma-manual-…          taken with "Back up now" in Settings
/data/users/<name>/lemma.sqlite       one database for every other account,
/data/users/<name>/backups/…          each with backups of its own, on the same schedule
```

A user's database is a complete Lemma database, password included. Everything below works
for one of them with `/data/users/<name>` in place of `/data`.

The container itself is read-only and holds nothing worth keeping. The backup of a study
day is written once and never replaced, so a restore — or an accident — cannot overwrite
it.

**Copy the backups out of the volume** — while the app is running, into `./lemma-backups`:

```sh
docker compose cp lemma:/data/backups ./lemma-backups
```

**Restore a backup** — stop the app, copy the backup over the database, start again:

```sh
docker compose down
docker compose run --rm lemma cp /data/backups/lemma-2026-10-08.sqlite /data/lemma.sqlite
docker compose up -d
```

If the app did not stop cleanly beforehand (a crash, a power cut), the files
`lemma.sqlite-wal` and `lemma.sqlite-shm` are left beside the database. They belong to the
old database and have to go before the restored one is started:
`docker compose run --rm lemma rm -f /data/lemma.sqlite-wal /data/lemma.sqlite-shm`.

**Move to another machine** — copy the backups out as above and take one file along. On
the new machine, with Lemma checked out, `.env` written and the app not running:

```sh
docker compose run --rm -T lemma tee /data/lemma.sqlite < lemma-2026-10-08.sqlite > /dev/null
docker compose up -d
```

The password travels with the database; `LEMMA_PASSWORD` in the new `.env` is not used.
The other accounts are listed in the administrator's database and their data is the
`/data/users` directory, so an instance with users moves as a whole volume.

**Turn a database into an account** — somebody's own single-user Lemma, or a user's
database from another instance: put the file at `/data/users/<name>/lemma.sqlite`, then
create the user `<name>` in Settings. The account opens with that data, and with the
password you gave it there.

These one-off containers run as the same user as the app, so what they write belongs to
it. A database or data directory which that user may not write — a file copied in by root,
a host directory that Docker created — is refused at start, with a message that names the
owner and the user. If you would rather have a host directory than the named volume
(`./data:/data` in `compose.yaml`), create it yourself and give it to user 1000 before the
first start.

Settings also offers a **JSON export** of every table. The learner model is derived data:
the append-only event log is the source of truth, and "Recompute" in Settings rebuilds
every mastery level from it.

**Updating**

```sh
git pull
docker compose up -d --build
```

Migrations run on start, inside a transaction, after an automatic backup. A database
written by a *newer* Lemma is refused rather than touched.

## Rootless Podman

Lemma is developed on rootless Podman inside an unprivileged LXC container, which is about
the least permissive place a container can run. Two things can go wrong there; both have a
supported answer.

**1. Your user has no subordinate UID range.** `podman info` then shows a `uidmap` of size
1, images fail to unpack (`potentially insufficient UIDs or GIDs`), and the image's own
user does not exist inside the container.

- The proper fix, if you administer the host: give the user a range and migrate.

  ```sh
  sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 "$USER"
  podman system migrate
  ```

- Without root on the host: let the storage driver ignore ownership, and run the container
  as the namespace's root — which is your own unprivileged user on the host.

  ```ini
  # ~/.config/containers/storage.conf
  [storage]
  driver = "overlay"
  [storage.options.overlay]
  ignore_chown_errors = "true"
  ```

  ```sh
  # .env
  LEMMA_UID=0
  LEMMA_GID=0
  ```

**2. Containers cannot have their own network** (`pasta` fails because there is no
`/dev/net/tun`). Use the host-network override; the app then listens on the host directly,
still on `LEMMA_BIND:LEMMA_PORT`:

```sh
podman-compose -f compose.yaml -f compose.host-network.yaml up -d --build
```

Everything else — the read-only root filesystem, dropped capabilities, the health check,
the restart policy — works unchanged in both cases.

The commands in this README are written for Docker. With `podman-compose` they are the
same, with two differences:

- There is no `cp`. Copy the backups out through a pipe instead (this creates `./backups`):

  ```sh
  podman-compose exec -T lemma tar -C /data -cf - backups | tar -xf -
  ```

- Never leave the `--rm` out of a `run`. `podman-compose` keeps a one-off container in the
  app's pod and starts it again together with the app, so a left-over `run … cp` would
  repeat its copy at the next `up` — and put the old database back.

With the host-network override, every command needs both files:
`podman-compose -f compose.yaml -f compose.host-network.yaml …`.

## The AI tutor (optional)

Off unless you configure a provider. Nothing else depends on it.

- **Claude**: set `ANTHROPIC_API_KEY`. The default model is `claude-opus-5-5`;
  `AI_MODEL=claude-sonnet-5-5` costs less.
- **A local model**: set `OPENAI_BASE_URL` to any OpenAI-compatible server (Ollama,
  llama.cpp, LM Studio, vLLM) and `AI_MODEL` to its name. Local models get no tools, and
  the tutor says so when it cannot verify something. Inside the container `localhost` is
  the container: a server on the same machine is `http://host.docker.internal:<port>/v1`,
  and it has to listen on more than `127.0.0.1`.

The tutor is Socratic by default and has ten modes (hint only, find my mistake, oral exam,
explain it another way, …). It is never the source of truth: whether an answer is right is
decided by Lemma's own evaluator and handed to the model as a fact, and practice problems
come from the verified generators. Asking it about an open problem counts as a hint, and
it is switched off while a mock exam is running.

## Development

Node 22.12 or newer.

```sh
npm install          # see the note below
npm run dev          # API on :8000, web on :5173 with hot reload (proxied to the API)
npm test             # everything: engine, learning model, content, server
npm run typecheck    # all four packages
npm run build        # production web bundle and server bundle
npm start            # runs the built server (serves the web bundle if WEB_DIR is set)
```

`.npmrc` sets `ignore-scripts=true`. No dependency needs an install script — the SQLite
driver ships prebuilt binaries — and without the setting npm tries to rebuild that driver
from source when installing from the lockfile.

For development the server reads the same variables as the container; the handy ones are
`AUTH_DISABLED=1` and `DATA_DIR=./data`.

A few scripts make the work pleasant:

```sh
# A database with seventy days of plausible history, produced through the real API.
npx tsx scripts/dev-seed.ts ./data-demo 70

# A teacher and two fictional students preparing for entrance examinations, with weeks of
# placement tests, adaptive sessions, a tutoring session and a practice test behind them.
npx tsx scripts/dev-seed-class.ts ./data-class 24

# What a generator actually produces: prompt, answer, hints, steps, misconceptions.
npx tsx scripts/sample-problems.ts trig.unit-circle 2 cs

# Regenerate docs/cermat-coverage.md after changing the entrance concepts, the
# specification or the classified papers. A test fails while the document is stale.
npm run jpz:coverage
```

Both seed scripts refuse a data directory that already has learning data. The second one
creates accounts and prints the demonstration password it gave them — change it before
anybody else can reach such an instance.

### Layout

```
packages/core      the engine: parser and evaluator, answer checking, learning model. Pure, no I/O.
packages/content   the curriculum: concepts, lessons, generators, exams, FIT snapshots. Typed data.
packages/server    HTTP API on Hono, SQLite, the practice flow, the tutor.
packages/web       the interface: React, Vite, Tailwind, KaTeX.
scripts/           build and authoring helpers
docs/              why things are the way they are
```

### Documentation

| Document | What it answers |
|---|---|
| [`docs/product-spec.md`](docs/product-spec.md) | What Lemma is for, and what it refuses to be |
| [`docs/learning-model.md`](docs/learning-model.md) | Ability, mastery levels, review scheduling, errors, the daily plan; choosing the next skill, the placement test, path states, readiness |
| [`docs/content-model.md`](docs/content-model.md) | Concepts, generators, answer kinds, goals and examination data, quality gates, how to add content |
| [`docs/architecture.md`](docs/architecture.md) | Packages, data, security and who may see whose work, the tutor, deployment, chart rules |
| [`docs/adaptive-learning-plan.md`](docs/adaptive-learning-plan.md) | The plan the entrance-examination and teaching work followed, the sources it used, and what was built |
| [`docs/cermat-coverage.md`](docs/cermat-coverage.md) | Generated: what each examination asks for, what Lemma covers, and what it does not |
| [`docs/research.md`](docs/research.md) | Sources: learning science, FIT VUT, forge APIs — with dates |
| [`docs/roadmap.md`](docs/roadmap.md) | Phases, content plan, and the honest current state |
| [`docs/updating-fit-data.md`](docs/updating-fit-data.md) | How to refresh the FIT VUT information each year |

## Three things to keep in mind

**The entrance-examination data is a reading of official sources, with a date.** The
specification is paraphrased item by item and linked; the weight of a skill comes from
Lemma's own classification of past tasks; the facts about the examination were read on
9 October 2026. See [Entrance examinations](#entrance-examinations) for the limits.

**The syllabus is a transcription.** The seventeen chapters are the ones in the school's
thematic plan for 2026/2027 as typed in by the learner; the original document is not part
of this repository. Lemma never adds chapters to it. Logic, sets, proofs, binary numbers,
Boolean algebra and growth rates are marked as *enrichment* wherever they appear.

**The FIT VUT information is a dated snapshot.** It was read from the faculty's pages on
7 October 2026 and describes admission for 2027/2028 and the study plan for 2026/2027.
The learner this was built for would start in 2029/2030, under rules that do not exist yet
and a programme that will have been re-accredited. The app says so, shows the sources, and
asks for re-verification after a year.
