# Lemma

A self-hosted mathematics laboratory for one learner: the second-year syllabus of a Czech
IT-focused secondary school, taught for understanding, with a model of what you actually
know, a log of the errors you actually make, and a long view towards studying at FIT VUT.

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

The interface is in Czech and English. All data stays in one SQLite file on your server.

> **State of the project.** Working software with tests, not a finished product. What is
> done, what is thin and what is missing is listed honestly in
> [`docs/roadmap.md`](docs/roadmap.md#current-state).

## Quick start

You need Docker Engine with the Compose plugin — `docker compose version` should answer
with v2 or newer. Nothing else.

```sh
cp .env.example .env
$EDITOR .env                      # set LEMMA_PASSWORD (at least 8 characters)
docker compose up -d --build
```

Open <http://localhost:8000> and sign in with the password. The first build takes a few
minutes; later starts take a second.

Start with a plain password — letters, digits, `-`, `_`, `.` — and change it to anything
you like in Settings: inside `.env`, `$` and `#` have a meaning of their own
([`.env.example`](.env.example) has the details).

Podman works as well, with `podman-compose` in place of `docker compose`; see
[Rootless Podman](#rootless-podman). On Fedora and RHEL the `docker` command itself may be
Podman's `podman-docker` wrapper: if `docker --version` answers `podman version …`, that
section is the one for you.

The container is published on `127.0.0.1` only. To reach it from other devices on your
network, set `LEMMA_BIND=0.0.0.0` in `.env` and run `docker compose up -d` again — or,
better, put it behind HTTPS as described below.

```sh
docker compose logs -f            # JSON lines, one per event
docker compose ps                 # shows "healthy" once /healthz answers
docker compose down               # stops it; your data stays in the volume
```

## Configuration

Everything is set in `.env`; [`.env.example`](.env.example) documents every variable.
Only the password is required.

| Variable | Default | Purpose |
|---|---|---|
| `LEMMA_PASSWORD` | — | Sign-in password, read **once** on first start and then stored hashed. Change it later in Settings. |
| `LEMMA_BIND`, `LEMMA_PORT` | `127.0.0.1`, `8000` | Where the container is published on the host. |
| `COOKIE_SECURE`, `TRUST_PROXY` | `0` | Set both to `1` behind HTTPS (reverse proxy or tunnel). |
| `LEMMA_TIMEZONE`, `DAY_START_HOUR` | `Europe/Prague`, `4` | When a study day begins — a session after midnight still counts for the evening. |
| `BACKUP_KEEP` | `14` | Number of daily backups kept; `0` switches them off. |
| `ANTHROPIC_API_KEY` or `OPENAI_BASE_URL` | — | Switches the optional AI tutor on (see below). |
| `GITHUB_USERNAME`, `FORGEJO_*` | — | Optional: shows your public contribution counts beside the maths activity. |

### Forgotten password

Put a new password in `LEMMA_PASSWORD`, add `LEMMA_PASSWORD_RESET=1`, restart once, then
remove that line again. Every session is signed out. Whoever can edit `.env` on the server
owns the instance anyway, so this is deliberately the only way back in.

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
/data/lemma.sqlite                    the database (attempts, the event log, settings)
/data/backups/lemma-YYYY-MM-DD.sqlite one consistent copy per study day, the last 14 kept
/data/backups/lemma-before-schema-…   taken automatically before a schema migration
/data/backups/lemma-manual-…          taken with "Back up now" in Settings
```

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

Two scripts make content work pleasant:

```sh
# A database with seventy days of plausible history, produced through the real API.
npx tsx scripts/dev-seed.ts ./data-demo 70

# What a generator actually produces: prompt, answer, hints, steps, misconceptions.
npx tsx scripts/sample-problems.ts trig.unit-circle 2 cs
```

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
| [`docs/learning-model.md`](docs/learning-model.md) | Ability, mastery levels, review scheduling, errors, the daily plan |
| [`docs/content-model.md`](docs/content-model.md) | Concepts, generators, answer kinds, quality gates, how to add content |
| [`docs/architecture.md`](docs/architecture.md) | Packages, data, security, the tutor, deployment, chart rules |
| [`docs/research.md`](docs/research.md) | Sources: learning science, FIT VUT, forge APIs — with dates |
| [`docs/roadmap.md`](docs/roadmap.md) | Phases, content plan, and the honest current state |
| [`docs/updating-fit-data.md`](docs/updating-fit-data.md) | How to refresh the FIT VUT information each year |

## Two things to keep in mind

**The syllabus is a transcription.** The seventeen chapters are the ones in the school's
thematic plan for 2026/2027 as typed in by the learner; the original document is not part
of this repository. Lemma never adds chapters to it. Logic, sets, proofs, binary numbers,
Boolean algebra and growth rates are marked as *enrichment* wherever they appear.

**The FIT VUT information is a dated snapshot.** It was read from the faculty's pages on
7 October 2026 and describes admission for 2027/2028 and the study plan for 2026/2027.
The learner this was built for would start in 2029/2030, under rules that do not exist yet
and a programme that will have been re-accredited. The app says so, shows the sources, and
asks for re-verification after a year.
