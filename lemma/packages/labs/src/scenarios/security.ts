import { L } from '@lemma/core';
import type { ScenarioDef } from '../types';
import { writeFile } from './apps';

/** World- or group-writable / -readable bits of a file, tested in shell arithmetic. */
const modeHasNone = (file: string, bits: string): string => `[ $(( 0$(stat -c %a ${file}) & ${bits} )) -eq 0 ]`;

// ------------------------------------------------------------------- insecure permissions

export const insecurePermissions: ScenarioDef = {
  id: 'insecure-permissions',
  version: 1,
  title: L('Audit oprávnění', 'A permissions audit'),
  summary: L('Najděte místa, kudy by se běžný uživatel dostal k rootovi nebo k tajemstvím.', 'Find the ways an ordinary user could become root or read secrets.'),
  briefing: L(
    'Před předáním serveru `app` jinému týmu máte udělat rychlý audit oprávnění. Předchozí správce měl ve zvyku „dočasně“ povolovat věci, aby mu něco fungovalo. Najděte soubory, které běžnému uživateli umožní získat práva roota nebo číst tajné údaje, a opravte je — bez toho, abyste rozbili noční report (`nightly-report.timer`).',
    'Before handing the server `app` to another team, you are to do a quick permissions audit. The previous administrator liked to allow things "temporarily" to get something working. Find files that would let an ordinary user gain root or read secrets, and fix them — without breaking the nightly report (`nightly-report.timer`).',
  ),
  category: 'security',
  difficulty: 3,
  faults: 4,
  skills: ['sec.permissions', 'linux.permissions'],
  prerequisites: ['linux.permissions'],
  objectives: [
    L('Hledat soubory podle oprávnění pomocí find', 'Search files by permission with find'),
    L('Poznat, proč je SUID kopie běžného nástroje nebezpečná', 'Recognise why a SUID copy of a common tool is dangerous'),
    L('Opravit oprávnění, ne funkci', 'Fix the permission, not the function'),
  ],
  estimatedMinutes: 25,
  requires: ['systemd'],
  machines: [{ name: 'app', image: 'base', memoryMb: 192, cpus: 0.5 }],
  provision: [
    {
      machine: 'app',
      label: 'a server with a nightly report',
      script:
        writeFile('/usr/local/bin/nightly-report.sh', '#!/bin/sh\n# Nightly usage report, run as root by nightly-report.timer\ndf -h > /var/log/nightly-report.txt\nuptime >> /var/log/nightly-report.txt', '0755') +
        writeFile('/etc/systemd/system/nightly-report.service', '[Unit]\nDescription=Nightly usage report\n\n[Service]\nType=oneshot\nExecStart=/usr/local/bin/nightly-report.sh') +
        writeFile('/etc/systemd/system/nightly-report.timer', '[Unit]\nDescription=Run the nightly report\n\n[Timer]\nOnCalendar=*-*-* 03:00:00\n\n[Install]\nWantedBy=timers.target') +
        writeFile('/etc/app/secrets.env', 'DB_USER=app\nDB_PASSWORD=lab-only-not-a-real-secret', '0600') +
        `useradd -m -s /bin/bash intern
systemctl daemon-reload
systemctl enable --now nightly-report.timer
`,
    },
  ],
  fault: [
    {
      machine: 'app',
      label: 'four "temporary" shortcuts',
      script: `chmod 0777 /usr/local/bin/nightly-report.sh
install -d /usr/local/sbin
cp /usr/bin/find /usr/local/sbin/fsearch
chmod 4755 /usr/local/sbin/fsearch
cp /etc/shadow /var/backups/shadow.bak
chmod 0644 /var/backups/shadow.bak
chmod 0644 /etc/app/secrets.env
`,
    },
  ],
  checks: [
    {
      id: 'root-script',
      machine: 'app',
      label: L('Skript spouštěný rootem nemůže měnit nikdo jiný', 'Nobody else can change a script that root runs'),
      script: modeHasNone('/usr/local/bin/nightly-report.sh', '022'),
      mistake: 'writable-root-script',
      failHint: L('Některý skript spouštěný rootem je zapisovatelný pro skupinu nebo ostatní.', 'A script run by root is writable by group or others.'),
    },
    {
      id: 'suid',
      machine: 'app',
      label: L('Žádné nečekané SUID soubory', 'No unexpected SUID files'),
      script: `! find /usr/local /opt /srv /var /home /tmp -xdev -type f -perm -4000 2>/dev/null | grep -q .`,
      mistake: 'suid-binary',
      failHint: L('Mimo systémové adresáře je stále soubor se SUID bitem.', 'A file with the SUID bit is still outside the system directories.'),
    },
    {
      id: 'shadow-copy',
      machine: 'app',
      label: L('Kopie /etc/shadow není čitelná pro ostatní', 'No copy of /etc/shadow is readable by others'),
      script: `[ ! -e /var/backups/shadow.bak ] || ${modeHasNone('/var/backups/shadow.bak', '044')}`,
      mistake: 'exposed-secret',
      failHint: L('Někde leží čitelná kopie hashů hesel.', 'A readable copy of the password hashes is lying around.'),
    },
    {
      id: 'secrets',
      machine: 'app',
      label: L('Tajné údaje aplikace čte jen root', 'Only root can read the application secrets'),
      script: modeHasNone('/etc/app/secrets.env', '044'),
      mistake: 'exposed-secret',
      failHint: L('Soubor s hesly aplikace je čitelný pro ostatní.', 'The application’s password file is readable by others.'),
    },
    {
      id: 'report-intact',
      machine: 'app',
      label: L('Noční report dál funguje', 'The nightly report still works'),
      script: 'test -x /usr/local/bin/nightly-report.sh && systemctl is-enabled --quiet nightly-report.timer && systemctl start nightly-report.service',
      timeoutSec: 15,
      mistake: 'collateral-damage',
      failHint: L('Report už nejde spustit, nebo jeho časovač není povolený.', 'The report can no longer run, or its timer is not enabled.'),
    },
  ],
  selfTest: [{ machine: 'app', label: 'reference fix', script: 'chmod 0755 /usr/local/bin/nightly-report.sh\nrm -f /usr/local/sbin/fsearch /var/backups/shadow.bak\nchmod 0600 /etc/app/secrets.env\n' }],
  hints: [
    {
      level: 1,
      text: L(
        'Hledejte tři druhy problémů: co spouští root a mohou to měnit ostatní; programy se SUID bitem, které tam nemají co dělat; a soubory s tajemstvími čitelné pro všechny.',
        'Look for three kinds of problem: what root runs that others can change; programs with the SUID bit that have no business having it; and files with secrets that everybody can read.',
      ),
    },
    {
      level: 2,
      text: L(
        '`find` umí hledat podle oprávnění: `-perm -4000` (SUID), `-perm -o+w` (zapisovatelné pro ostatní), `-perm -o+r` (čitelné). Co spouští root, zjistíte u časovačů: `systemctl list-timers` a `systemctl cat`.',
        '`find` can search by permission: `-perm -4000` (SUID), `-perm -o+w` (writable by others), `-perm -o+r` (readable). What root runs is listed by the timers: `systemctl list-timers` and `systemctl cat`.',
      ),
      commands: ['find / -xdev -type f -perm -4000 2>/dev/null', 'find / -xdev -type f -perm -o+w 2>/dev/null | grep -v ^/proc', 'systemctl list-timers', 'ls -l /etc/app /var/backups'],
    },
    {
      level: 3,
      text: L(
        '`chmod 755 /usr/local/bin/nightly-report.sh`; smazat `/usr/local/sbin/fsearch` (SUID kopie `find` — `fsearch . -exec /bin/sh -p \\;` dá komukoli shell roota); smazat `/var/backups/shadow.bak` (nebo `chmod 600`); `chmod 600 /etc/app/secrets.env`.',
        '`chmod 755 /usr/local/bin/nightly-report.sh`; delete `/usr/local/sbin/fsearch` (a SUID copy of `find` — `fsearch . -exec /bin/sh -p \\;` gives anyone a root shell); delete `/var/backups/shadow.bak` (or `chmod 600`); `chmod 600 /etc/app/secrets.env`.',
      ),
    },
  ],
  diagnostics: [
    { id: 'find-suid', label: L('Hledání SUID souborů', 'Searching for SUID files'), pattern: 'find\\s.*-perm\\s+(-|/)?(u\\+s|4000|-4000)' },
    { id: 'find-writable', label: L('Hledání zapisovatelných souborů', 'Searching for writable files'), pattern: 'find\\s.*-perm\\s+.*(o\\+w|002|-002|/o=w)' },
    { id: 'timers', label: L('Co spouští root (časovače)', 'What root runs (timers)'), pattern: 'list-timers|systemctl\\s+cat' },
    { id: 'stat', label: L('Kontrola oprávnění (ls -l / stat)', 'Inspecting permissions (ls -l / stat)'), pattern: 'ls\\s+-[a-z]*l|stat\\s' },
  ],
  solution: L(
    '```sh\nfind / -xdev -type f -perm -4000 2>/dev/null     # /usr/local/sbin/fsearch\nfind / -xdev -type f -perm -o+w 2>/dev/null      # nightly-report.sh\nfind /etc /var/backups -type f -perm -o+r -name \'*shadow*\' -o -name \'*secret*\'\nchmod 755 /usr/local/bin/nightly-report.sh\nrm /usr/local/sbin/fsearch /var/backups/shadow.bak\nchmod 600 /etc/app/secrets.env\n```',
    '```sh\nfind / -xdev -type f -perm -4000 2>/dev/null     # /usr/local/sbin/fsearch\nfind / -xdev -type f -perm -o+w 2>/dev/null      # nightly-report.sh\nfind /etc /var/backups -type f -perm -o+r -name \'*shadow*\' -o -name \'*secret*\'\nchmod 755 /usr/local/bin/nightly-report.sh\nrm /usr/local/sbin/fsearch /var/backups/shadow.bak\nchmod 600 /etc/app/secrets.env\n```',
  ),
  explanation: L(
    'Každá z chyb je samostatná cesta k rootovi: zapisovatelný skript, který spouští root, umožní komukoli vložit do něj příkaz; SUID kopie `find` (nebo `vim`, `python`…) spustí shell s právy vlastníka; kopie `/etc/shadow` dovolí lámat hesla offline.\n\nAudit oprávnění se vyplatí dělat skriptem pravidelně — `find` s `-perm` je k tomu přesně dost.',
    'Each fault is a separate road to root: a writable script that root runs lets anyone add a command to it; a SUID copy of `find` (or `vim`, `python`…) starts a shell with its owner’s rights; a copy of `/etc/shadow` allows cracking passwords offline.\n\nA permissions audit pays off as a regular script — `find` with `-perm` is exactly enough for it.',
  ),
  resources: ['sheet-permissions', 'man-chmod', 'man-find'],
  reset: 'recreate',
  ttlMinutes: 120,
  verifiedOn: 'Debian 12 (bookworm), findutils 4.9, systemd 252',
};

// ------------------------------------------------------------------- SSH incident triage

/** Synthetic sshd and sudo lines, timestamped relative to the moment of provisioning. */
const AUTH_LOG_GENERATOR = String.raw`import random, time
random.seed(7)
now = time.time()
host = "app"
lines = []
def at(seconds_ago, text):
    lines.append((now - seconds_ago, text))
pid = [20000]
def sshd(seconds_ago, text):
    pid[0] += random.randint(1, 9)
    at(seconds_ago, f"sshd[{pid[0]}]: {text}")
# two days of ordinary life: CI deploys with a key from the office network
for day in range(2, 0, -1):
    for hour in (9, 13, 17):
        t = day * 86400 - hour * 3600
        port = random.randint(40000, 60000)
        sshd(t, f"Accepted publickey for deploy from 10.20.0.15 port {port} ssh2: ED25519 SHA256:Q2ZmYmM1ZDk3NjFhYjU0")
        sshd(t - 1, "pam_unix(sshd:session): session opened for user deploy(uid=1001) by (uid=0)")
        sshd(t - 40, "pam_unix(sshd:session): session closed for user deploy")
# an internet scanner that gives up
for i in range(6):
    sshd(30000 - i * 7, f"Invalid user oracle from 198.51.100.7 port {random.randint(40000, 60000)}")
# the brute force, ten minutes long
start = 7200
users = ["root", "admin", "test", "ubuntu", "deploy", "postgres"]
for i in range(180):
    user = users[i % len(users)]
    port = random.randint(40000, 60000)
    if user in ("root", "deploy"):
        sshd(start - i * 3, f"Failed password for {user} from 203.0.113.45 port {port} ssh2")
    else:
        sshd(start - i * 3, f"Failed password for invalid user {user} from 203.0.113.45 port {port} ssh2")
# success
sshd(start - 545, "Accepted password for deploy from 203.0.113.45 port 51234 ssh2")
sshd(start - 546, "pam_unix(sshd:session): session opened for user deploy(uid=1001) by (uid=0)")
at(start - 600, "sudo:   deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/sbin/useradd -o -u 0 -g 0 -M -d /root -s /bin/bash support")
at(start - 640, "sudo:   deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/systemctl enable --now dbus-update.service")
at(start - 700, "sudo:   deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/tee -a /home/deploy/.ssh/authorized_keys")
sshd(start - 760, "pam_unix(sshd:session): session closed for user deploy")
lines.sort()
with open("/var/log/auth.log", "w") as f:
    for t, text in lines:
        f.write(time.strftime("%Y-%m-%dT%H:%M:%S.000000+00:00", time.gmtime(t)) + f" {host} {text}\n")
`;

const LEGIT_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILabOnlyCiKeyNotARealKeyLemmaLabCiDeploy0001 deploy@ci';
const ROGUE_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILabOnlyRogueKeyNotARealKeyLemmaLab00000002 admin@laptop';

const BEACON = `#!/bin/sh
# (lab) stands in for an implant: it only writes a heartbeat, it never touches a network
while true; do date +%s >> /var/tmp/.dbus-update.state; sleep 30; done`;

export const sshBruteforceTriage: ScenarioDef = {
  id: 'ssh-bruteforce-triage',
  version: 1,
  title: L('Podezřelé přihlášení přes SSH', 'A suspicious SSH login'),
  summary: L('Z logů zjistěte, co se stalo, odstraňte perzistenci a napište zprávu.', 'Work out from the logs what happened, remove the persistence and write a report.'),
  briefing: L(
    'Na serveru `app` se v noci objevilo velké množství neúspěšných přihlášení přes SSH. Server je izolovaný, data v něm jsou **syntetická**. Zjistěte z `/var/log/auth.log`:\n\n1. odkud útok přišel,\n2. zda a ke kterému účtu se útočník dostal,\n3. co na serveru zanechal, aby se mohl vrátit.\n\nPak útočníka „vyhoďte“: odstraňte, co zanechal, a kompromitovaný účet zamkněte do výměny hesla. Legitimní klíč CI (`deploy@ci`) musí zůstat a důkazy (log) nemažte. Nakonec napište stručnou zprávu o incidentu.',
    'Overnight, a large number of failed SSH logins appeared on the server `app`. The server is isolated and the data in it is **synthetic**. Work out from `/var/log/auth.log`:\n\n1. where the attack came from,\n2. whether and into which account the attacker got,\n3. what they left behind to be able to come back.\n\nThen lock the attacker out: remove what they left, and lock the compromised account until its password is changed. The legitimate CI key (`deploy@ci`) must stay, and do not delete the evidence (the log). Finally, write a short incident report.',
  ),
  category: 'security',
  difficulty: 3,
  faults: 3,
  skills: ['sec.logs', 'sec.incident', 'linux.users'],
  prerequisites: ['linux.logs'],
  objectives: [
    L('Číst auth.log a sestavit časovou osu', 'Read auth.log and build a timeline'),
    L('Odlišit neúspěšné pokusy od skutečného průniku', 'Tell failed attempts from an actual compromise'),
    L('Najít a odstranit perzistenci', 'Find and remove persistence'),
    L('Napsat srozumitelnou zprávu o incidentu', 'Write a clear incident report'),
  ],
  estimatedMinutes: 35,
  requires: ['systemd'],
  machines: [{ name: 'app', image: 'base', memoryMb: 192, cpus: 0.5 }],
  provision: [
    {
      machine: 'app',
      label: 'users, keys and a synthetic auth.log',
      script:
        `useradd -m -u 1001 -s /bin/bash deploy
echo 'deploy:lab-only-password' | chpasswd
install -d -m 0700 /home/deploy/.ssh /var/lib/lemma-lab
echo '${LEGIT_KEY}' > /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh 2>/dev/null || true
getent shadow deploy | cut -d: -f2 > /var/lib/lemma-lab/deploy-pw
python3 - <<'PY'
${AUTH_LOG_GENERATOR}PY
`,
    },
  ],
  fault: [
    {
      machine: 'app',
      label: 'what the attacker left behind',
      script:
        `useradd -o -u 0 -g 0 -M -d /root -s /bin/bash support
echo 'support:lab-only-backdoor' | chpasswd
echo '${ROGUE_KEY}' >> /home/deploy/.ssh/authorized_keys
` +
        writeFile('/usr/local/lib/.cache/dbus-update.sh', BEACON, '0755') +
        writeFile(
          '/etc/systemd/system/dbus-update.service',
          '[Unit]\nDescription=D-Bus update helper\n\n[Service]\nExecStart=/usr/local/lib/.cache/dbus-update.sh\nRestart=always\n\n[Install]\nWantedBy=multi-user.target',
        ) +
        'systemctl daemon-reload\nsystemctl enable --now dbus-update.service\n',
    },
  ],
  checks: [
    {
      id: 'backdoor-account',
      machine: 'app',
      label: L('Jediný účet s UID 0 je root', 'root is the only account with UID 0'),
      script: `[ "$(awk -F: '$3 == 0' /etc/passwd | wc -l)" -eq 1 ] && getent passwd root >/dev/null`,
      mistake: 'persistence-left',
      failHint: L('Na serveru je další účet s právy roota.', 'There is another account with root’s rights on the server.'),
    },
    {
      id: 'persistence-service',
      machine: 'app',
      label: L('Podvržená služba neběží a nespustí se', 'The planted service is stopped and will not start'),
      script: `! systemctl is-active --quiet dbus-update.service && ! systemctl is-enabled --quiet dbus-update.service 2>/dev/null && ! pgrep -f '^/bin/sh /usr/local/lib/.cache/dbus-update' >/dev/null`,
      mistake: 'persistence-left',
      failHint: L('Útočníkův proces nebo služba je stále aktivní.', 'The attacker’s process or service is still active.'),
    },
    {
      id: 'rogue-key',
      machine: 'app',
      label: L('Útočníkův SSH klíč je pryč', 'The attacker’s SSH key is gone'),
      script: `! grep -q 'admin@laptop' /home/deploy/.ssh/authorized_keys`,
      mistake: 'persistence-left',
      failHint: L('V authorized_keys účtu deploy je stále cizí klíč.', 'A foreign key is still in deploy’s authorized_keys.'),
    },
    {
      id: 'ci-key',
      machine: 'app',
      label: L('Klíč CI zůstal', 'The CI key is still there'),
      script: `grep -qF '${LEGIT_KEY}' /home/deploy/.ssh/authorized_keys`,
      mistake: 'collateral-damage',
      failHint: L('Legitimní klíč deploy@ci zmizel.', 'The legitimate key deploy@ci is gone.'),
    },
    {
      id: 'account-locked',
      machine: 'app',
      label: L('Ukradené heslo účtu deploy už nefunguje', 'The stolen password of deploy no longer works'),
      script: `[ "$(passwd -S deploy | awk '{print $2}')" = L ] || [ "$(getent shadow deploy | cut -d: -f2)" != "$(cat /var/lib/lemma-lab/deploy-pw)" ]`,
      mistake: 'credential-not-rotated',
      failHint: L('Účet deploy má stále stejné heslo a není zamčený.', 'The deploy account still has the same password and is not locked.'),
    },
    {
      id: 'evidence',
      machine: 'app',
      label: L('Důkazy zůstaly zachované', 'The evidence is preserved'),
      script: `[ "$(grep -c 'Failed password' /var/log/auth.log)" -ge 100 ] && grep -q 'Accepted password for deploy from 203.0.113.45' /var/log/auth.log`,
      mistake: 'evidence-destroyed',
      failHint: L('/var/log/auth.log byl smazán nebo upraven.', '/var/log/auth.log was deleted or edited.'),
    },
  ],
  report: {
    prompt: L(
      'Zpráva o incidentu: co se stalo, odkud, kdy, ke kterému účtu, co útočník zanechal, co jste udělali a co doporučujete dál.',
      'Incident report: what happened, from where, when, into which account, what the attacker left, what you did and what you recommend next.',
    ),
    mustMention: [
      { id: 'source', label: L('Zdrojová IP útoku', 'The source IP of the attack'), pattern: '203\\.0\\.113\\.45' },
      { id: 'account', label: L('Kompromitovaný účet', 'The compromised account'), pattern: '\\bdeploy\\b' },
      { id: 'backdoor', label: L('Zadní vrátka: účet', 'The backdoor account'), pattern: '\\bsupport\\b' },
      { id: 'service', label: L('Perzistence: služba', 'Persistence: the service'), pattern: 'dbus-update' },
      { id: 'key', label: L('Perzistence: SSH klíč', 'Persistence: the SSH key'), pattern: 'authorized_keys|ssh[ -]?key|klíč' },
    ],
  },
  selfTest: [{ machine: 'app', label: 'reference fix', script: "systemctl disable --now dbus-update.service\nrm -f /etc/systemd/system/dbus-update.service /usr/local/lib/.cache/dbus-update.sh\nsystemctl daemon-reload\npkill -f '^/bin/sh /usr/local/lib/.cache/dbus-update' || true\nuserdel -f support\nsed -i '/admin@laptop/d' /home/deploy/.ssh/authorized_keys\npasswd -l deploy\n" }],
  hints: [
    {
      level: 1,
      text: L(
        'Tisíc neúspěšných přihlášení samo o sobě není průnik. Hledejte úspěšné přihlášení ze stejné adresy a pak to, co ten účet dělal potom.',
        'A thousand failed logins are not a compromise by themselves. Look for a successful login from the same address, and then for what that account did afterwards.',
      ),
    },
    {
      level: 2,
      text: L(
        'Spočítejte pokusy podle IP (`grep "Failed password" | awk | sort | uniq -c`), pak hledejte `Accepted` ze stejné IP a řádky `sudo:` po něm. Každý příkaz pod sudo je stopa: nový uživatel, nová služba, zápis do authorized_keys.',
        'Count attempts by IP (`grep "Failed password" | awk | sort | uniq -c`), then look for `Accepted` from the same IP and the `sudo:` lines after it. Each command run under sudo is a trace: a new user, a new service, a write to authorized_keys.',
      ),
      commands: [
        "grep 'Failed password' /var/log/auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -rn",
        "grep -E 'Accepted|sudo:' /var/log/auth.log",
        "awk -F: '$3 == 0' /etc/passwd",
        'cat /home/deploy/.ssh/authorized_keys',
        'systemctl cat dbus-update',
      ],
    },
    {
      level: 3,
      text: L(
        'Útok: hádání hesel z 203.0.113.45, úspěch u účtu `deploy`. Útočník přes sudo vytvořil účet `support` s UID 0, službu `dbus-update.service` a přidal klíč `admin@laptop` do `/home/deploy/.ssh/authorized_keys`. Náprava: `systemctl disable --now dbus-update`, smazat unit i skript, `userdel -f support` (obyčejný `userdel` odmítne: UID 0 „používá“ každý proces roota), smazat cizí řádek z authorized_keys, `passwd -l deploy`. Log nechte být.',
        'The attack: password guessing from 203.0.113.45, successful for `deploy`. Through sudo the attacker created the account `support` with UID 0, the service `dbus-update.service`, and added the key `admin@laptop` to `/home/deploy/.ssh/authorized_keys`. Remediation: `systemctl disable --now dbus-update`, delete the unit and the script, `userdel -f support` (a plain `userdel` refuses: every root process “uses” UID 0), delete the foreign line from authorized_keys, `passwd -l deploy`. Leave the log alone.',
      ),
    },
  ],
  diagnostics: [
    { id: 'count', label: L('Počty pokusů podle IP', 'Attempts counted by IP'), pattern: 'uniq\\s+-c|sort.*uniq' },
    { id: 'accepted', label: L('Hledání úspěšného přihlášení', 'Looking for the successful login'), pattern: 'grep.*Accepted' },
    { id: 'sudo', label: L('Co dělal přes sudo', 'What it did through sudo'), pattern: 'grep.*sudo' },
    { id: 'uid0', label: L('Účty s UID 0', 'Accounts with UID 0'), pattern: "\\$3\\s*==\\s*0|/etc/passwd" },
    { id: 'units', label: L('Prohlídka služeb', 'Reviewing services'), pattern: 'list-unit|systemctl\\s+(cat|status)' },
  ],
  solution: L(
    '```sh\ngrep \'Failed password\' /var/log/auth.log | grep -oE \'from [0-9.]+\' | sort | uniq -c | sort -rn\ngrep -E \'Accepted|sudo:\' /var/log/auth.log | tail\nsystemctl disable --now dbus-update.service\nrm /etc/systemd/system/dbus-update.service /usr/local/lib/.cache/dbus-update.sh; systemctl daemon-reload\nuserdel -f support\nsed -i \'/admin@laptop/d\' /home/deploy/.ssh/authorized_keys\npasswd -l deploy\n```',
    '```sh\ngrep \'Failed password\' /var/log/auth.log | grep -oE \'from [0-9.]+\' | sort | uniq -c | sort -rn\ngrep -E \'Accepted|sudo:\' /var/log/auth.log | tail\nsystemctl disable --now dbus-update.service\nrm /etc/systemd/system/dbus-update.service /usr/local/lib/.cache/dbus-update.sh; systemctl daemon-reload\nuserdel -f support\nsed -i \'/admin@laptop/d\' /home/deploy/.ssh/authorized_keys\npasswd -l deploy\n```',
  ),
  explanation: L(
    'Útočník po průniku téměř vždy zakládá **perzistenci** — několik nezávislých cest zpět (účet, klíč, služba), aby mu nestačilo zavřít jednu. Proto je postup: rozsah (co všechno udělal), zadržení (zamknout účet), odstranění (všechny cesty), obnova a teprve pak „hotovo“.\n\nLogy jsou důkaz — mazat je kvůli „úklidu“ je chyba. A skutečnou příčinou bylo přihlašování heslem k účtu s právem sudo: doporučení do zprávy je vypnout `PasswordAuthentication` a omezit sudo.\n\n(203.0.113.0/24 a 198.51.100.0/24 jsou dokumentační rozsahy z RFC 5737 — v internetu se nevyskytují.)',
    'After getting in, an attacker nearly always sets up **persistence** — several independent ways back (an account, a key, a service), so that closing one is not enough. Hence the order: scope (everything they did), containment (lock the account), eradication (every way back), recovery, and only then "done".\n\nLogs are evidence — deleting them to "tidy up" is a mistake. And the real cause was password login to an account with sudo: the report should recommend turning `PasswordAuthentication` off and narrowing sudo.\n\n(203.0.113.0/24 and 198.51.100.0/24 are documentation ranges from RFC 5737 — they do not occur on the internet.)',
  ),
  resources: ['checklist-incident', 'sheet-logs', 'link-rfc5737', 'man-sshd-config'],
  reset: 'recreate',
  ttlMinutes: 150,
  verifiedOn: 'Debian 12 (bookworm), shadow-utils 4.13, systemd 252',
};

// ------------------------------------------------------------------------- SSH hardening

export const sshHardening: ScenarioDef = {
  id: 'ssh-hardening',
  version: 1,
  title: L('Zabezpečení SSH', 'Hardening SSH'),
  summary: L('Vypněte přihlášení heslem a roota, a nezamkněte se přitom venku.', 'Turn off password and root logins without locking yourself out.'),
  briefing: L(
    'Server `bastion` je vstupní bod do sítě. Bezpečnostní audit požaduje: **žádné přihlášení roota**, **žádná hesla — jen klíče**, a přihlásit se smí jen uživatel `ops`. Klíč pro `ops` je v `/root/.lemma/ops_key`. Proveďte to tak, aby se `ops` klíčem přihlásit dál mohl (`ssh -i /root/.lemma/ops_key ops@localhost`).',
    'The server `bastion` is the entry point to the network. A security audit demands: **no root login**, **no passwords — keys only**, and only the user `ops` may log in. The key for `ops` is in `/root/.lemma/ops_key`. Do it so that `ops` can still log in with the key (`ssh -i /root/.lemma/ops_key ops@localhost`).',
  ),
  category: 'security',
  difficulty: 3,
  faults: 2,
  skills: ['sec.ssh', 'linux.users', 'linux.permissions'],
  prerequisites: ['linux.users'],
  objectives: [
    L('Změnit konfiguraci sshd a ověřit výslednou hodnotu', "Change sshd's configuration and verify the effective value"),
    L('Rozumět pořadí načítání a drop-in souborům', 'Understand load order and drop-in files'),
    L('Najít, proč klíč nefunguje', 'Find why a key does not work'),
  ],
  estimatedMinutes: 25,
  requires: ['systemd', 'multiUser'],
  machines: [{ name: 'bastion', image: 'full', memoryMb: 256, cpus: 0.5 }],
  provision: [
    {
      machine: 'bastion',
      label: 'ssh with a user and a key',
      script: `useradd -m -s /bin/bash ops
install -d -m 0700 /root/.lemma
ssh-keygen -q -t ed25519 -N '' -C ops@lab -f /root/.lemma/ops_key
install -d -m 0700 -o ops -g ops /home/ops/.ssh
install -m 0600 -o ops -g ops /root/.lemma/ops_key.pub /home/ops/.ssh/authorized_keys
systemctl enable --now ssh.service
`,
    },
  ],
  fault: [
    {
      machine: 'bastion',
      label: 'a legacy drop-in, and a careless chmod',
      script:
        writeFile('/etc/ssh/sshd_config.d/10-legacy.conf', '# Added for the migration in 2024. Remove after the migration.\nPermitRootLogin yes\nPasswordAuthentication yes') +
        `chmod 0666 /home/ops/.ssh/authorized_keys
systemctl reload ssh.service
`,
    },
  ],
  checks: [
    {
      id: 'no-root',
      machine: 'bastion',
      label: L('Root se přihlásit nemůže', 'root cannot log in'),
      script: `sshd -T -C user=root,host=lab,addr=127.0.0.1 | grep -qx 'permitrootlogin no'`,
      mistake: 'ssh-effective-config',
      failHint: L('Efektivní hodnota PermitRootLogin není „no“.', 'The effective value of PermitRootLogin is not "no".'),
    },
    {
      id: 'no-passwords',
      machine: 'bastion',
      label: L('Přihlášení heslem je vypnuté', 'Password login is off'),
      script: `sshd -T -C user=ops,host=lab,addr=127.0.0.1 | grep -qx 'passwordauthentication no' && sshd -T -C user=ops,host=lab,addr=127.0.0.1 | grep -qx 'kbdinteractiveauthentication no'`,
      mistake: 'ssh-effective-config',
      failHint: L('PasswordAuthentication nebo KbdInteractiveAuthentication není „no“.', 'PasswordAuthentication or KbdInteractiveAuthentication is not "no".'),
    },
    {
      id: 'only-ops',
      machine: 'bastion',
      label: L('Přihlásit se smí jen ops', 'Only ops may log in'),
      script: `sshd -T -C user=ops,host=lab,addr=127.0.0.1 | grep -qx 'allowusers ops'`,
      mistake: 'ssh-effective-config',
      failHint: L('AllowUsers neomezuje přihlášení na ops.', 'AllowUsers does not limit logins to ops.'),
    },
    {
      id: 'key-login',
      machine: 'bastion',
      label: L('ops se přihlásí klíčem', 'ops logs in with the key'),
      script: `systemctl is-active --quiet ssh.service && ssh -i /root/.lemma/ops_key -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=3 ops@127.0.0.1 true`,
      timeoutSec: 15,
      mistake: 'ssh-key-perms',
      failHint: L('Přihlášení klíčem jako ops selhalo.', 'Logging in as ops with the key failed.'),
    },
  ],
  selfTest: [{ machine: 'bastion', label: 'reference fix', script: "rm -f /etc/ssh/sshd_config.d/10-legacy.conf\nprintf '%s\\n' 'PermitRootLogin no' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'AllowUsers ops' > /etc/ssh/sshd_config.d/00-hardening.conf\nchmod 0600 /home/ops/.ssh/authorized_keys\nsshd -t\nsystemctl reload ssh.service\n" }],
  hints: [
    {
      level: 1,
      text: L(
        'sshd čte kromě `sshd_config` i soubory v `sshd_config.d/`, a u většiny voleb platí **první** nalezená hodnota. Ověřujte výsledek, ne to, co jste napsali.',
        'Besides `sshd_config`, sshd reads the files in `sshd_config.d/`, and for most options the **first** value found wins. Verify the result, not what you wrote.',
      ),
    },
    {
      level: 2,
      text: L(
        '`sshd -T` vypíše efektivní konfiguraci. Když klíč nefunguje, `journalctl -u ssh` ukáže důvod — sshd odmítá klíče v souborech, které může měnit někdo jiný než vlastník (StrictModes).',
        '`sshd -T` prints the effective configuration. When a key does not work, `journalctl -u ssh` shows why — sshd refuses keys in files that someone other than the owner could change (StrictModes).',
      ),
      commands: ['sshd -T | grep -E "permitroot|passwordauth|allowusers"', 'ls /etc/ssh/sshd_config.d/', 'journalctl -u ssh -n 20', 'ls -la /home/ops/.ssh'],
    },
    {
      level: 3,
      text: L(
        'Drop-in `/etc/ssh/sshd_config.d/10-legacy.conf` zapíná root i hesla a načte se dřív než vaše úpravy — smažte ho a vlastní nastavení dejte do drop-inu (např. `00-hardening.conf`): `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AllowUsers ops`. Pak `chmod 600 /home/ops/.ssh/authorized_keys`, `sshd -t` a `systemctl reload ssh`.',
        'The drop-in `/etc/ssh/sshd_config.d/10-legacy.conf` enables root and passwords and is read before your changes — delete it and put your settings in a drop-in of your own (e.g. `00-hardening.conf`): `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AllowUsers ops`. Then `chmod 600 /home/ops/.ssh/authorized_keys`, `sshd -t` and `systemctl reload ssh`.',
      ),
    },
  ],
  diagnostics: [
    { id: 'effective', label: L('sshd -T', 'sshd -T'), pattern: 'sshd\\s+-T' },
    { id: 'test', label: L('sshd -t před reloadem', 'sshd -t before a reload'), pattern: 'sshd\\s+-t' },
    { id: 'dropins', label: L('sshd_config.d', 'sshd_config.d'), pattern: 'sshd_config\\.d' },
    { id: 'journal', label: L('Log sshd', 'The sshd log'), pattern: 'journalctl.*ssh|auth\\.log' },
  ],
  solution: L(
    '```sh\nsshd -T | grep -E \'permitrootlogin|passwordauthentication\'   # yes, yes\nls /etc/ssh/sshd_config.d/                                      # 10-legacy.conf\nrm /etc/ssh/sshd_config.d/10-legacy.conf\nprintf \'%s\\n\' \'PermitRootLogin no\' \'PasswordAuthentication no\' \'KbdInteractiveAuthentication no\' \'AllowUsers ops\' > /etc/ssh/sshd_config.d/00-hardening.conf\nchmod 600 /home/ops/.ssh/authorized_keys\nsshd -t && systemctl reload ssh\nssh -i /root/.lemma/ops_key ops@localhost true\n```',
    '```sh\nsshd -T | grep -E \'permitrootlogin|passwordauthentication\'   # yes, yes\nls /etc/ssh/sshd_config.d/                                      # 10-legacy.conf\nrm /etc/ssh/sshd_config.d/10-legacy.conf\nprintf \'%s\\n\' \'PermitRootLogin no\' \'PasswordAuthentication no\' \'KbdInteractiveAuthentication no\' \'AllowUsers ops\' > /etc/ssh/sshd_config.d/00-hardening.conf\nchmod 600 /home/ops/.ssh/authorized_keys\nsshd -t && systemctl reload ssh\nssh -i /root/.lemma/ops_key ops@localhost true\n```',
  ),
  explanation: L(
    'U sshd platí pro většinu voleb první načtená hodnota, a `Include sshd_config.d/*.conf` je v Debianu hned na začátku `sshd_config`. Úprava na konci hlavního souboru proto nemusí mít žádný účinek — jedině `sshd -T` řekne, co opravdu platí.\n\nPři zpřísňování přístupu vždy nechte otevřenou jednu ověřenou relaci a novou konfiguraci zkoušejte v druhé. A `sshd -t` před reloadem.',
    'For most sshd options the first value read wins, and in Debian `Include sshd_config.d/*.conf` sits right at the top of `sshd_config`. An edit at the end of the main file may therefore have no effect at all — only `sshd -T` tells what really applies.\n\nWhen tightening access, always keep one verified session open and try the new configuration in a second one. And `sshd -t` before a reload.',
  ),
  resources: ['man-sshd-config', 'checklist-ssh-hardening', 'sheet-permissions'],
  reset: 'recreate',
  ttlMinutes: 120,
  verifiedOn: 'Debian 12 (bookworm), OpenSSH 9.2',
  untested: true,
};
