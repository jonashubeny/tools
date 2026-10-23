# Linux & Infrastructure labs

The second learning mode of Lemma: hands-on labs on real Linux machines. A learner picks
a scenario; the platform creates isolated machines, brings them into a documented initial
state, lays a fault (or a task) on top, opens a terminal in the browser, checks the
solution, records what happened, and removes or resets everything. The learner never
creates a VM, a network or a fault by hand.

This document is the design and the operations guide. The README has the short setup.

## 1. Shape

```
 browser ──HTTPS──▶ lemma (web app, unchanged container)          labd (lab worker)
   │  xterm.js         │  /api/infra/*  ── HTTP + token ──────────▶  │  fixed operations on
   └──── WebSocket ───▶│  terminal proxy ─ WS + token ────────────▶  │  reviewed scenarios
                       │  per-account SQLite (attempts, notes)       │
                       │                                             ▼
                       │                                   container engine socket
                       │                                   (Docker or Podman API)
                       │                                             │
                       │                                   lab machines: Debian 12 +
                       │                                   systemd, no network or an
                       │                                   internal one, hard limits
```

| Package | Role |
|---|---|
| `@lemma/labs` | Scenario catalog (data, reviewed like code), skills, roadmap, resource library, the learner model (pure functions). No I/O. |
| `@lemma/labd` | The lab worker: the only process that talks to the container engine. Lifecycle, limits, reaper, watchdog, terminal, capability probes, image builds, self-test. |
| `@lemma/server` | Mode setting, the attempt log, routes, the authenticated terminal proxy, teacher and administrator views. Never touches a container engine. |
| `@lemma/web` | The interface. Never imports `@lemma/labs`: check scripts and solutions stay on the server. |

### Why containers, and not KVM/libvirt

Lemma is meant to run on small self-hosted machines, often without hardware
virtualisation (an unprivileged LXC container, a VPS without nested virtualisation).
Containers with systemd as PID 1 give real services, journals, users, cron, sshd and
networks at a fraction of the memory, and start in seconds, so a reset is cheap and
reliable. What containers cannot teach — kernel modules, boot loaders, real disks and
partitions, firewalls of the host kernel itself — is left out of the catalog rather than
faked. A KVM back end would be a second implementation of the same lab operations in labd
(the scenario format does not depend on the engine); it is not built, and nothing claims
it is.

Ansible is not used to provision labs: provisioning is a few lines of shell per scenario,
run inside the machine, and an extra runtime would add nothing but weight. Ansible is a
*topic* on the roadmap (planned), not a dependency.

## 2. Security model

The web application is reachable by learners; the container engine socket is as good as
root on a rootful host. The two are kept apart:

- **Only labd holds the engine socket.** The lemma container never gets it.
- **labd's API is closed.** It is not published; lemma reaches it over the compose network
  with a shared token (`LABD_TOKEN`, compared in constant time). It has no call that runs a
  command chosen by the caller: the operations are create, status, verify, reset, touch,
  destroy and terminal, and every script they run comes from the reviewed catalog compiled
  into labd. The test suite checks that nothing else answers.
- **Every lab operation names an owner**, and a lab of another owner answers exactly like a
  missing one (404). On the lemma side, attempts live in the learner's own database, so an
  attempt id of somebody else cannot even be looked up. Both gates are tested.
- **The terminal WebSocket** checks the Origin (a WebSocket carries cookies and no CORS
  protects it), the session cookie, and the attempt in the asking account's database before
  anything is opened. The shell runs inside the lab machine; when the socket closes the
  shell gets SIGHUP.
- **Lab machines** (`packages/labd/src/spec.ts`): no network at all, or an internal network
  of their own with no route out; every capability dropped and only an ordinary userland's
  set added back (never `SYS_ADMIN`; `NET_RAW`/`NET_ADMIN` only where a scenario names
  them); `no-new-privileges`; not privileged; no host mounts or devices; memory without
  swap, a CPU share and a process limit; `/run`, `/tmp` and scenario disks as size-limited
  tmpfs; container logs off. The engine's `/etc/hosts` (which carries the host's name and
  LAN address) is overwritten inside each machine.
- **Limits** — labs at once, labs per account, total memory, disk written per machine
  (a watchdog stops a machine over it), idle time per scenario and a hard lifetime.
- **Cleanup.** A reaper removes expired labs; on every start labd reconciles its record with
  the engine and removes machines and networks it does not know, and marks labs whose
  machines vanished as failed. A failed provisioning removes what it made.
- **No AI-generated commands** are ever run. Scenario scripts are code in this repository.
- **Synthetic data only.** "Attackers" use the documentation ranges of RFC 5737; keys and
  passwords in scenarios are marked as lab-only and are not real.

A learner is root *inside* their lab machine, by design. That is a container, not the host:
with a rootless engine it maps to an unprivileged host user; with rootful Docker it is root
with the restricted capability set above. **A rootless engine is the recommended set-up.**

A lab's checks run as root inside the machine; a learner who wants to fool a check can.
That is fine for a learning tool and is not a security boundary.

## 3. Capabilities of a host

labd finds out, at start (and on "Probe again" in *Lab host*), what the host can do:

| Capability | Probe | Needed by |
|---|---|---|
| engine | the API answers `_ping` | everything |
| `multiUser` | `chown 1000` works in a container | nginx, cron, OpenSSH, sudo — the `full` image |
| `systemd` | systemd reaches `running`/`degraded` as PID 1 | most scenarios |
| `networks` | an internal network can be created and joined | multi-machine scenarios |

A scenario whose requirements are not met is shown with the reason and cannot be started;
it is never recommended. The lab images are built by labd from `packages/labd/images/*` on
first start (a few minutes, once) and tagged by a hash of their Containerfile, so a change
is rebuilt by itself.

| Host | Expected result |
|---|---|
| Docker Engine, rootful, cgroup v2 | all four |
| Rootless Podman with subordinate ID ranges | all four (networks need `pasta` or `slirp4netns`) |
| Rootless Podman **without** subuid ranges (e.g. unprivileged LXC) | `systemd` only; base image built with `LAB_SINGLE_UID=1`; 8 of 12 scenarios |
| No engine / labd not started | the mode is browsable, no lab starts |

## 4. Scenarios

A scenario (`packages/labs/src/scenarios/*.ts`) is a `ScenarioDef`:

- id, version, title, summary, briefing, category, difficulty (1–5), number of faults
- skills practised (the first is the main one) and prerequisite skills
- objectives, estimated minutes, required capabilities
- machines (image, memory, CPUs, tmpfs disks, networks, extra capabilities), networks
- `provision` — the documented initial state; `fault` — the fault or task on top
- `checks` — scripts that pass on exit 0, each with a label, the mistake it most likely
  means, and a hint shown when it fails (without the fix)
- `selfTest` — a reviewed reference fix, never shown, used only by `labd selftest`
- three levels of hints (where to look; which commands and how to read them; the fix)
- diagnostic signals recognised in the shell history (`df`, `journalctl`, `getent`, …)
- the worked solution and the post-exercise explanation
- resources, an optional incident report with required findings
- reset strategy (`recreate`: fresh machines from the image, provisioning again)
- idle lifetime, the software it was checked against, `untested` when it has not been run
  end to end yet

`lintScenarios()` (run by the tests and at labd start) refuses a catalog with unknown
skills, resources or machines, broken regular expressions, public subnets, missing hint
levels and the like; the tests also parse every script with `bash -n` and check that IP
addresses are private or from the documentation ranges.

### Adding a scenario

1. Write it in `packages/labs/src/scenarios/`, add it to `SCENARIOS` in `index.ts`.
2. `npm test -w` … or simply `npm test` — lint, script syntax, texts in both languages.
3. On a host that can run it: `npm run labs:selftest -- <id>` (with `LABD_*` set). It must
   fail before the reference fix, pass after it, fail the same way after a reset, and leave
   nothing behind. Only then remove `untested`.
4. Raise `version` whenever provisioning, the fault or a check changes.

### The catalog

| Scenario | Category | Diff. | Needs | Self-test on the dev host |
|---|---|---|---|---|
| disk-full-logs | Linux | 1 | systemd | PASS |
| disk-deleted-open-file | Linux | 2 | systemd | PASS |
| runaway-process | Linux | 2 | systemd | PASS |
| service-wont-start | Linux | 2 | systemd | PASS |
| dns-resolution | Networking | 2 | — | PASS |
| service-reachability | Networking | 3 | systemd, networks | not run (no networks there) |
| nginx-bad-gateway | Networking | 3 | systemd, multiUser | not run (single UID there) |
| cron-backup-broken | Operations | 2 | systemd, multiUser | not run (single UID there) |
| systemd-write-unit | Deployment | 2 | systemd | PASS |
| insecure-permissions | Security | 3 | systemd | PASS |
| ssh-bruteforce-triage | Security | 3 | systemd | PASS |
| ssh-hardening | Security | 3 | systemd, multiUser | not run (single UID there) |

The four that could not be run on the development host (rootless Podman in an unprivileged
LXC, no subuid ranges, no `/dev/net/tun`) are marked `untested` and the interface says so.
Run `labs:selftest` on a full Docker host to verify them.

Planned topics without a lab yet are listed on the roadmap as *planned*: subnetting, DHCP,
nftables, TLS on the proxy, restore verification, monitoring, Ansible, CI/CD, a service in a
container, an unexpected listening service, firewall exposure review.

## 5. The learner model

`packages/labs/src/learning.ts`, pure and tested. The log is `infra_attempts` in each
learner's database; everything else is derived on each request.

- **One attempt** is read as several kinds of evidence: solved or not, the highest hint
  level taken, whether the solution was shown, how many failed verifications preceded the
  solve, the share of the scenario's diagnostic commands used, and — only as a ±0.05
  nudge against the estimate — time. "Independent" means solved with at most the first,
  conceptual hint and without the solution.
- **A skill level** needs gates, not a score alone: *practising* after a solve;
  *proficient* after an independent solve; *mastered* after independent solves in two
  labs (or one of difficulty ≥ 3) **and** an independent solve a week or more after the
  previous success (retention).
- **Recurring mistakes**: each check names the mistake its failure most likely means; a
  mistake seen in two or more attempts is recurring.
- **Recommendations**, in order: an open lab; a teacher's assignment; targeted practice
  for a struggling skill (the easiest lab whose main skill it is); a skill not shown for
  two weeks (retention); then the road ahead, aimed one step above the difficulty the
  learner solves on their own — and on a roll of independent solves, multi-fault labs
  first. A lab that builds on a struggling skill, or mixes it into a harder multi-layer
  problem, waits until it has been practised (struggling with DNS holds back the
  two-machine reachability lab, and offers the DNS lab instead). Only labs this host can
  run are ever proposed.

## 6. Resources and study guides

- Links go to official documentation only (Debian manual pages for bookworm — the release
  the lab images run — nginx.org, the RFC editor, freedesktop.org); each was checked to
  exist when added, and a test keeps the list to those hosts.
- Cheat sheets and checklists are written for Lemma and say what they were checked against.
- The administrator can upload PDF guides (checked to be PDFs by their first bytes; served
  with a sandboxing CSP).
- A study guide (`/infra/guide?skill=…` or `?scenario=…`) is assembled from that content and
  from the explanations of labs the learner has solved, laid out for printing — "Save as
  PDF" in the print dialog makes the PDF. Nothing is generated by a model.

## 7. Operations

- **Start**: `docker compose --profile labs up -d --build` with `LABD_URL`, `LABD_TOKEN` and
  the socket in `.env` (README).
- **Self-test**: `docker compose --profile labs run --rm labd node labd.mjs selftest`
  runs every scenario the host can run (a few minutes) without touching live labs.
- **Backups**: lab attempts, notes and assignments are in the learners' databases and go
  with Lemma's backups. labd's own state (`labd-state` volume) is only the list of running
  labs; losing it costs the running labs and nothing else (reconciliation removes their
  machines). Lab machines are disposable by design — never keep anything in them.
- **Upgrades**: a changed Containerfile is rebuilt by labd on its next start; old image tags
  are removed after a successful build.
- **Logs**: JSON lines, like lemma's. A failed provisioning is logged with the step and the
  script's output, which the administrator also sees in *Lab host*.
