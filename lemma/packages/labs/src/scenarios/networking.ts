import { L } from '@lemma/core';
import type { ScenarioDef } from '../types';
import { WEB_APP, writeFile } from './apps';

// ------------------------------------------------------------------------------- DNS

const DB_CHECK = `#!/bin/sh
# Resolves the database host the way the application does (through NSS), then says so.
. /etc/app/app.conf
addr=$(getent hosts "$DB_HOST" | awk '{print $1; exit}')
if [ -z "$addr" ]; then
  echo "app: cannot resolve database host $DB_HOST" >&2
  exit 1
fi
echo "app: database $DB_HOST is $addr:$DB_PORT"`;

/**
 * /etc/hosts and /etc/resolv.conf are written in place, never replaced: the container engine
 * bind-mounts them, and a rename onto a mount point fails.
 */
const replaceInPlace = (file: string, from: string, to: string): string =>
  `python3 - <<'PY'\np = "${file}"\ns = open(p).read().replace("${from}", "${to}")\nwith open(p, "w") as f:\n    f.write(s)\nPY\n`;

export const dnsResolution: ScenarioDef = {
  id: 'dns-resolution',
  version: 1,
  title: L('Aplikace nenajde databázi', 'The app cannot find its database'),
  summary: L('Překlad jména databázového serveru selhává.', "Resolving the database server's name fails."),
  briefing: L(
    'Na serveru `app` hlásí kontrola `/usr/local/bin/app-db-check`, že nejde přeložit jméno databáze `db.lab.internal`. Interní DNS server je tento týden mimo provoz, proto mají servery důležitá jména v `/etc/hosts` — a ještě včera to fungovalo. Zjistěte proč a opravte to. Konfigurace aplikace musí dál používat jméno, ne IP adresu.',
    'On `app`, the check `/usr/local/bin/app-db-check` reports that the database name `db.lab.internal` cannot be resolved. The internal DNS server is out of service this week, which is why the servers carry the important names in `/etc/hosts` — and yesterday it worked. Find out why and fix it. The application configuration must keep using the name, not an IP address.',
  ),
  category: 'networking',
  difficulty: 2,
  faults: 2,
  skills: ['net.dns', 'ops.troubleshooting'],
  prerequisites: [],
  objectives: [
    L('Rozlišit, kudy se jméno překládá: soubory, nebo DNS', 'Tell how a name is resolved: files or DNS'),
    L('Vědět, proč dig a getent mohou odpovědět různě', 'Know why dig and getent can answer differently'),
    L('Opravit překlad bez zadrátování IP adresy', 'Fix resolution without hard-coding an IP address'),
  ],
  estimatedMinutes: 15,
  requires: [],
  machines: [{ name: 'app', image: 'base', memoryMb: 192, cpus: 0.5 }],
  provision: [
    {
      machine: 'app',
      label: 'configure the app and name resolution',
      script:
        writeFile('/etc/app/app.conf', 'DB_HOST=db.lab.internal\nDB_PORT=5432') +
        writeFile('/usr/local/bin/app-db-check', DB_CHECK, '0755') +
        `printf '%s\\n' '10.77.0.20	db.lab.internal db' '10.77.0.21	cache.lab.internal cache' >> /etc/hosts
printf '%s\\n' 'search lab.internal' 'nameserver 10.77.0.53' 'options timeout:1 attempts:1' > /etc/resolv.conf
/usr/local/bin/app-db-check
`,
    },
  ],
  fault: [
    {
      machine: 'app',
      label: 'two small edits',
      script:
        `sed -i 's/^hosts:.*/hosts:          dns/' /etc/nsswitch.conf\n` +
        replaceInPlace('/etc/hosts', 'db.lab.internal db', 'db.lab.internl db'),
    },
  ],
  checks: [
    {
      id: 'resolves',
      machine: 'app',
      label: L('db.lab.internal se přeloží na 10.77.0.20', 'db.lab.internal resolves to 10.77.0.20'),
      script: `[ "$(getent hosts db.lab.internal | awk '{print $1; exit}')" = 10.77.0.20 ]`,
      timeoutSec: 10,
      mistake: 'name-not-resolving',
      failHint: L('getent hosts db.lab.internal nevrací 10.77.0.20.', 'getent hosts db.lab.internal does not return 10.77.0.20.'),
    },
    {
      id: 'files-first',
      machine: 'app',
      label: L('Systém se ptá nejdřív /etc/hosts', 'The system asks /etc/hosts first'),
      script: `grep -Eq '^hosts:[[:space:]]+files' /etc/nsswitch.conf`,
      mistake: 'nsswitch-order',
      failHint: L('Řádek hosts: v /etc/nsswitch.conf nezačíná zdrojem files.', 'The hosts: line in /etc/nsswitch.conf does not start with files.'),
    },
    {
      id: 'by-name',
      machine: 'app',
      label: L('Aplikace se dál připojuje podle jména', 'The app still connects by name'),
      script: `grep -qx 'DB_HOST=db.lab.internal' /etc/app/app.conf`,
      mistake: 'hardcoded-ip',
      failHint: L('Konfigurace aplikace už nepoužívá jméno db.lab.internal.', 'The app configuration no longer uses the name db.lab.internal.'),
    },
    {
      id: 'app-check',
      machine: 'app',
      label: L('Kontrola aplikace prochází', "The app's own check passes"),
      script: '/usr/local/bin/app-db-check',
      timeoutSec: 10,
      mistake: 'name-not-resolving',
      failHint: L('/usr/local/bin/app-db-check stále selhává.', '/usr/local/bin/app-db-check still fails.'),
    },
  ],
  selfTest: [{ machine: 'app', label: 'reference fix', script: "sed -i 's/^hosts:.*/hosts:          files dns/' /etc/nsswitch.conf\n" + replaceInPlace('/etc/hosts', 'db.lab.internl db', 'db.lab.internal db') }],
  hints: [
    {
      level: 1,
      text: L(
        'Aplikace nečte /etc/hosts ani se neptá DNS sama: ptá se knihovny C, a ta se řídí souborem, který určuje pořadí zdrojů. Ověřte nejdřív, zda je jméno v /etc/hosts opravdu správně, a pak, zda se do něj systém vůbec dívá.',
        'An application neither reads /etc/hosts nor queries DNS by itself: it asks the C library, which follows a file that sets the order of sources. Check first whether the name in /etc/hosts is really right, and then whether the system looks there at all.',
      ),
    },
    {
      level: 2,
      text: L(
        '`getent hosts JMÉNO` překládá přesně jako aplikace. `dig` a `nslookup` se ptají přímo DNS serveru a /etc/hosts vůbec nečtou — tady proto jen vyprší. Pořadí zdrojů je na řádku `hosts:` v `/etc/nsswitch.conf`. Pozor: `/etc/hosts` je v kontejneru připojený soubor, `sed -i` ho nepřepíše — upravte ho editorem.',
        '`getent hosts NAME` resolves exactly as the app does. `dig` and `nslookup` query a DNS server directly and never read /etc/hosts — here they just time out. The order of sources is on the `hosts:` line of `/etc/nsswitch.conf`. Beware: in a container `/etc/hosts` is a mounted file and `sed -i` cannot replace it — edit it with an editor.',
      ),
      commands: ['getent hosts db.lab.internal', 'grep ^hosts: /etc/nsswitch.conf', 'cat /etc/hosts', 'dig db.lab.internal'],
    },
    {
      level: 3,
      text: L(
        'Dvě chyby: v `/etc/nsswitch.conf` je `hosts: dns`, takže se /etc/hosts vůbec nečte — má tam být `hosts: files dns`. A v `/etc/hosts` je překlep `db.lab.internl`. Opravte obojí a spusťte `app-db-check`.',
        'Two faults: `/etc/nsswitch.conf` says `hosts: dns`, so /etc/hosts is never read — it should say `hosts: files dns`. And `/etc/hosts` has a typo, `db.lab.internl`. Fix both and run `app-db-check`.',
      ),
      commands: ["sed -i 's/^hosts:.*/hosts:          files dns/' /etc/nsswitch.conf", 'nano /etc/hosts', 'app-db-check'],
    },
  ],
  diagnostics: [
    { id: 'getent', label: L('getent hosts', 'getent hosts'), pattern: 'getent\\s+hosts' },
    { id: 'nsswitch', label: L('/etc/nsswitch.conf', '/etc/nsswitch.conf'), pattern: 'nsswitch' },
    { id: 'hosts', label: L('/etc/hosts', '/etc/hosts'), pattern: '/etc/hosts' },
    { id: 'resolv', label: L('/etc/resolv.conf', '/etc/resolv.conf'), pattern: 'resolv\\.conf' },
  ],
  solution: L(
    '```sh\napp-db-check                            # cannot resolve database host\ngetent hosts db.lab.internal            # nic\ngrep ^hosts: /etc/nsswitch.conf         # hosts: dns  ← soubory se nečtou\nsed -i \'s/^hosts:.*/hosts:          files dns/\' /etc/nsswitch.conf\ngetent hosts db.lab.internal            # pořád nic → /etc/hosts\ngrep lab.internal /etc/hosts            # db.lab.internl ← překlep\nnano /etc/hosts\napp-db-check\n```',
    '```sh\napp-db-check                            # cannot resolve database host\ngetent hosts db.lab.internal            # nothing\ngrep ^hosts: /etc/nsswitch.conf         # hosts: dns  ← files are never read\nsed -i \'s/^hosts:.*/hosts:          files dns/\' /etc/nsswitch.conf\ngetent hosts db.lab.internal            # still nothing → /etc/hosts\ngrep lab.internal /etc/hosts            # db.lab.internl ← typo\nnano /etc/hosts\napp-db-check\n```',
  ),
  explanation: L(
    'Překlad jmen v Linuxu řídí NSS (Name Service Switch): `/etc/nsswitch.conf` říká, v jakém pořadí se ptát souborů, DNS a dalších zdrojů. Nástroje `dig` a `nslookup` jsou klienti DNS — obcházejí NSS, takže neukazují, co uvidí aplikace. Na to je `getent`.\n\nDvě chyby najednou jsou běžné: po opravě první se příznak nezmění a svádí to k domněnce, že oprava byla špatná. Ověřujte po každém kroku.',
    'Name resolution on Linux is governed by NSS (the Name Service Switch): `/etc/nsswitch.conf` says in which order to ask files, DNS and other sources. `dig` and `nslookup` are DNS clients — they bypass NSS, so they do not show what an application will see. That is what `getent` is for.\n\nTwo faults at once are common: after fixing the first the symptom does not change, which tempts you to think the fix was wrong. Verify after every step.',
  ),
  resources: ['sheet-dns', 'checklist-troubleshooting', 'man-nsswitch', 'man-hosts', 'man-getent', 'man-resolv-conf'],
  reset: 'recreate',
  ttlMinutes: 90,
  verifiedOn: 'Debian 12 (bookworm), glibc 2.36, BIND 9.18 dig',
};

// ---------------------------------------------------------------- service reachability

export const serviceReachability: ScenarioDef = {
  id: 'service-reachability',
  version: 1,
  title: L('Služba běží, ale není k zastižení', 'The service runs but cannot be reached'),
  summary: L('Ze stroje client se nejde dostat na API na stroji api.', 'From client, the API on api cannot be reached.'),
  briefing: L(
    'Laboratoř má dva stroje v jedné síti: `client` (10.88.0.10) a `api` (10.88.0.20). Na `api` běží služba **status-api** na portu 8000. Na `api` samotném `curl localhost:8000/health` funguje, ze stroje `client` ale `curl http://api.lab:8000/health` ne. Zařiďte, aby to fungovalo ze stroje `client`.',
    'The lab has two machines on one network: `client` (10.88.0.10) and `api` (10.88.0.20). On `api`, the **status-api** service runs on port 8000. On `api` itself `curl localhost:8000/health` works, but from `client`, `curl http://api.lab:8000/health` does not. Make it work from `client`.',
  ),
  category: 'networking',
  difficulty: 3,
  faults: 2,
  skills: ['net.ports', 'net.dns', 'net.tcpip'],
  prerequisites: ['net.dns', 'linux.systemd'],
  objectives: [
    L('Postupovat po vrstvách: jméno, adresa, port, služba', 'Work through the layers: name, address, port, service'),
    L('Zjistit, na jaké adrese služba naslouchá', 'Find which address a service listens on'),
    L('Opravit problém na správném stroji', 'Fix each problem on the right machine'),
  ],
  estimatedMinutes: 25,
  requires: ['systemd', 'networks'],
  networks: [{ name: 'lan', subnet: '10.88.0.0/24' }],
  machines: [
    { name: 'client', image: 'base', memoryMb: 160, cpus: 0.5, networks: [{ network: 'lan', address: '10.88.0.10' }], capAdd: ['NET_RAW'] },
    { name: 'api', image: 'base', memoryMb: 192, cpus: 0.5, networks: [{ network: 'lan', address: '10.88.0.20' }], capAdd: ['NET_RAW'] },
  ],
  provision: [
    {
      machine: 'api',
      label: 'install status-api',
      script:
        writeFile('/opt/status/api.py', WEB_APP, '0755') +
        writeFile(
          '/etc/systemd/system/status-api.service',
          '[Unit]\nDescription=Status API\n\n[Service]\nEnvironment=PORT=8000 TITLE=status-api BIND=0.0.0.0\nExecStart=/usr/bin/python3 /opt/status/api.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target',
        ) +
        'systemctl daemon-reload\nsystemctl enable --now status-api.service\n',
    },
    {
      machine: 'client',
      label: 'name the api host',
      script: `printf '%s\\n' '10.88.0.20	api.lab api' >> /etc/hosts\n`,
    },
  ],
  fault: [
    {
      machine: 'api',
      label: 'listen on loopback only',
      script: `sed -i 's/BIND=0.0.0.0/BIND=127.0.0.1/' /etc/systemd/system/status-api.service\nsystemctl daemon-reload\nsystemctl restart status-api.service\n`,
    },
    {
      machine: 'client',
      label: 'a stale address',
      script: replaceInPlace('/etc/hosts', '10.88.0.20	api.lab api', '10.88.0.21	api.lab api'),
    },
  ],
  checks: [
    {
      id: 'name',
      machine: 'client',
      label: L('Na stroji client se api.lab přeloží na 10.88.0.20', 'On client, api.lab resolves to 10.88.0.20'),
      script: `[ "$(getent hosts api.lab | awk '{print $1; exit}')" = 10.88.0.20 ]`,
      mistake: 'name-not-resolving',
      failHint: L('getent hosts api.lab na stroji client nevrací 10.88.0.20.', 'getent hosts api.lab on client does not return 10.88.0.20.'),
    },
    {
      id: 'listening',
      machine: 'api',
      label: L('status-api naslouchá i mimo loopback', 'status-api listens beyond loopback'),
      script: `ss -Hltn 'sport = :8000' | awk '{print $4}' | grep -Eq '^(0\\.0\\.0\\.0|\\*|\\[::\\]|10\\.88\\.0\\.20):8000$'`,
      mistake: 'loopback-only',
      failHint: L('Na stroji api poslouchá port 8000 jen na 127.0.0.1.', 'On api, port 8000 listens on 127.0.0.1 only.'),
    },
    {
      id: 'reachable',
      machine: 'client',
      label: L('Z client odpovídá http://api.lab:8000/health', 'http://api.lab:8000/health answers from client'),
      script: `curl -fsS --max-time 3 http://api.lab:8000/health | grep -q status-api`,
      timeoutSec: 10,
      mistake: 'service-unreachable',
      failHint: L('Ze stroje client se na službu nedá dostat.', 'The service cannot be reached from client.'),
    },
  ],
  selfTest: [
    { machine: 'client', label: 'reference fix: address', script: replaceInPlace('/etc/hosts', '10.88.0.21	api.lab api', '10.88.0.20	api.lab api') },
    { machine: 'api', label: 'reference fix: bind', script: "sed -i 's/BIND=127.0.0.1/BIND=0.0.0.0/' /etc/systemd/system/status-api.service\nsystemctl daemon-reload\nsystemctl restart status-api.service\nsleep 1\n" },
  ],
  hints: [
    {
      level: 1,
      text: L(
        'Rozdělte cestu na kroky: na jakou adresu se jméno přeloží, odpovídá ta adresa, naslouchá na ní služba? Funguje-li to lokálně, ale ne po síti, hledejte rozdíl mezi „localhost“ a síťovou adresou.',
        'Split the path into steps: what address the name resolves to, whether that address answers, whether the service listens on it. If it works locally but not over the network, look for the difference between "localhost" and the network address.',
      ),
    },
    {
      level: 2,
      text: L(
        'Na `client`: `getent hosts api.lab` a `ping -c1` na výsledek. Na `api`: `ip -br addr` ukáže skutečnou adresu, `ss -ltnp` ukáže, na jaké adrese port 8000 naslouchá — `127.0.0.1:8000` znamená jen lokálně.',
        'On `client`: `getent hosts api.lab` and `ping -c1` the result. On `api`: `ip -br addr` shows the real address, `ss -ltnp` shows which address port 8000 listens on — `127.0.0.1:8000` means local only.',
      ),
      commands: ['getent hosts api.lab', 'ping -c1 10.88.0.20', 'ip -br addr', 'ss -ltnp', 'systemctl cat status-api'],
    },
    {
      level: 3,
      text: L(
        'Na `client` je v `/etc/hosts` stará adresa 10.88.0.21 — má být 10.88.0.20. Na `api` služba poslouchá jen na loopbacku (`BIND=127.0.0.1` v unit souboru) — změňte na `0.0.0.0`, `daemon-reload` a restart.',
        'On `client`, `/etc/hosts` has the stale address 10.88.0.21 — it should be 10.88.0.20. On `api` the service listens on loopback only (`BIND=127.0.0.1` in the unit file) — change it to `0.0.0.0`, `daemon-reload` and restart.',
      ),
    },
  ],
  diagnostics: [
    { id: 'getent', label: L('getent hosts', 'getent hosts'), pattern: 'getent\\s+hosts' },
    { id: 'ping', label: L('ping', 'ping'), pattern: '(^|\\s)ping\\s' },
    { id: 'ss', label: L('ss -ltn', 'ss -ltn'), pattern: '(^|\\s)ss\\s|netstat' },
    { id: 'ip', label: L('ip addr', 'ip addr'), pattern: '(^|\\s)ip\\s+(-br\\s+)?a' },
  ],
  solution: L(
    '```sh\n# client\ngetent hosts api.lab        # 10.88.0.21 ← stará adresa\nnano /etc/hosts             # → 10.88.0.20\n# api\nss -ltnp                    # 127.0.0.1:8000 → jen lokálně\nsed -i \'s/BIND=127.0.0.1/BIND=0.0.0.0/\' /etc/systemd/system/status-api.service\nsystemctl daemon-reload && systemctl restart status-api\n# client\ncurl http://api.lab:8000/health\n```',
    '```sh\n# client\ngetent hosts api.lab        # 10.88.0.21 ← stale address\nnano /etc/hosts             # → 10.88.0.20\n# api\nss -ltnp                    # 127.0.0.1:8000 → local only\nsed -i \'s/BIND=127.0.0.1/BIND=0.0.0.0/\' /etc/systemd/system/status-api.service\nsystemctl daemon-reload && systemctl restart status-api\n# client\ncurl http://api.lab:8000/health\n```',
  ),
  explanation: L(
    '„Funguje lokálně, ale ne po síti“ má málo příčin: služba naslouchá jen na loopbacku, firewall, nebo klient míří jinam, než si myslíte. Postup po vrstvách — jméno → adresa → dosažitelnost → port → služba — je najde všechny a nevynechá druhou chybu, když najdete první.',
    '"Works locally but not over the network" has few causes: the service listens on loopback only, a firewall, or the client aims somewhere else than you think. Working through the layers — name → address → reachability → port → service — finds all of them, and does not miss the second fault once you have found the first.',
  ),
  resources: ['sheet-network', 'sheet-dns', 'checklist-troubleshooting', 'man-ss', 'man-ip-address'],
  reset: 'recreate',
  ttlMinutes: 90,
  verifiedOn: 'Debian 12 (bookworm), iproute2 6.1',
  untested: true,
};

// ---------------------------------------------------------------------------- nginx

const NGINX_SITE = `server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

export const nginx502: ScenarioDef = {
  id: 'nginx-bad-gateway',
  version: 1,
  title: L('502 Bad Gateway', '502 Bad Gateway'),
  summary: L('Po nasazení vrací web chybu 502.', 'After a deployment, the website returns 502.'),
  briefing: L(
    'E-shop na serveru `web` běží za nginx: nginx na portu 80 předává požadavky aplikaci **shop**. Po dnešním nasazení vrací web `502 Bad Gateway`. Kolega se to pokusil opravit úpravou konfigurace nginx, ale „reload nějak nefunguje“. Zprovozněte web a zajistěte, aby přežil restart serveru.',
    'The shop on `web` runs behind nginx: nginx on port 80 passes requests to the **shop** application. Since today’s deployment the site returns `502 Bad Gateway`. A colleague tried to fix it by editing the nginx configuration, but "reload somehow does not work". Bring the site back and make sure it survives a reboot.',
  ),
  category: 'networking',
  difficulty: 3,
  faults: 3,
  skills: ['net.proxy', 'net.ports', 'linux.systemd'],
  prerequisites: ['net.ports', 'linux.systemd'],
  objectives: [
    L('Rozumět tomu, co znamená 502 u reverzní proxy', 'Understand what 502 means at a reverse proxy'),
    L('Ověřit konfiguraci nginx před reloadem', 'Validate the nginx configuration before reloading'),
    L('Sladit proxy a aplikaci', 'Bring proxy and application back in line'),
  ],
  estimatedMinutes: 25,
  requires: ['systemd', 'multiUser'],
  machines: [{ name: 'web', image: 'full', memoryMb: 320, cpus: 1 }],
  provision: [
    {
      machine: 'web',
      label: 'install shop behind nginx',
      script:
        writeFile('/opt/shop/shop.py', WEB_APP, '0755') +
        writeFile(
          '/etc/systemd/system/shop.service',
          '[Unit]\nDescription=Shop application\nAfter=network.target\n\n[Service]\nUser=www-data\nEnvironment=PORT=5000 "TITLE=Lemma Shop"\nExecStart=/usr/bin/python3 /opt/shop/shop.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target',
        ) +
        writeFile('/etc/nginx/sites-available/shop', NGINX_SITE) +
        `rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/shop /etc/nginx/sites-enabled/shop
systemctl daemon-reload
systemctl enable --now shop.service nginx.service
for i in $(seq 1 50); do curl -fsS --max-time 1 http://127.0.0.1/ | grep -q 'Lemma Shop' && break; sleep 0.2; done
`,
    },
  ],
  fault: [
    {
      machine: 'web',
      label: 'a release that moved the port, and a half-done fix',
      script: `sed -i 's/PORT=5000/PORT=5001/' /etc/systemd/system/shop.service
systemctl daemon-reload
systemctl disable shop.service
systemctl restart shop.service
sed -i 's#proxy_pass http://127.0.0.1:5000;#proxy_pass http://127.0.0.1:5001#' /etc/nginx/sites-available/shop
systemctl reload nginx.service || true
`,
    },
  ],
  checks: [
    {
      id: 'config-valid',
      machine: 'web',
      label: L('Konfigurace nginx je platná (nginx -t)', 'The nginx configuration is valid (nginx -t)'),
      script: 'nginx -t -q',
      mistake: 'config-syntax',
      failHint: L('nginx -t hlásí chybu v konfiguraci.', 'nginx -t reports a configuration error.'),
    },
    {
      id: 'site',
      machine: 'web',
      label: L('http://localhost/ vrací stránku Lemma Shop', 'http://localhost/ returns the Lemma Shop page'),
      script: `curl -fsS --max-time 3 http://127.0.0.1/ | grep -q 'Lemma Shop'`,
      mistake: 'upstream-mismatch',
      failHint: L('Web stále nevrací stránku obchodu.', 'The site still does not return the shop page.'),
    },
    {
      id: 'boot',
      machine: 'web',
      label: L('shop i nginx se spustí po restartu serveru', 'shop and nginx both start after a reboot'),
      script: 'systemctl is-enabled --quiet shop.service && systemctl is-enabled --quiet nginx.service',
      mistake: 'not-enabled',
      failHint: L('Některá ze služeb není povolená při startu.', 'One of the services is not enabled at boot.'),
    },
  ],
  selfTest: [{ machine: 'web', label: 'reference fix', script: "sed -i 's#proxy_pass http://127.0.0.1:5001$#proxy_pass http://127.0.0.1:5001;#' /etc/nginx/sites-available/shop\nnginx -t\nsystemctl reload nginx.service\nsystemctl enable shop.service\nsleep 1\n" }],
  hints: [
    {
      level: 1,
      text: L(
        '502 vrací proxy, když se jí nepodaří dostat odpověď od aplikace za ní. Otázky jsou tedy dvě: kam nginx požadavky posílá, a kde aplikace opravdu naslouchá. A proč reload neprošel?',
        'A proxy returns 502 when it cannot get an answer from the application behind it. So there are two questions: where nginx sends requests, and where the application really listens. And why did the reload fail?',
      ),
    },
    {
      level: 2,
      text: L(
        '`nginx -t` ověří konfiguraci a řekne, na kterém řádku je chyba — reload s chybnou konfigurací nginx odmítne a běží dál se starou. `ss -ltnp` ukáže, na jakém portu shop naslouchá; `/var/log/nginx/error.log` ukáže, kam se nginx neúspěšně připojuje.',
        '`nginx -t` checks the configuration and names the line with the error — nginx refuses a reload with a broken configuration and keeps running the old one. `ss -ltnp` shows which port shop listens on; `/var/log/nginx/error.log` shows where nginx fails to connect.',
      ),
      commands: ['nginx -t', 'ss -ltnp', 'tail /var/log/nginx/error.log', 'systemctl cat shop', 'systemctl is-enabled shop nginx'],
    },
    {
      level: 3,
      text: L(
        'Nové vydání přesunulo shop na port 5001, nginx ale stále (se starou načtenou konfigurací) míří na 5000. Kolegova úprava míří správně, ale chybí jí středník za `proxy_pass http://127.0.0.1:5001`, takže reload selhal. Doplňte středník, `nginx -t`, `systemctl reload nginx`, a `systemctl enable shop`.',
        'The new release moved shop to port 5001, but nginx (running the old loaded configuration) still points at 5000. The colleague’s edit points the right way but lacks a semicolon after `proxy_pass http://127.0.0.1:5001`, so the reload failed. Add the semicolon, `nginx -t`, `systemctl reload nginx`, and `systemctl enable shop`.',
      ),
    },
  ],
  diagnostics: [
    { id: 'nginx-t', label: L('nginx -t', 'nginx -t'), pattern: 'nginx\\s+-t' },
    { id: 'ss', label: L('ss -ltnp', 'ss -ltnp'), pattern: '(^|\\s)ss\\s|netstat' },
    { id: 'error-log', label: L('Log chyb nginx', 'The nginx error log'), pattern: 'error\\.log|journalctl\\s.*nginx' },
    { id: 'curl', label: L('curl na aplikaci přímo', 'curl straight at the app'), pattern: 'curl\\s.*:500[01]' },
  ],
  solution: L(
    '```sh\ncurl -sI localhost                       # 502\ntail -n 3 /var/log/nginx/error.log      # connect() failed … upstream: "http://127.0.0.1:5000/"\nss -ltnp | grep python                  # shop naslouchá na 5001\nnginx -t                                # chybí ";" v sites-enabled/shop\nnano /etc/nginx/sites-available/shop    # proxy_pass http://127.0.0.1:5001;\nnginx -t && systemctl reload nginx\nsystemctl enable shop\ncurl -s localhost | head -3\n```',
    '```sh\ncurl -sI localhost                       # 502\ntail -n 3 /var/log/nginx/error.log      # connect() failed … upstream: "http://127.0.0.1:5000/"\nss -ltnp | grep python                  # shop listens on 5001\nnginx -t                                # missing ";" in sites-enabled/shop\nnano /etc/nginx/sites-available/shop    # proxy_pass http://127.0.0.1:5001;\nnginx -t && systemctl reload nginx\nsystemctl enable shop\ncurl -s localhost | head -3\n```',
  ),
  explanation: L(
    '502 Bad Gateway je chyba mezi proxy a aplikací: nginx se nepřipojil nebo dostal nesmyslnou odpověď. (504 znamená, že aplikace neodpověděla včas.) Log chyb nginx vždy uvede, kam se pokoušel připojit.\n\nReload nginx s chybnou konfigurací selže a nginx běží dál se starou — stránka se nezmění a vypadá to, že se oprava „neprojevila“. Proto vždy `nginx -t` před reloadem.',
    '502 Bad Gateway is an error between proxy and application: nginx could not connect, or got a nonsensical answer. (504 means the application did not answer in time.) The nginx error log always says where it tried to connect.\n\nReloading nginx with a broken configuration fails, and nginx keeps running the old one — the page does not change and it looks as though the fix "did not take". That is why `nginx -t` always comes before a reload.',
  ),
  resources: ['sheet-network', 'link-nginx-proxy', 'link-nginx-docs', 'man-ss'],
  reset: 'recreate',
  ttlMinutes: 120,
  verifiedOn: 'Debian 12 (bookworm), nginx 1.22',
  untested: true,
};
