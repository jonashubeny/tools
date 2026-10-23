import { L } from '@lemma/core';
import type { ScenarioDef } from '../types';
import { WEB_APP, writeFile } from './apps';

export const writeSystemdUnit: ScenarioDef = {
  id: 'systemd-write-unit',
  version: 1,
  title: L('Z aplikace služba', 'Turning an app into a service'),
  summary: L('Napište unit soubor, aby aplikace běžela jako spolehlivá služba.', 'Write a unit file so that an app runs as a dependable service.'),
  briefing: L(
    'Vývojáři předali aplikaci **notes**: `/opt/notes/notes.py`. Zatím ji někdo spouštěl ručně v `tmux`. Udělejte z ní službu systemd jménem `notes.service`:\n\n- poslouchá na portu **9090** (aplikace čte port z proměnné prostředí `PORT`, název z `TITLE=notes`),\n- spustí se při startu serveru,\n- po pádu se sama znovu spustí.',
    'The developers handed over an app called **notes**: `/opt/notes/notes.py`. Until now somebody ran it by hand in `tmux`. Make it a systemd service named `notes.service`:\n\n- it listens on port **9090** (the app reads the port from the environment variable `PORT`, its name from `TITLE=notes`),\n- it starts when the server boots,\n- it starts again by itself after a crash.',
  ),
  category: 'deployment',
  difficulty: 2,
  faults: 0,
  skills: ['deploy.service', 'linux.systemd'],
  prerequisites: ['linux.systemd'],
  objectives: [
    L('Napsat unit soubor se správnými sekcemi', 'Write a unit file with the right sections'),
    L('Předat aplikaci konfiguraci přes prostředí', 'Pass configuration to the app through the environment'),
    L('Nastavit restart při selhání a ověřit ho', 'Set restart on failure and prove that it works'),
  ],
  estimatedMinutes: 20,
  requires: ['systemd'],
  machines: [{ name: 'app', image: 'base', memoryMb: 256, cpus: 1 }],
  provision: [
    {
      machine: 'app',
      label: 'deliver the app',
      script: writeFile('/opt/notes/notes.py', WEB_APP, '0755') + 'install -d /opt/notes\nprintf "PORT=9090 TITLE=notes python3 /opt/notes/notes.py\\n" > /opt/notes/README\n',
    },
  ],
  fault: [],
  checks: [
    {
      id: 'unit-exists',
      machine: 'app',
      label: L('notes.service existuje v /etc/systemd/system', 'notes.service exists in /etc/systemd/system'),
      script: 'test -f /etc/systemd/system/notes.service && systemctl cat notes.service >/dev/null 2>&1',
      mistake: 'unit-missing',
      failHint: L('systemd o notes.service neví.', 'systemd does not know notes.service.'),
    },
    {
      id: 'active',
      machine: 'app',
      label: L('Služba běží', 'The service is running'),
      script: 'systemctl is-active --quiet notes.service',
      mistake: 'service-not-running',
      failHint: L('notes.service neběží.', 'notes.service is not running.'),
    },
    {
      id: 'port',
      machine: 'app',
      label: L('Aplikace odpovídá na portu 9090 jako notes', 'The app answers on port 9090 as notes'),
      script: `curl -fsS --max-time 3 http://127.0.0.1:9090/health | grep -q '"app": "notes"'`,
      mistake: 'environment-not-set',
      failHint: L('Na portu 9090 neodpovídá aplikace „notes“.', 'No app called "notes" answers on port 9090.'),
    },
    {
      id: 'enabled',
      machine: 'app',
      label: L('Spustí se při startu serveru', 'It starts at boot'),
      script: 'systemctl is-enabled --quiet notes.service',
      mistake: 'not-enabled',
      failHint: L('Služba není povolená při startu.', 'The service is not enabled at boot.'),
    },
    {
      id: 'restarts',
      machine: 'app',
      label: L('Po pádu se sama znovu spustí', 'It comes back by itself after a crash'),
      script: `case "$(systemctl show -p Restart --value notes.service)" in on-failure|on-abnormal|always) ;; *) exit 1;; esac
pid=$(systemctl show -p MainPID --value notes.service); [ "$pid" -gt 0 ]
kill -9 "$pid"
for i in $(seq 1 40); do sleep 0.25; n=$(systemctl show -p MainPID --value notes.service); [ "$n" -gt 0 ] && [ "$n" != "$pid" ] && curl -fsS --max-time 1 http://127.0.0.1:9090/health >/dev/null 2>&1 && exit 0; done
exit 1`,
      timeoutSec: 20,
      mistake: 'no-restart-policy',
      failHint: L(
        'Kontrola službu shodila signálem KILL a ta se do 10 sekund nevrátila.',
        'The check killed the service with SIGKILL and it did not come back within 10 seconds.',
      ),
    },
  ],
  selfTest: [{ machine: 'app', label: 'reference fix', script: "printf '%s\\n' '[Unit]' 'Description=Notes app' 'After=network.target' '' '[Service]' 'Environment=PORT=9090 TITLE=notes' 'ExecStart=/usr/bin/python3 /opt/notes/notes.py' 'Restart=on-failure' '' '[Install]' 'WantedBy=multi-user.target' > /etc/systemd/system/notes.service\nsystemctl daemon-reload\nsystemctl enable --now notes.service\nsleep 1\n" }],
  hints: [
    {
      level: 1,
      text: L(
        'Unit soubor služby má tři části: `[Unit]` (popis a závislosti), `[Service]` (co a jak spustit) a `[Install]` (kdy ji spustit při startu). Vlastní služby patří do `/etc/systemd/system/`.',
        'A service unit file has three parts: `[Unit]` (description and dependencies), `[Service]` (what to run and how) and `[Install]` (when to start it at boot). Your own services belong in `/etc/systemd/system/`.',
      ),
    },
    {
      level: 2,
      text: L(
        'Potřebujete `ExecStart=` s absolutní cestou k interpretu, `Environment=` pro PORT a TITLE, `Restart=on-failure` a v `[Install]` `WantedBy=multi-user.target`. Po vytvoření souboru `systemctl daemon-reload`, pak `enable --now`. Restart ověříte tak, že hlavní proces zabijete a sledujete, jestli se vrátí.',
        'You need `ExecStart=` with an absolute path to the interpreter, `Environment=` for PORT and TITLE, `Restart=on-failure`, and `WantedBy=multi-user.target` under `[Install]`. After creating the file, `systemctl daemon-reload`, then `enable --now`. Test the restart by killing the main process and watching it come back.',
      ),
      commands: ['systemctl daemon-reload', 'systemctl enable --now notes', 'systemctl show -p MainPID --value notes', 'kill -9 <PID>; sleep 1; systemctl status notes'],
    },
    {
      level: 3,
      text: L(
        'Například:\n\n```ini\n[Unit]\nDescription=Notes app\nAfter=network.target\n\n[Service]\nEnvironment=PORT=9090 TITLE=notes\nExecStart=/usr/bin/python3 /opt/notes/notes.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n```',
        'For example:\n\n```ini\n[Unit]\nDescription=Notes app\nAfter=network.target\n\n[Service]\nEnvironment=PORT=9090 TITLE=notes\nExecStart=/usr/bin/python3 /opt/notes/notes.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n```',
      ),
    },
  ],
  diagnostics: [
    { id: 'reload', label: L('systemctl daemon-reload', 'systemctl daemon-reload'), pattern: 'daemon-reload' },
    { id: 'status', label: L('Kontrola stavu služby', 'Checking the service state'), pattern: 'systemctl\\s+status|journalctl' },
    { id: 'test', label: L('Ověření, že aplikace odpovídá', 'Testing that the app answers'), pattern: 'curl|nc\\s|ss\\s+-' },
    { id: 'verify', label: L('systemd-analyze verify', 'systemd-analyze verify'), pattern: 'systemd-analyze' },
  ],
  solution: L(
    '```sh\ncat > /etc/systemd/system/notes.service <<\'EOF\'\n[Unit]\nDescription=Notes app\nAfter=network.target\n\n[Service]\nEnvironment=PORT=9090 TITLE=notes\nExecStart=/usr/bin/python3 /opt/notes/notes.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsystemd-analyze verify /etc/systemd/system/notes.service\nsystemctl daemon-reload\nsystemctl enable --now notes\ncurl -s localhost:9090/health\n```',
    '```sh\ncat > /etc/systemd/system/notes.service <<\'EOF\'\n[Unit]\nDescription=Notes app\nAfter=network.target\n\n[Service]\nEnvironment=PORT=9090 TITLE=notes\nExecStart=/usr/bin/python3 /opt/notes/notes.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsystemd-analyze verify /etc/systemd/system/notes.service\nsystemctl daemon-reload\nsystemctl enable --now notes\ncurl -s localhost:9090/health\n```',
  ),
  explanation: L(
    'Ruční spuštění v `tmux` přežije jen do restartu a pádu nikdo nevšimne. Služba systemd dává aplikaci stejné prostředí při každém startu, log v journalu, restart při selhání a pořadí při bootu.\n\nV produkci byste ještě přidali vlastního uživatele (`User=` nebo `DynamicUser=yes`) a omezení (`ProtectSystem=`, `NoNewPrivileges=`) — s nimi aplikace nemůže pokazit víc, než musí.',
    'Running by hand in `tmux` lasts until the next reboot, and nobody notices a crash. A systemd service gives the app the same environment at every start, a log in the journal, a restart on failure and an order at boot.\n\nIn production you would add a user of its own (`User=` or `DynamicUser=yes`) and restrictions (`ProtectSystem=`, `NoNewPrivileges=`) — with them the app cannot break more than it has to.',
  ),
  resources: ['sheet-systemd', 'man-systemd-service', 'man-systemd-exec', 'man-systemctl'],
  reset: 'recreate',
  ttlMinutes: 120,
  verifiedOn: 'Debian 12 (bookworm), systemd 252, Python 3.11',
};
