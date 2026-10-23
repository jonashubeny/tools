import { L } from '@lemma/core';
import type { ScenarioDef } from '../types';
import { writeFile } from './apps';

const BACKUP_SCRIPT = `#!/bin/bash
# Nightly backup of the application data. Called by cron, see /etc/cron.d/app-backup.
set -euo pipefail
stamp=$(date +%Y%m%d-%H%M%S)
appdump --out /var/backups/app/app-$stamp.dump
tar -czf /var/backups/app/app-$stamp.tar.gz -C /srv app
echo "backup $stamp done"`;

const APPDUMP = `#!/bin/sh
# Writes a consistent dump of the application database.
[ "$1" = --out ] && [ -n "$2" ] || { echo "usage: appdump --out FILE" >&2; exit 2; }
cat /srv/app/*.db > "$2"`;

/** What cron runs, extracted from the cron.d line (fields 7…); run as cron would. */
const RUN_AS_CRON = `line=$(grep -Ev '^[[:space:]]*(#|$|[A-Z_]+=)' /etc/cron.d/app-backup | head -n 1)
set -- $line
[ "$6" = root ] || exit 1
shift 6
before=$(ls /var/backups/app/*.tar.gz 2>/dev/null | wc -l)
env -i HOME=/root LOGNAME=root SHELL=/bin/sh PATH=/usr/bin:/bin /bin/sh -c "$*" >/dev/null 2>&1 || exit 1
after=$(ls /var/backups/app/*.tar.gz 2>/dev/null | wc -l)
[ "$after" -gt "$before" ]`;

export const cronBackupBroken: ScenarioDef = {
  id: 'cron-backup-broken',
  version: 1,
  title: L('Záloha, která přestala běžet', 'A backup that stopped running'),
  summary: L('Noční záloha přes cron už týden nic nevytvořila.', 'The nightly cron backup has produced nothing for a week.'),
  briefing: L(
    'Na serveru `db` má každou noc běžet záloha aplikačních dat (`/usr/local/bin/app-backup`, naplánovaná v `/etc/cron.d/app-backup`). V `/var/backups/app` je ale poslední záloha týden stará. Ručně spuštěný skript prý „funguje“. Opravte to tak, aby záloha běžela z cronu.',
    'On `db`, a backup of the application data is meant to run every night (`/usr/local/bin/app-backup`, scheduled in `/etc/cron.d/app-backup`). Yet the newest backup in `/var/backups/app` is a week old. Run by hand, the script supposedly "works". Fix it so that the backup runs from cron.',
  ),
  category: 'operations',
  difficulty: 2,
  faults: 3,
  skills: ['ops.cron', 'linux.scripting', 'ops.backup'],
  prerequisites: ['linux.scripting'],
  objectives: [
    L('Číst formát /etc/cron.d', 'Read the /etc/cron.d format'),
    L('Rozumět prostředí, ve kterém cron spouští úlohy', 'Understand the environment cron runs jobs in'),
    L('Ověřit úlohu tak, jak ji spustí cron', 'Test the job the way cron will run it'),
  ],
  estimatedMinutes: 20,
  requires: ['systemd', 'multiUser'],
  machines: [{ name: 'db', image: 'full', memoryMb: 256, cpus: 0.5 }],
  provision: [
    {
      machine: 'db',
      label: 'install the backup job',
      script:
        writeFile('/opt/app/bin/appdump', APPDUMP, '0755') +
        writeFile('/usr/local/bin/app-backup', BACKUP_SCRIPT, '0755') +
        writeFile('/etc/cron.d/app-backup', '# Nightly backup of /srv/app\n30 2 * * * root PATH=/opt/app/bin:/usr/bin:/bin /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1') +
        `install -d /srv/app /var/backups/app
seq -f 'row %g' 1 200 > /srv/app/main.db
systemctl enable --now cron.service
`,
    },
  ],
  fault: [
    {
      machine: 'db',
      label: 'a tidy-up that broke it',
      script:
        // Somebody "tidied up" the cron line (dropped the user and the PATH), and a copy
        // over scp lost the executable bit.
        writeFile('/etc/cron.d/app-backup', '# Nightly backup of /srv/app\n30 2 * * * /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1') +
        `chmod 0644 /usr/local/bin/app-backup
touch -d '8 days ago' /var/backups/app
`,
    },
  ],
  checks: [
    {
      id: 'user-field',
      machine: 'db',
      label: L('Řádek v /etc/cron.d má pole uživatele', 'The /etc/cron.d line has a user field'),
      script: `grep -Ev '^[[:space:]]*(#|$|[A-Z_]+=)' /etc/cron.d/app-backup | head -n 1 | awk '{exit !($6 == "root")}'`,
      mistake: 'cron-format',
      failHint: L('Šesté pole řádku není uživatel root.', 'The sixth field of the line is not the user root.'),
    },
    {
      id: 'executable',
      machine: 'db',
      label: L('Skript zálohy je spustitelný', 'The backup script is executable'),
      script: 'test -x /usr/local/bin/app-backup',
      mistake: 'not-executable',
      failHint: L('/usr/local/bin/app-backup nemá právo spuštění.', '/usr/local/bin/app-backup is not executable.'),
    },
    {
      id: 'runs-as-cron',
      machine: 'db',
      label: L('Úloha projde i v prostředí cronu a vytvoří zálohu', 'The job succeeds in cron’s environment and makes a backup'),
      script: RUN_AS_CRON,
      timeoutSec: 30,
      mistake: 'cron-environment',
      failHint: L(
        'Kontrola spustila příkaz z cron řádku s minimálním prostředím (PATH=/usr/bin:/bin) a záloha nevznikla.',
        'The check ran the command from the cron line with a minimal environment (PATH=/usr/bin:/bin) and no backup appeared.',
      ),
    },
    {
      id: 'cron-running',
      machine: 'db',
      label: L('Démon cron běží a spustí se při startu', 'The cron daemon runs and starts at boot'),
      script: 'systemctl is-active --quiet cron.service && systemctl is-enabled --quiet cron.service',
      mistake: 'service-not-running',
      failHint: L('cron.service neběží nebo není povolený.', 'cron.service is not running or not enabled.'),
    },
  ],
  selfTest: [{ machine: 'db', label: 'reference fix', script: "chmod 0755 /usr/local/bin/app-backup\nprintf '%s\\n' '# Nightly backup of /srv/app' '30 2 * * * root PATH=/opt/app/bin:/usr/bin:/bin /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1' > /etc/cron.d/app-backup\n" }],
  hints: [
    {
      level: 1,
      text: L(
        '„Ručně to funguje“ a „z cronu ne“ se skoro vždy liší ve třech věcech: formát řádku, oprávnění a prostředí — cron nečte váš `.bashrc` a má velmi krátkou PATH.',
        '"Works by hand" but "not from cron" almost always differs in three things: the line format, permissions and the environment — cron does not read your `.bashrc` and has a very short PATH.',
      ),
    },
    {
      level: 2,
      text: L(
        'Soubory v `/etc/cron.d` mají na rozdíl od `crontab -e` šesté pole s uživatelem. Syslog (`/var/log/syslog`) nebo `journalctl -u cron` ukáže, co cron s řádkem udělal. Úlohu vyzkoušíte jako cron: `env -i PATH=/usr/bin:/bin sh -c "PŘÍKAZ"`.',
        'Unlike `crontab -e`, files in `/etc/cron.d` have a sixth field: the user. Syslog (`/var/log/syslog`) or `journalctl -u cron` shows what cron made of the line. Test the job as cron would: `env -i PATH=/usr/bin:/bin sh -c "COMMAND"`.',
      ),
      commands: ['cat /etc/cron.d/app-backup', 'ls -l /usr/local/bin/app-backup', 'journalctl -u cron -n 20', 'env -i PATH=/usr/bin:/bin sh -c /usr/local/bin/app-backup', 'type appdump'],
    },
    {
      level: 3,
      text: L(
        'Tři chyby: v řádku chybí uživatel `root`, skript ztratil právo spuštění (`chmod 755`) a `appdump` leží v `/opt/app/bin`, který v PATH cronu není. Řádek: `30 2 * * * root PATH=/opt/app/bin:/usr/bin:/bin /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1` (nebo proměnná `PATH=` na samostatném řádku souboru).',
        'Three faults: the line lacks the user `root`, the script lost its executable bit (`chmod 755`), and `appdump` lives in `/opt/app/bin`, which is not in cron’s PATH. The line: `30 2 * * * root PATH=/opt/app/bin:/usr/bin:/bin /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1` (or a `PATH=` variable on a line of its own in the file).',
      ),
    },
  ],
  diagnostics: [
    { id: 'crontab', label: L('Prohlídka cron souboru', 'Reading the cron file'), pattern: '/etc/cron\\.d|crontab' },
    { id: 'perms', label: L('Oprávnění skriptu', 'The script’s permissions'), pattern: 'ls\\s+-l|stat\\s' },
    { id: 'log', label: L('Log cronu', 'The cron log'), pattern: 'syslog|journalctl.*cron' },
    { id: 'env', label: L('Test v prostředí cronu', 'Testing in cron’s environment'), pattern: 'env\\s+-i' },
  ],
  solution: L(
    '```sh\ncat /etc/cron.d/app-backup                # chybí pole uživatele\nls -l /usr/local/bin/app-backup          # -rw-r--r--\nchmod 755 /usr/local/bin/app-backup\nenv -i PATH=/usr/bin:/bin sh -c /usr/local/bin/app-backup   # appdump: command not found\nnano /etc/cron.d/app-backup\n# 30 2 * * * root PATH=/opt/app/bin:/usr/bin:/bin /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1\n```',
    '```sh\ncat /etc/cron.d/app-backup                # no user field\nls -l /usr/local/bin/app-backup          # -rw-r--r--\nchmod 755 /usr/local/bin/app-backup\nenv -i PATH=/usr/bin:/bin sh -c /usr/local/bin/app-backup   # appdump: command not found\nnano /etc/cron.d/app-backup\n# 30 2 * * * root PATH=/opt/app/bin:/usr/bin:/bin /usr/local/bin/app-backup >> /var/log/app-backup.log 2>&1\n```',
  ),
  explanation: L(
    'Cron spouští úlohy s minimálním prostředím: krátká PATH, žádné přihlašovací skripty, žádný terminál. Co funguje ve vašem shellu, nemusí fungovat z cronu — proto se úlohy zkoušejí pomocí `env -i`.\n\nZáloha, o které nikdo neví, že neběží, je horší než žádná. V praxi patří ke každé plánované úloze kontrola: poslední úspěšný běh v monitoringu a pravidelná zkouška obnovy.',
    'cron runs jobs with a minimal environment: a short PATH, no login scripts, no terminal. What works in your shell may not work from cron — which is why jobs are tested with `env -i`.\n\nA backup that nobody knows has stopped is worse than none. In practice every scheduled job comes with a check: its last successful run in monitoring, and a regular test restore.',
  ),
  resources: ['sheet-cron', 'man-crontab-5', 'checklist-troubleshooting'],
  reset: 'recreate',
  ttlMinutes: 90,
  verifiedOn: 'Debian 12 (bookworm), cron 3.0pl1',
  untested: true,
};
