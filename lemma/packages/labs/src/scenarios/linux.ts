import { L } from '@lemma/core';
import type { ScenarioDef } from '../types';
import { INVENTORY_APP, LEDGER_APP, WEB_APP, writeFile } from './apps';

const VERIFIED = 'Debian 12 (bookworm), systemd 252, Python 3.11, coreutils 9.1';

// ---------------------------------------------------------------------------- ledger

const LEDGER_UNIT = `[Unit]
Description=Ledger records service
After=network.target

[Service]
EnvironmentFile=/etc/ledger/ledger.env
ExecStart=/usr/bin/python3 /opt/ledger/ledger.py
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

const LEDGER_ENV = `DATA_DIR=/srv/data/ledger
LOG_FILE=/srv/data/log/ledger.log
LOG_LEVEL=info
PORT=8080`;

const waitFor = (url: string, seconds = 15): string =>
  `for i in $(seq 1 ${seconds * 5}); do curl -fsS --max-time 1 ${url} >/dev/null 2>&1 && break; sleep 0.2; done\n`;

const LEDGER_PROVISION =
  writeFile('/opt/ledger/ledger.py', LEDGER_APP, '0755') +
  writeFile('/etc/ledger/ledger.env', LEDGER_ENV) +
  writeFile('/etc/systemd/system/ledger.service', LEDGER_UNIT) +
  `install -d /srv/data/ledger /srv/data/log
seq -f 'record %g' 1 500 > /srv/data/ledger/records.txt
systemctl daemon-reload
systemctl enable --now ledger.service
` +
  waitFor('http://127.0.0.1:8080/health');

/** Turn on debug logging and let a "week" of it fill /srv/data to the last byte. */
const LEDGER_FILL = `sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=debug/' /etc/ledger/ledger.env
systemctl restart ledger.service
${waitFor('http://127.0.0.1:8080/health')}python3 - <<'PY'
import errno, time
line = "{} DEBUG cache probe key={:.6f} payload=" + "x" * 400 + "\\n"
start = time.time() - 7 * 86400
with open("/srv/data/log/ledger.log", "a") as f:
    i = 0
    try:
        while True:
            t = start + i * 0.05
            f.write(line.format(time.strftime("%Y-%m-%d %H:%M:%S,000", time.localtime(t)), t))
            i += 1
            if i % 2000 == 0:
                f.flush()
    except OSError as error:
        if error.errno != errno.ENOSPC:
            raise
PY
`;

const LEDGER_CHECKS: ScenarioDef['checks'] = [
  {
    id: 'space',
    machine: 'app',
    label: L('Na /srv/data je zase místo (využití pod 50 %)', '/srv/data has room again (under 50 % used)'),
    script: `[ "$(df --output=pcent /srv/data | tail -1 | tr -dc 0-9)" -lt 50 ]`,
    mistake: 'disk-not-freed',
    failHint: L('df stále hlásí plný svazek /srv/data.', 'df still reports /srv/data as full.'),
  },
  {
    id: 'no-deleted-open',
    machine: 'app',
    label: L('Žádný proces nedrží smazaný log', 'No process holds a deleted log open'),
    script: `! find /proc/[0-9]*/fd -lname '*ledger.log (deleted)' 2>/dev/null | grep -q .`,
    mistake: 'deleted-open-file',
    failHint: L(
      'Některý proces má stále otevřený soubor, který už byl smazán — jeho místo se neuvolní.',
      'A process still has a file open that has been deleted — its space is not freed.',
    ),
  },
  {
    id: 'records',
    machine: 'app',
    label: L('Data aplikace jsou netknutá (500 záznamů)', 'The application data is intact (500 records)'),
    script: `[ "$(wc -l < /srv/data/ledger/records.txt)" -eq 500 ] && tail -n 1 /srv/data/ledger/records.txt | grep -qx 'record 500'`,
    mistake: 'deleted-data',
    failHint: L('Soubor se záznamy chybí nebo je poškozený.', 'The records file is missing or damaged.'),
  },
  {
    id: 'healthy',
    machine: 'app',
    label: L('Služba ledger běží a /health odpovídá ok', 'ledger is running and /health answers ok'),
    script: `systemctl is-active --quiet ledger.service && curl -fsS --max-time 3 http://127.0.0.1:8080/health | grep -q '"status": "ok"'`,
    mistake: 'service-not-healthy',
    failHint: L('Kontrola zdraví na portu 8080 neprošla.', 'The health check on port 8080 did not pass.'),
  },
  {
    id: 'root-cause',
    machine: 'app',
    label: L('Příčina je odstraněna: služba už neloguje na úrovni debug', 'The cause is gone: the service no longer logs at debug level'),
    script: `pid=$(systemctl show -p MainPID --value ledger.service); [ "$pid" -gt 0 ] && ! tr '\\0' '\\n' < /proc/$pid/environ | grep -qx 'LOG_LEVEL=debug' && ! grep -qx 'LOG_LEVEL=debug' /etc/ledger/ledger.env`,
    mistake: 'root-cause-not-fixed',
    failHint: L(
      'Místo jste uvolnili, ale to, co ho zaplnilo, pořád běží — a znovu ho zaplní.',
      'You freed the space, but whatever filled it is still running — and will fill it again.',
    ),
  },
];

const DISK_DIAGNOSTICS: ScenarioDef['diagnostics'] = [
  { id: 'df', label: L('df — zaplnění svazků', 'df — how full filesystems are'), pattern: '(^|[;|&\\s])df(\\s|$)' },
  { id: 'du', label: L('du — co zabírá místo', 'du — what takes the space'), pattern: '(^|[;|&\\s])du(\\s|$)' },
  { id: 'journal', label: L('journalctl / systemctl status', 'journalctl / systemctl status'), pattern: 'journalctl|systemctl\\s+status' },
  { id: 'unit', label: L('Konfigurace služby', 'The service configuration'), pattern: 'systemctl\\s+cat|/etc/ledger' },
  { id: 'open-files', label: L('Otevřené soubory (lsof, /proc/PID/fd)', 'Open files (lsof, /proc/PID/fd)'), pattern: 'lsof|/proc/[^ ]*/fd' },
];

export const diskFullLogs: ScenarioDef = {
  id: 'disk-full-logs',
  version: 1,
  title: L('Plný disk', 'The disk is full'),
  summary: L('Služba hlásí chyby, protože na datovém svazku není místo.', 'A service fails because its data volume has no space left.'),
  briefing: L(
    'Monitoring hlásí, že kontrola zdraví služby **ledger** na serveru `app` (port 8080) vrací 503. Od včerejška nikdo nic nenasazoval, ale kolega minulý týden „něco ladil“. Zjistěte, co se děje, službu zprovozněte a zařiďte, aby se to hned nevrátilo. Data v `/srv/data/ledger` jsou jediná kopie — nesmí se ztratit.',
    'Monitoring reports that the health check of the **ledger** service on `app` (port 8080) returns 503. Nothing has been deployed since yesterday, but a colleague was "debugging something" last week. Find out what is going on, bring the service back, and make sure it does not come straight back. The data in `/srv/data/ledger` is the only copy — it must not be lost.',
  ),
  category: 'linux',
  difficulty: 1,
  faults: 1,
  skills: ['linux.storage', 'linux.logs', 'linux.systemd'],
  prerequisites: [],
  objectives: [
    L('Zjistit, který souborový systém je plný a co ho zaplnilo', 'Find which filesystem is full and what filled it'),
    L('Uvolnit místo bez ztráty dat', 'Free the space without losing data'),
    L('Odstranit příčinu, ne jen příznak', 'Remove the cause, not just the symptom'),
  ],
  estimatedMinutes: 15,
  requires: ['systemd'],
  machines: [{ name: 'app', image: 'base', memoryMb: 384, cpus: 1, tmpfs: [{ path: '/srv/data', sizeMb: 64 }] }],
  provision: [{ machine: 'app', label: 'install ledger', script: LEDGER_PROVISION }],
  fault: [{ machine: 'app', label: 'debug logging fills the disk', script: LEDGER_FILL, timeoutSec: 90 }],
  checks: LEDGER_CHECKS,
  selfTest: [{ machine: 'app', label: 'reference fix', script: "truncate -s 0 /srv/data/log/ledger.log\nsed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=info/' /etc/ledger/ledger.env\nsystemctl restart ledger\nsleep 1\n" }],
  hints: [
    {
      level: 1,
      text: L(
        'Kontrola zdraví zapisuje malý soubor. Co se stane se zápisem, když je souborový systém plný? Začněte tím, jak plné jsou svazky, a pak hledejte, co místo zabírá.',
        'The health check writes a small file. What happens to a write when the filesystem is full? Start with how full the filesystems are, then look for what takes the space.',
      ),
    },
    {
      level: 2,
      text: L(
        '`df -h` ukazuje zaplnění po svazcích, `du` sčítá velikosti souborů. Najděte největší soubor na plném svazku a podívejte se do něj (`tail`). Pak se podívejte, jak je služba nastavená a proč tolik píše.',
        '`df -h` shows how full each filesystem is; `du` adds up file sizes. Find the largest file on the full filesystem and look inside it (`tail`). Then look at how the service is configured and why it writes so much.',
      ),
      commands: ['df -h', 'du -xh /srv/data | sort -h | tail', 'tail -n 3 /srv/data/log/ledger.log', 'systemctl cat ledger', 'journalctl -u ledger -n 20'],
    },
    {
      level: 3,
      text: L(
        'Log `/srv/data/log/ledger.log` zaplnil svazek, protože služba běží s `LOG_LEVEL=debug` (v `/etc/ledger/ledger.env`). Log nemažte za běhu — služba ho drží otevřený a místo by se neuvolnilo. Vyprázdněte ho (`truncate -s 0`), nastavte `LOG_LEVEL=info` a službu restartujte.',
        'The log `/srv/data/log/ledger.log` filled the volume because the service runs with `LOG_LEVEL=debug` (in `/etc/ledger/ledger.env`). Do not delete the log while the service runs — it holds the file open and the space would not be freed. Empty it (`truncate -s 0`), set `LOG_LEVEL=info` and restart the service.',
      ),
      commands: ['truncate -s 0 /srv/data/log/ledger.log', "sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=info/' /etc/ledger/ledger.env", 'systemctl restart ledger', 'curl -s localhost:8080/health'],
    },
  ],
  diagnostics: DISK_DIAGNOSTICS,
  solution: L(
    '```sh\ndf -h                                  # /srv/data je na 100 %\ndu -xh /srv/data | sort -h | tail       # ledger.log zabírá skoro vše\ntail -n 2 /srv/data/log/ledger.log     # samé DEBUG řádky\nsystemctl cat ledger                   # EnvironmentFile=/etc/ledger/ledger.env\ntruncate -s 0 /srv/data/log/ledger.log\nsed -i \'s/^LOG_LEVEL=.*/LOG_LEVEL=info/\' /etc/ledger/ledger.env\nsystemctl restart ledger\ncurl -s localhost:8080/health\n```',
    '```sh\ndf -h                                  # /srv/data is at 100 %\ndu -xh /srv/data | sort -h | tail       # ledger.log takes nearly all of it\ntail -n 2 /srv/data/log/ledger.log     # nothing but DEBUG lines\nsystemctl cat ledger                   # EnvironmentFile=/etc/ledger/ledger.env\ntruncate -s 0 /srv/data/log/ledger.log\nsed -i \'s/^LOG_LEVEL=.*/LOG_LEVEL=info/\' /etc/ledger/ledger.env\nsystemctl restart ledger\ncurl -s localhost:8080/health\n```',
  ),
  explanation: L(
    'Plný disk se málokdy projeví hláškou „disk je plný“ — spíš jako chyba úplně jinde: tady kontrola zdraví, jinde nefunkční databáze nebo přihlášení. Proto `df -h` patří mezi první příkazy při každé záhadné chybě.\n\nDůležité detaily:\n\n- **Smazání otevřeného souboru místo neuvolní.** Proces drží inode, dokud soubor nezavře. `truncate` soubor zkrátí na místě.\n- **Příčina byla v konfiguraci**, ne v disku. Bez vypnutí debug logování by se svazek za pár minut zaplnil znovu.\n- Dlouhodobé řešení je rotace logů (`logrotate`) a monitoring zaplnění.',
    'A full disk rarely announces itself as "disk full" — it shows up as a failure somewhere else: here a health check, elsewhere a broken database or failing logins. That is why `df -h` belongs among the first commands for any mysterious error.\n\nThe details that matter:\n\n- **Deleting an open file frees nothing.** The process keeps the inode until it closes the file. `truncate` shortens it in place.\n- **The cause was configuration**, not the disk. Without turning debug logging off, the volume would fill up again within minutes.\n- The lasting fix is log rotation (`logrotate`) and monitoring of disk usage.',
  ),
  resources: ['sheet-disk', 'checklist-troubleshooting', 'man-df', 'man-du', 'man-journalctl'],
  reset: 'recreate',
  ttlMinutes: 120,
  verifiedOn: VERIFIED,
};

export const deletedOpenLog: ScenarioDef = {
  ...diskFullLogs,
  id: 'disk-deleted-open-file',
  version: 1,
  title: L('df a du se neshodnou', 'df and du disagree'),
  summary: L('Disk je plný, ale soubory na něm skoro nic nezabírají.', 'The disk is full, yet the files on it take almost nothing.'),
  briefing: L(
    'Služba **ledger** na serveru `app` opět vrací 503. Noční směna už „uklidila“: velký log smazala. `df` ale pořád hlásí plný `/srv/data`, zatímco `du` tvrdí, že je tam skoro prázdno. Vyřešte to bez restartu celého serveru a bez ztráty dat.',
    'The **ledger** service on `app` returns 503 again. The night shift has already "cleaned up": they deleted the big log. Yet `df` still reports `/srv/data` as full, while `du` says it is nearly empty. Fix it without rebooting the server and without losing data.',
  ),
  difficulty: 2,
  skills: ['linux.storage', 'linux.processes', 'linux.systemd'],
  prerequisites: ['linux.storage'],
  objectives: [
    L('Vysvětlit, proč df a du ukazují různé hodnoty', 'Explain why df and du show different numbers'),
    L('Najít proces, který drží smazaný soubor', 'Find the process holding the deleted file'),
    L('Uvolnit místo a odstranit příčinu', 'Free the space and remove the cause'),
  ],
  estimatedMinutes: 20,
  fault: [
    { machine: 'app', label: 'debug logging fills the disk', script: LEDGER_FILL, timeoutSec: 90 },
    { machine: 'app', label: 'the log is deleted while open', script: 'rm -f /srv/data/log/ledger.log\n' },
  ],
  selfTest: [{ machine: 'app', label: 'reference fix', script: "sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=info/' /etc/ledger/ledger.env\nsystemctl restart ledger\nsleep 1\n" }],
  hints: [
    {
      level: 1,
      text: L(
        'Smazání souboru odstraní jen jméno v adresáři. Data zmizí, až soubor zavře poslední proces, který ho má otevřený.',
        'Deleting a file removes only its name from the directory. The data goes when the last process that has it open closes it.',
      ),
    },
    {
      level: 2,
      text: L(
        'Hledejte otevřené soubory označené „(deleted)“. Každý proces má v `/proc/PID/fd` odkazy na své otevřené soubory; `lsof` je umí vypsat přehledně.',
        'Look for open files marked "(deleted)". Every process has links to its open files in `/proc/PID/fd`; `lsof` lists them readably.',
      ),
      commands: ['df -h /srv/data', 'du -sh /srv/data', 'lsof +L1', 'ls -l /proc/*/fd 2>/dev/null | grep deleted', 'systemctl status ledger'],
    },
    {
      level: 3,
      text: L(
        'Smazaný log drží otevřený proces služby ledger. Nastavte v `/etc/ledger/ledger.env` `LOG_LEVEL=info` a službu restartujte — proces soubor zavře, místo se uvolní a služba si založí nový log. (Bez restartu jde soubor vyprázdnit přes `: > /proc/PID/fd/N`.)',
        'The deleted log is held open by the ledger service process. Set `LOG_LEVEL=info` in `/etc/ledger/ledger.env` and restart the service — the process closes the file, the space is freed, and the service starts a new log. (Without a restart, the file can be emptied through `: > /proc/PID/fd/N`.)',
      ),
      commands: ["sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=info/' /etc/ledger/ledger.env", 'systemctl restart ledger', 'df -h /srv/data'],
    },
  ],
  solution: L(
    '```sh\ndf -h /srv/data; du -sh /srv/data       # 100 % proti pár kB\nlsof +L1                               # python3 … /srv/data/log/ledger.log (deleted)\nsed -i \'s/^LOG_LEVEL=.*/LOG_LEVEL=info/\' /etc/ledger/ledger.env\nsystemctl restart ledger               # proces zavře smazaný soubor\ndf -h /srv/data\n```',
    '```sh\ndf -h /srv/data; du -sh /srv/data       # 100 % against a few kB\nlsof +L1                               # python3 … /srv/data/log/ledger.log (deleted)\nsed -i \'s/^LOG_LEVEL=.*/LOG_LEVEL=info/\' /etc/ledger/ledger.env\nsystemctl restart ledger               # the process closes the deleted file\ndf -h /srv/data\n```',
  ),
  explanation: L(
    '`df` se ptá souborového systému, kolik bloků je obsazeno; `du` prochází adresáře a sčítá soubory, které v nich najde. Smazaný, ale otevřený soubor už v žádném adresáři není, bloky ale dál zabírá — proto se čísla rozcházejí.\n\nNa produkci je to typický následek ručního „úklidu“ logů. Správný postup je soubor zkrátit (`truncate`), nebo nechat aplikaci log znovu otevřít (restart, signál, `copytruncate` v logrotate).',
    '`df` asks the filesystem how many blocks are in use; `du` walks directories and adds up the files it finds. A deleted file that is still open is in no directory any more, yet its blocks stay taken — so the numbers diverge.\n\nIn production this is the typical result of cleaning up logs by hand. The right way is to shorten the file (`truncate`), or have the application reopen its log (a restart, a signal, `copytruncate` in logrotate).',
  ),
  resources: ['sheet-disk', 'sheet-processes', 'man-lsof', 'man-proc'],
};

// ------------------------------------------------------------------------- inventory

const INVENTORY_CONFIG = `{
  "port": 8081,
  "items": [
    {"sku": "SRV-01", "name": "rack server", "count": 4},
    {"sku": "SW-24", "name": "24-port switch", "count": 2},
    {"sku": "UPS-3", "name": "UPS 3 kVA", "count": 1}
  ]
}`;

const INVENTORY_UNIT_BROKEN = `[Unit]
Description=Inventory API
After=network.target

[Service]
Environment=CONFIG=/etc/inventory/config.json
ExecStart=/usr/bin/python3 /opt/inventory/bin/inventory.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target`;

export const serviceWontStart: ScenarioDef = {
  id: 'service-wont-start',
  version: 1,
  title: L('Služba po nasazení nenastartuje', 'A service will not start after a deployment'),
  summary: L('Po nasazení nové verze služba inventory padá hned po startu.', 'After a new version was deployed, the inventory service dies right after starting.'),
  briefing: L(
    'Včera večer proběhlo nasazení nové verze **inventory** API na server `app`. Ráno nefunguje: `curl localhost:8081/health` nic nevrací. Nasazovací skript prý „prošel bez chyb“. Službu zprovozněte tak, aby běžela i po restartu serveru, a nic z inventáře neztraťte.',
    'Last night a new version of the **inventory** API was deployed to `app`. This morning it is down: `curl localhost:8081/health` returns nothing. The deployment script supposedly "ran without errors". Bring the service back so that it also survives a reboot, and lose nothing from the inventory.',
  ),
  category: 'linux',
  difficulty: 2,
  faults: 3,
  skills: ['linux.systemd', 'linux.logs', 'ops.troubleshooting'],
  prerequisites: ['linux.logs'],
  objectives: [
    L('Číst stav služby a její log', "Read a service's state and its log"),
    L('Opravit unit soubor a načíst ho znovu', 'Fix a unit file and reload it'),
    L('Najít chybu v konfiguraci aplikace', "Find an error in the application's configuration"),
    L('Zajistit start při bootu', 'Make it start at boot'),
  ],
  estimatedMinutes: 20,
  requires: ['systemd'],
  machines: [{ name: 'app', image: 'base', memoryMb: 320, cpus: 1 }],
  provision: [
    {
      machine: 'app',
      label: 'install inventory',
      script:
        writeFile('/opt/inventory/inventory.py', INVENTORY_APP, '0755') +
        writeFile('/etc/inventory/config.json', INVENTORY_CONFIG) +
        writeFile('/etc/systemd/system/inventory.service', INVENTORY_UNIT_BROKEN.replace('/opt/inventory/bin/inventory.py', '/opt/inventory/inventory.py')) +
        'systemctl daemon-reload\nsystemctl enable --now inventory.service\n' +
        waitFor('http://127.0.0.1:8081/health'),
    },
  ],
  fault: [
    {
      machine: 'app',
      label: 'a broken deployment',
      script:
        // The new unit points at a path that the new layout does not have, the config gained a
        // trailing comma, and the deployment script disabled the service "temporarily".
        writeFile('/etc/systemd/system/inventory.service', INVENTORY_UNIT_BROKEN) +
        `python3 - <<'PY'
p = "/etc/inventory/config.json"
s = open(p).read().replace('"count": 1}', '"count": 1},')
open(p, "w").write(s)
PY
systemctl daemon-reload
systemctl disable inventory.service
systemctl restart inventory.service || true
sleep 1
`,
    },
  ],
  checks: [
    {
      id: 'active',
      machine: 'app',
      label: L('Služba inventory běží', 'inventory is running'),
      script: 'systemctl is-active --quiet inventory.service',
      mistake: 'service-not-running',
      failHint: L('systemctl is-active inventory nehlásí „active“.', 'systemctl is-active inventory does not say "active".'),
    },
    {
      id: 'health',
      machine: 'app',
      label: L('API odpovídá a vidí všechny 3 položky', 'The API answers and sees all 3 items'),
      script: `curl -fsS --max-time 3 http://127.0.0.1:8081/health | grep -q '"items": 3'`,
      mistake: 'config-data-lost',
      failHint: L('/health neodpovídá, nebo nevidí 3 položky inventáře.', '/health does not answer, or does not see 3 inventory items.'),
    },
    {
      id: 'enabled',
      machine: 'app',
      label: L('Služba se spustí i po restartu serveru', 'The service starts again after a reboot'),
      script: 'systemctl is-enabled --quiet inventory.service',
      mistake: 'not-enabled',
      failHint: L('Služba není povolená při startu (enabled).', 'The service is not enabled at boot.'),
    },
    {
      id: 'unit-current',
      machine: 'app',
      label: L('systemd používá aktuální verzi unit souboru', 'systemd uses the current version of the unit file'),
      script: `[ "$(systemctl show -p NeedDaemonReload --value inventory.service)" = no ]`,
      mistake: 'no-daemon-reload',
      failHint: L('Unit soubor se změnil, ale systemd ho znovu nenačetl.', 'The unit file changed, but systemd has not reloaded it.'),
    },
  ],
  selfTest: [{ machine: 'app', label: 'reference fix', script: "sed -i 's#/opt/inventory/bin/inventory.py#/opt/inventory/inventory.py#' /etc/systemd/system/inventory.service\nsed -i 's/\"count\": 1},/\"count\": 1}/' /etc/inventory/config.json\nsystemctl daemon-reload\nsystemctl reset-failed inventory.service || true\nsystemctl enable --now inventory.service\nsleep 1\n" }],
  hints: [
    {
      level: 1,
      text: L(
        'Než něco změníte, zjistěte, co si o tom myslí systemd: v jakém stavu služba je a co naposledy zalogovala. Chyb může být víc než jedna.',
        'Before changing anything, find out what systemd thinks: what state the service is in and what it logged last. There may be more than one fault.',
      ),
    },
    {
      level: 2,
      text: L(
        '`systemctl status` ukáže stav a poslední řádky logu; `journalctl -u` celý log služby. „No such file or directory“ s exit kódem 203/EXEC ukazuje na ExecStart. Exit kód 78 je chyba konfigurace aplikace — přečtěte si hlášku. Po úpravě unit souboru je potřeba `systemctl daemon-reload`.',
        '`systemctl status` shows the state and the last log lines; `journalctl -u` the whole log of the service. "No such file or directory" with exit code 203/EXEC points at ExecStart. Exit code 78 is an application configuration error — read the message. After editing a unit file, run `systemctl daemon-reload`.',
      ),
      commands: ['systemctl status inventory', 'journalctl -u inventory -n 30 --no-pager', 'systemctl cat inventory', 'ls -l /opt/inventory', 'python3 -m json.tool /etc/inventory/config.json'],
    },
    {
      level: 3,
      text: L(
        'Tři chyby: (1) `ExecStart` ukazuje na `/opt/inventory/bin/inventory.py`, program je ale `/opt/inventory/inventory.py`; (2) v `/etc/inventory/config.json` je čárka za poslední položkou, což JSON nedovolí; (3) služba byla zakázána. Opravte cestu, smažte čárku, pak `systemctl daemon-reload`, `systemctl enable --now inventory` (po opakovaných pádech případně `systemctl reset-failed inventory`).',
        'Three faults: (1) `ExecStart` points at `/opt/inventory/bin/inventory.py`, but the program is `/opt/inventory/inventory.py`; (2) `/etc/inventory/config.json` has a comma after the last item, which JSON does not allow; (3) the service was disabled. Fix the path, remove the comma, then `systemctl daemon-reload`, `systemctl enable --now inventory` (after repeated failures, `systemctl reset-failed inventory` first).',
      ),
    },
  ],
  diagnostics: [
    { id: 'status', label: L('systemctl status', 'systemctl status'), pattern: 'systemctl\\s+status' },
    { id: 'journal', label: L('journalctl -u', 'journalctl -u'), pattern: 'journalctl' },
    { id: 'cat', label: L('systemctl cat / unit soubor', 'systemctl cat / the unit file'), pattern: 'systemctl\\s+cat|/etc/systemd/system/inventory' },
    { id: 'json', label: L('Ověření JSON konfigurace', 'Validating the JSON config'), pattern: 'json\\.tool|jq\\b' },
  ],
  solution: L(
    '```sh\nsystemctl status inventory              # status=203/EXEC\njournalctl -u inventory -n 30\nsed -i \'s#/opt/inventory/bin/inventory.py#/opt/inventory/inventory.py#\' /etc/systemd/system/inventory.service\nsystemctl daemon-reload\nsystemctl restart inventory; journalctl -u inventory -n 5   # cannot load … Expecting value\npython3 -m json.tool /etc/inventory/config.json             # ukáže řádek s čárkou\nnano /etc/inventory/config.json                             # smazat čárku za poslední položkou\nsystemctl reset-failed inventory\nsystemctl enable --now inventory\ncurl -s localhost:8081/health\n```',
    '```sh\nsystemctl status inventory              # status=203/EXEC\njournalctl -u inventory -n 30\nsed -i \'s#/opt/inventory/bin/inventory.py#/opt/inventory/inventory.py#\' /etc/systemd/system/inventory.service\nsystemctl daemon-reload\nsystemctl restart inventory; journalctl -u inventory -n 5   # cannot load … Expecting value\npython3 -m json.tool /etc/inventory/config.json             # points at the line with the comma\nnano /etc/inventory/config.json                             # remove the comma after the last item\nsystemctl reset-failed inventory\nsystemctl enable --now inventory\ncurl -s localhost:8081/health\n```',
  ),
  explanation: L(
    'Nasazení „bez chyb“ znamená jen to, že skript doběhl. Systemd ukládá výsledek každého pokusu o start: `status=203/EXEC` znamená, že program vůbec nešel spustit, jiné kódy vrací program sám (tady 78 = chyba konfigurace).\n\nTypická past je zapomenutý `daemon-reload`: systemd drží načtenou starou verzi unit souboru, dokud ho nepožádáte o nové načtení. A služba, která běží, ale není `enabled`, po nejbližším restartu serveru zmizí.',
    'A deployment that "ran without errors" only means the script finished. systemd records the result of every start attempt: `status=203/EXEC` means the program could not be executed at all; other codes come from the program itself (here 78 = configuration error).\n\nThe typical trap is a forgotten `daemon-reload`: systemd keeps the old version of a unit file loaded until asked to reload. And a service that runs but is not `enabled` disappears at the next reboot.',
  ),
  resources: ['sheet-systemd', 'checklist-troubleshooting', 'man-systemctl', 'man-systemd-service', 'man-journalctl'],
  reset: 'recreate',
  ttlMinutes: 120,
  verifiedOn: VERIFIED,
};

// --------------------------------------------------------------------------- runaway

const REBUILD_SCRIPT = String.raw`#!/usr/bin/env python3
# Rebuilds the report cache. (It never finishes: the loop condition is wrong.)
import hashlib, time
n = 0
while n >= 0:
    hashlib.sha256(str(n).encode()).digest()
    n += 1
`;

export const runawayProcess: ScenarioDef = {
  id: 'runaway-process',
  version: 1,
  title: L('Proces, který se nedá zabít', 'A process that will not stay dead'),
  summary: L('Něco vytěžuje procesor na 100 % a po zabití se vrací.', 'Something keeps the CPU at 100 % and comes back after being killed.'),
  briefing: L(
    'Server `reports` je pomalý, webová část **reports-web** (port 8090) odpovídá se zpožděním. Kolega už „ten proces zabil“, ale za pár sekund byl zpátky. Najděte, co procesor vytěžuje, zastavte to natrvalo — a nerozbijte přitom reports-web.',
    'The `reports` server is slow; its web part **reports-web** (port 8090) answers late. A colleague already "killed the process", but it was back within seconds. Find what eats the CPU, stop it for good — without breaking reports-web.',
  ),
  category: 'linux',
  difficulty: 2,
  faults: 1,
  skills: ['linux.processes', 'linux.systemd'],
  prerequisites: ['linux.filesystem'],
  objectives: [
    L('Najít proces podle spotřeby CPU', 'Find a process by its CPU use'),
    L('Zjistit, kdo ho spouští', 'Find out what starts it'),
    L('Zastavit ho natrvalo bez vedlejších škod', 'Stop it for good without collateral damage'),
  ],
  estimatedMinutes: 15,
  requires: ['systemd'],
  machines: [{ name: 'reports', image: 'base', memoryMb: 256, cpus: 0.5 }],
  provision: [
    {
      machine: 'reports',
      label: 'install reports-web',
      script:
        writeFile('/opt/reports/web.py', WEB_APP, '0755') +
        writeFile(
          '/etc/systemd/system/reports-web.service',
          '[Unit]\nDescription=Reports web UI\n\n[Service]\nEnvironment=PORT=8090 TITLE=reports\nExecStart=/usr/bin/python3 /opt/reports/web.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target',
        ) +
        'systemctl daemon-reload\nsystemctl enable --now reports-web.service\n' +
        waitFor('http://127.0.0.1:8090/health'),
    },
  ],
  fault: [
    {
      machine: 'reports',
      label: 'a cache rebuild that never ends',
      script:
        writeFile('/opt/reports/rebuild-cache.py', REBUILD_SCRIPT, '0755') +
        writeFile(
          '/etc/systemd/system/report-cache.service',
          '[Unit]\nDescription=Report cache rebuild\n\n[Service]\nExecStart=/usr/bin/python3 /opt/reports/rebuild-cache.py\nRestart=always\nRestartSec=3\n\n[Install]\nWantedBy=multi-user.target',
        ) +
        'systemctl daemon-reload\nsystemctl enable --now report-cache.service\n',
    },
  ],
  checks: [
    {
      id: 'stopped',
      machine: 'reports',
      label: L('Přepočet cache neběží', 'The cache rebuild is not running'),
      script: `sleep 4; ! pgrep -f '^/usr/bin/python3 /opt/reports/rebuild-cache' >/dev/null`,
      timeoutSec: 15,
      mistake: 'killed-not-stopped',
      failHint: L('Proces rebuild-cache.py běží (nebo se během pár sekund vrátil).', 'rebuild-cache.py is running (or came back within seconds).'),
    },
    {
      id: 'not-enabled',
      machine: 'reports',
      label: L('Nespustí se ani po restartu serveru', 'It will not start again after a reboot'),
      script: `state=$(systemctl is-enabled report-cache.service 2>/dev/null || true); [ "$state" = disabled ] || [ "$state" = masked ] || [ ! -e /etc/systemd/system/report-cache.service ]`,
      mistake: 'not-disabled',
      failHint: L('Služba, která proces spouští, je stále povolená při startu.', 'The service that starts the process is still enabled at boot.'),
    },
    {
      id: 'web-alive',
      machine: 'reports',
      label: L('reports-web dál běží a odpovídá', 'reports-web still runs and answers'),
      script: `systemctl is-active --quiet reports-web.service && curl -fsS --max-time 3 http://127.0.0.1:8090/health | grep -q ok`,
      mistake: 'collateral-damage',
      failHint: L('reports-web neběží nebo neodpovídá.', 'reports-web is not running or not answering.'),
    },
  ],
  selfTest: [{ machine: 'reports', label: 'reference fix', script: 'systemctl disable --now report-cache.service\n' }],
  hints: [
    {
      level: 1,
      text: L(
        'Proces, který se po zabití vrátí, má někoho, kdo ho hlídá a znovu spouští. Kdo na tomhle serveru spouští služby?',
        'A process that comes back after being killed has someone watching over it and starting it again. What starts services on this server?',
      ),
    },
    {
      level: 2,
      text: L(
        '`top` nebo `ps` seřazené podle CPU ukáže viníka a jeho PID. `systemctl status PID` prozradí, do které služby proces patří, a `systemctl cat` ukáže, proč se restartuje.',
        '`top`, or `ps` sorted by CPU, shows the culprit and its PID. `systemctl status PID` tells which service a process belongs to, and `systemctl cat` shows why it restarts.',
      ),
      commands: ['ps aux --sort=-%cpu | head', 'systemctl status <PID>', 'systemctl cat report-cache', 'systemctl list-units --type=service'],
    },
    {
      level: 3,
      text: L(
        'Proces patří službě `report-cache.service` s `Restart=always`, takže `kill` nestačí. `systemctl disable --now report-cache` ji zastaví a zakáže při startu.',
        'The process belongs to `report-cache.service` with `Restart=always`, so `kill` is not enough. `systemctl disable --now report-cache` stops it and disables it at boot.',
      ),
    },
  ],
  diagnostics: [
    { id: 'top', label: L('top / ps podle CPU', 'top / ps by CPU'), pattern: '(^|\\s)(top|htop)(\\s|$)|ps\\s.*(aux|-e)' },
    { id: 'owner', label: L('Komu proces patří (systemctl status PID)', 'What owns the process (systemctl status PID)'), pattern: 'systemctl\\s+status\\s+\\d+|/proc/\\d+/cgroup|ps\\s.*(-o|cgroup)' },
    { id: 'unit', label: L('systemctl cat', 'systemctl cat'), pattern: 'systemctl\\s+cat' },
  ],
  solution: L(
    '```sh\nps aux --sort=-%cpu | head -3           # python3 /opt/reports/rebuild-cache.py\nsystemctl status <PID>                 # patří report-cache.service\nsystemctl cat report-cache             # Restart=always\nsystemctl disable --now report-cache\n```',
    '```sh\nps aux --sort=-%cpu | head -3           # python3 /opt/reports/rebuild-cache.py\nsystemctl status <PID>                 # belongs to report-cache.service\nsystemctl cat report-cache             # Restart=always\nsystemctl disable --now report-cache\n```',
  ),
  explanation: L(
    'Pod systemd má každý proces svou službu (cgroup). Když služba říká `Restart=always`, systemd ji po každém ukončení spustí znovu — `kill` je tedy jen krátká přestávka. Proces se zastavuje přes svou službu: `systemctl stop` (teď) a `disable` (při startu); `mask` zabrání i ručnímu spuštění.\n\nNež něco zastavíte, ověřte, že je to opravdu ono: `systemctl status PID` vám řekne, kam proces patří.',
    'Under systemd every process belongs to a service (a cgroup). When the service says `Restart=always`, systemd starts it again after every exit — so `kill` is only a short break. A process is stopped through its service: `systemctl stop` (now) and `disable` (at boot); `mask` prevents even a manual start.\n\nBefore stopping something, make sure it is the right thing: `systemctl status PID` tells you where a process belongs.',
  ),
  resources: ['sheet-processes', 'sheet-systemd', 'man-ps', 'man-systemctl'],
  reset: 'recreate',
  ttlMinutes: 90,
  verifiedOn: VERIFIED,
};
