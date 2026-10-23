import { L } from '@lemma/core';
import type { ResourceDef } from './types';

/**
 * The resource library. Links go to official documentation only — the Debian manual pages
 * for the release the lab images run (bookworm), the upstream projects, the RFC editor —
 * and every one of them was checked to exist when it was added (the test suite keeps the
 * list to those hosts). Everything else is written for Lemma and says what it was checked
 * against.
 */

const DEBIAN = 'https://manpages.debian.org/bookworm';

const man = (id: string, page: string, pkg: string, skills: string[], title?: L): ResourceDef => ({
  id,
  kind: 'link',
  title: title ?? L(`Manuálová stránka ${page}`, `Manual page ${page}`),
  skills,
  url: `${DEBIAN}/${pkg}/${page.replace(/\((\w+)\)$/, '.$1')}.en.html`,
  verifiedOn: 'Debian 12 (bookworm)',
});

export const OFFICIAL_HOSTS = ['manpages.debian.org', 'www.debian.org', 'nginx.org', 'www.rfc-editor.org', 'www.freedesktop.org'];

export const RESOURCES: ResourceDef[] = [
  // ---- links to official documentation
  man('man-df', 'df(1)', 'coreutils', ['linux.storage']),
  man('man-du', 'du(1)', 'coreutils', ['linux.storage']),
  man('man-chmod', 'chmod(1)', 'coreutils', ['linux.permissions', 'sec.permissions']),
  man('man-find', 'find(1)', 'findutils', ['linux.filesystem', 'sec.permissions']),
  man('man-lsof', 'lsof(8)', 'lsof', ['linux.processes', 'linux.storage']),
  man('man-proc', 'proc(5)', 'manpages', ['linux.processes']),
  man('man-ps', 'ps(1)', 'procps', ['linux.processes']),
  man('man-systemctl', 'systemctl(1)', 'systemd', ['linux.systemd']),
  man('man-journalctl', 'journalctl(1)', 'systemd', ['linux.logs']),
  man('man-systemd-service', 'systemd.service(5)', 'systemd', ['linux.systemd', 'deploy.service']),
  man('man-systemd-exec', 'systemd.exec(5)', 'systemd', ['deploy.service']),
  man('man-nsswitch', 'nsswitch.conf(5)', 'manpages', ['net.dns']),
  man('man-hosts', 'hosts(5)', 'manpages', ['net.dns']),
  man('man-resolv-conf', 'resolv.conf(5)', 'manpages', ['net.dns']),
  man('man-getent', 'getent(1)', 'manpages', ['net.dns']),
  man('man-ss', 'ss(8)', 'iproute2', ['net.ports']),
  man('man-ip-address', 'ip-address(8)', 'iproute2', ['net.routing', 'net.tcpip']),
  man('man-crontab-5', 'crontab(5)', 'cron', ['ops.cron']),
  man('man-sshd-config', 'sshd_config(5)', 'openssh-server', ['sec.ssh']),
  {
    id: 'link-nginx-proxy',
    kind: 'link',
    title: L('nginx: modul ngx_http_proxy_module', 'nginx: the ngx_http_proxy_module'),
    skills: ['net.proxy'],
    url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html',
  },
  {
    id: 'link-nginx-docs',
    kind: 'link',
    title: L('Dokumentace nginx', 'nginx documentation'),
    skills: ['net.proxy', 'deploy.webapp'],
    url: 'https://nginx.org/en/docs/',
  },
  {
    id: 'link-rfc5737',
    kind: 'link',
    title: L('RFC 5737: adresy IPv4 pro dokumentaci', 'RFC 5737: IPv4 addresses reserved for documentation'),
    skills: ['net.tcpip', 'sec.logs'],
    url: 'https://www.rfc-editor.org/rfc/rfc5737',
  },
  {
    id: 'link-debian-reference',
    kind: 'link',
    title: L('Debian Reference (oficiální příručka)', 'Debian Reference (the official manual)'),
    skills: ['linux.filesystem', 'linux.users', 'linux.systemd', 'net.tcpip'],
    url: 'https://www.debian.org/doc/manuals/debian-reference/',
  },

  // ---- written for Lemma
  {
    id: 'checklist-troubleshooting',
    kind: 'checklist',
    title: L('Postup při hledání závady', 'A troubleshooting checklist'),
    skills: ['ops.troubleshooting'],
    verifiedOn: 'general practice',
    body: L(
      '1. **Popište příznak přesně.** Co nefunguje, odkud, od kdy, co se tehdy změnilo?\n2. **Zopakujte ho.** Bez reprodukce nepoznáte, že je opraveno.\n3. **Projděte vrstvy zdola:** místo na disku a paměť → proces běží → naslouchá (port, adresa) → odpovídá → konfigurace → logy.\n4. **Vyslovte hypotézu a ověřte ji jedním příkazem**, než cokoli změníte.\n5. **Měňte jednu věc najednou** a po každé změně příznak ověřte znovu.\n6. **Hledejte příčinu, ne jen příznak:** proč se to stalo a co zajistí, že se to nevrátí?\n7. **Zapište si, co jste zjistili a udělali** — další den to budete potřebovat.',
      '1. **State the symptom precisely.** What fails, from where, since when, what changed then?\n2. **Reproduce it.** Without a reproduction you cannot tell it is fixed.\n3. **Work through the layers from the bottom:** disk space and memory → the process runs → it listens (port, address) → it answers → configuration → logs.\n4. **Say a hypothesis and test it with one command** before changing anything.\n5. **Change one thing at a time**, and check the symptom again after each change.\n6. **Look for the cause, not just the symptom:** why did it happen, and what keeps it from coming back?\n7. **Write down what you found and did** — you will need it the next day.',
    ),
  },
  {
    id: 'sheet-disk',
    kind: 'cheatsheet',
    title: L('Místo na disku', 'Disk space'),
    skills: ['linux.storage'],
    verifiedOn: 'Debian 12, coreutils 9.1, lsof 4.95',
    body: L(
      '| Příkaz | Co ukáže |\n|---|---|\n| `df -h` | zaplnění po souborových systémech |\n| `df -i` | zaplnění inodů (hodně malých souborů) |\n| `du -xh /cesta \\| sort -h \\| tail` | největší adresáře, bez přecházení na jiné svazky |\n| `find /cesta -xdev -size +100M` | velké soubory |\n| `lsof +L1` | smazané, ale otevřené soubory |\n| `truncate -s 0 soubor` | vyprázdní soubor na místě (i otevřený) |\n\n**df ≠ du?** Nejčastěji smazaný otevřený soubor, nebo data schovaná pod připojeným svazkem.',
      '| Command | Shows |\n|---|---|\n| `df -h` | how full each filesystem is |\n| `df -i` | inode use (many small files) |\n| `du -xh /path \\| sort -h \\| tail` | the largest directories, staying on one filesystem |\n| `find /path -xdev -size +100M` | large files |\n| `lsof +L1` | deleted files still held open |\n| `truncate -s 0 file` | empties a file in place (even an open one) |\n\n**df ≠ du?** Most often a deleted file still open, or data hidden under a mount point.',
    ),
  },
  {
    id: 'sheet-processes',
    kind: 'cheatsheet',
    title: L('Procesy', 'Processes'),
    skills: ['linux.processes'],
    verifiedOn: 'Debian 12, procps 4.0, systemd 252',
    body: L(
      '| Příkaz | Co ukáže |\n|---|---|\n| `ps aux --sort=-%cpu \\| head` | procesy podle CPU |\n| `ps -ef --forest` | strom rodičů a potomků |\n| `top` / `top -o %MEM` | živý přehled |\n| `systemctl status PID` | ke které službě proces patří |\n| `ls -l /proc/PID/fd` | otevřené soubory procesu |\n| `kill PID` / `kill -9 PID` | TERM (slušně) / KILL (bez možnosti úklidu) |\n\nProces pod systemd zastavujte přes jeho službu — jinak ho `Restart=` vrátí.',
      '| Command | Shows |\n|---|---|\n| `ps aux --sort=-%cpu \\| head` | processes by CPU |\n| `ps -ef --forest` | the tree of parents and children |\n| `top` / `top -o %MEM` | a live view |\n| `systemctl status PID` | which service a process belongs to |\n| `ls -l /proc/PID/fd` | a process’s open files |\n| `kill PID` / `kill -9 PID` | TERM (politely) / KILL (no chance to clean up) |\n\nStop a process under systemd through its service — otherwise `Restart=` brings it back.',
    ),
  },
  {
    id: 'sheet-systemd',
    kind: 'cheatsheet',
    title: L('systemd', 'systemd'),
    skills: ['linux.systemd', 'deploy.service'],
    verifiedOn: 'Debian 12, systemd 252',
    body: L(
      '| Příkaz | K čemu |\n|---|---|\n| `systemctl status jednotka` | stav, PID, poslední řádky logu |\n| `journalctl -u jednotka -n 50 --no-pager` | log služby |\n| `journalctl -u jednotka -f` | sledování živě |\n| `systemctl cat jednotka` | unit soubor včetně drop-inů |\n| `systemctl daemon-reload` | načíst změněné unit soubory |\n| `systemctl enable --now jednotka` | povolit při startu a spustit |\n| `systemctl disable --now jednotka` | zakázat a zastavit |\n| `systemctl reset-failed jednotka` | vynulovat počítadlo neúspěšných startů |\n| `systemd-analyze verify soubor` | kontrola unit souboru |\n| `systemctl list-timers` | naplánované časovače |\n\n`status=203/EXEC`: program nejde spustit (cesta, oprávnění). Jiný kód vrací program sám.',
      '| Command | For |\n|---|---|\n| `systemctl status unit` | state, PID, last log lines |\n| `journalctl -u unit -n 50 --no-pager` | the service’s log |\n| `journalctl -u unit -f` | following it live |\n| `systemctl cat unit` | the unit file including drop-ins |\n| `systemctl daemon-reload` | load changed unit files |\n| `systemctl enable --now unit` | enable at boot and start |\n| `systemctl disable --now unit` | disable and stop |\n| `systemctl reset-failed unit` | clear the failed-start counter |\n| `systemd-analyze verify file` | check a unit file |\n| `systemctl list-timers` | scheduled timers |\n\n`status=203/EXEC`: the program cannot be executed (path, permissions). Other codes come from the program itself.',
    ),
  },
  {
    id: 'sheet-dns',
    kind: 'cheatsheet',
    title: L('Překlad jmen', 'Name resolution'),
    skills: ['net.dns'],
    verifiedOn: 'Debian 12, glibc 2.36, BIND 9.18',
    body: L(
      '| Příkaz | Co dělá |\n|---|---|\n| `getent hosts jméno` | přeloží jako aplikace (přes NSS) |\n| `grep ^hosts: /etc/nsswitch.conf` | pořadí zdrojů (files, dns, …) |\n| `cat /etc/hosts` | statické záznamy |\n| `cat /etc/resolv.conf` | DNS servery a doména hledání |\n| `dig jméno` / `dig @server jméno` | dotaz přímo na DNS server — **neřeší /etc/hosts** |\n\nV kontejneru jsou `/etc/hosts` a `/etc/resolv.conf` připojené soubory: editor je přepíše, `sed -i` (přejmenování) ne.',
      '| Command | Does |\n|---|---|\n| `getent hosts name` | resolves as an app would (through NSS) |\n| `grep ^hosts: /etc/nsswitch.conf` | the order of sources (files, dns, …) |\n| `cat /etc/hosts` | static entries |\n| `cat /etc/resolv.conf` | DNS servers and search domain |\n| `dig name` / `dig @server name` | asks a DNS server directly — **ignores /etc/hosts** |\n\nIn a container `/etc/hosts` and `/etc/resolv.conf` are mounted files: an editor can rewrite them, `sed -i` (a rename) cannot.',
    ),
  },
  {
    id: 'sheet-network',
    kind: 'cheatsheet',
    title: L('Síť a porty', 'Network and ports'),
    skills: ['net.ports', 'net.routing', 'net.tcpip'],
    verifiedOn: 'Debian 12, iproute2 6.1, curl 7.88',
    body: L(
      '| Příkaz | Co ukáže |\n|---|---|\n| `ip -br addr` | adresy rozhraní |\n| `ip route` / `ip route get ADRESA` | směrovací tabulka / kudy půjde paket |\n| `ss -ltnp` | naslouchající TCP porty a procesy |\n| `curl -v http://host:port/` | celý HTTP rozhovor |\n| `nc -vz host port` | je port otevřený? |\n| `ping -c1 host` | odpovídá stroj? (ICMP může být blokované) |\n\n`127.0.0.1:port` v `ss` = jen lokálně; `0.0.0.0:port` nebo `*:port` = na všech adresách.',
      '| Command | Shows |\n|---|---|\n| `ip -br addr` | interface addresses |\n| `ip route` / `ip route get ADDRESS` | the routing table / which way a packet goes |\n| `ss -ltnp` | listening TCP ports and their processes |\n| `curl -v http://host:port/` | the whole HTTP conversation |\n| `nc -vz host port` | is the port open? |\n| `ping -c1 host` | does the machine answer? (ICMP may be blocked) |\n\n`127.0.0.1:port` in `ss` = local only; `0.0.0.0:port` or `*:port` = on every address.',
    ),
  },
  {
    id: 'sheet-cron',
    kind: 'cheatsheet',
    title: L('cron', 'cron'),
    skills: ['ops.cron'],
    verifiedOn: 'Debian 12, cron 3.0pl1',
    body: L(
      '```\n# min hod den měs dtýd  [uživatel]  příkaz\n30   2   *   *   *      root        /usr/local/bin/job\n```\n\n- `crontab -e`: bez pole uživatele. `/etc/crontab` a `/etc/cron.d/*`: **s** polem uživatele.\n- Prostředí je minimální: `PATH=/usr/bin:/bin`, žádný `.bashrc`. Proměnné jde nastavit řádkem `PATH=…` v souboru.\n- Zkouška jako cron: `env -i PATH=/usr/bin:/bin sh -c "příkaz"`.\n- `%` má v crontabu zvláštní význam (nový řádek) — escapujte `\\%`.\n- Log: `journalctl -u cron` nebo `/var/log/syslog`.',
      '```\n# min hour dom mon dow  [user]  command\n30   2    *   *   *    root    /usr/local/bin/job\n```\n\n- `crontab -e`: no user field. `/etc/crontab` and `/etc/cron.d/*`: **with** a user field.\n- The environment is minimal: `PATH=/usr/bin:/bin`, no `.bashrc`. Variables can be set with a `PATH=…` line in the file.\n- Test as cron would: `env -i PATH=/usr/bin:/bin sh -c "command"`.\n- `%` means a newline in a crontab — escape it as `\\%`.\n- Log: `journalctl -u cron` or `/var/log/syslog`.',
    ),
  },
  {
    id: 'sheet-permissions',
    kind: 'cheatsheet',
    title: L('Oprávnění', 'Permissions'),
    skills: ['linux.permissions', 'sec.permissions'],
    verifiedOn: 'Debian 12, coreutils 9.1, findutils 4.9',
    body: L(
      '| Režim | Význam |\n|---|---|\n| `644` | vlastník čte a píše, ostatní čtou |\n| `600` | jen vlastník |\n| `755` | spustitelné, měnit smí jen vlastník |\n| `4755` | SUID: běží s právy vlastníka souboru |\n| `2775` | SGID na adresáři: nové soubory dědí skupinu |\n| `1777` | sticky (jako /tmp): mazat smí jen vlastník souboru |\n\n```sh\nfind / -xdev -type f -perm -4000          # SUID\nfind / -xdev -type f -perm -o+w           # zapisovatelné pro všechny\nstat -c \'%a %U:%G %n\' soubor\n```',
      '| Mode | Means |\n|---|---|\n| `644` | owner reads and writes, others read |\n| `600` | owner only |\n| `755` | executable, only the owner may change it |\n| `4755` | SUID: runs with the file owner’s rights |\n| `2775` | SGID on a directory: new files inherit the group |\n| `1777` | sticky (like /tmp): only a file’s owner may delete it |\n\n```sh\nfind / -xdev -type f -perm -4000          # SUID\nfind / -xdev -type f -perm -o+w           # writable by everyone\nstat -c \'%a %U:%G %n\' file\n```',
    ),
  },
  {
    id: 'sheet-logs',
    kind: 'cheatsheet',
    title: L('Čtení logů', 'Reading logs'),
    skills: ['linux.logs', 'sec.logs'],
    verifiedOn: 'Debian 12, systemd 252, GNU grep 3.8',
    body: L(
      '```sh\njournalctl -p err -b                    # chyby od startu\njournalctl --since "1 hour ago"\ngrep -c "Failed password" /var/log/auth.log\ngrep "Failed password" /var/log/auth.log | grep -oE "from [0-9.]+" | sort | uniq -c | sort -rn\ngrep -E "Accepted|sudo:" /var/log/auth.log\n```\n\nČasovou osu skládejte ze **všech** zdrojů — přihlášení, sudo, změny souborů (`ls -lt --time-style=full-iso`).',
      '```sh\njournalctl -p err -b                    # errors since boot\njournalctl --since "1 hour ago"\ngrep -c "Failed password" /var/log/auth.log\ngrep "Failed password" /var/log/auth.log | grep -oE "from [0-9.]+" | sort | uniq -c | sort -rn\ngrep -E "Accepted|sudo:" /var/log/auth.log\n```\n\nBuild the timeline from **every** source — logins, sudo, file changes (`ls -lt --time-style=full-iso`).',
    ),
  },
  {
    id: 'checklist-incident',
    kind: 'checklist',
    title: L('Triáž incidentu', 'Incident triage'),
    skills: ['sec.incident', 'sec.logs'],
    verifiedOn: 'general practice',
    body: L(
      '1. **Zachovejte důkazy.** Logy nemažte ani neupravujte; je-li to možné, zkopírujte je stranou.\n2. **Rozsah:** odkud, kdy, ke kterým účtům, co bylo spuštěno (sudo, nové procesy, nové služby).\n3. **Perzistence:** nové účty (zvlášť s UID 0), klíče v `authorized_keys`, služby a časovače, cron, změněné binárky.\n4. **Zadržení:** zamkněte kompromitované účty, odřízněte přístup.\n5. **Odstranění:** všechny nalezené cesty zpět, ne jen první.\n6. **Obnova:** nová hesla a klíče, ověření, že služby fungují.\n7. **Zpráva:** časová osa, dopad, příčina, provedené kroky, doporučení.',
      '1. **Preserve evidence.** Do not delete or edit logs; copy them aside if you can.\n2. **Scope:** from where, when, which accounts, what ran (sudo, new processes, new services).\n3. **Persistence:** new accounts (especially with UID 0), keys in `authorized_keys`, services and timers, cron, modified binaries.\n4. **Containment:** lock compromised accounts, cut access.\n5. **Eradication:** every way back you found, not just the first.\n6. **Recovery:** new passwords and keys, check that services work.\n7. **Report:** timeline, impact, cause, actions taken, recommendations.',
    ),
  },
  {
    id: 'checklist-ssh-hardening',
    kind: 'checklist',
    title: L('Zabezpečení SSH', 'Hardening SSH'),
    skills: ['sec.ssh'],
    verifiedOn: 'Debian 12, OpenSSH 9.2',
    body: L(
      '1. Nechte si otevřenou jednu fungující relaci, dokud novou konfiguraci neověříte v druhé.\n2. Vlastní nastavení do `/etc/ssh/sshd_config.d/00-*.conf` — načte se dřív než ostatní drop-iny.\n3. `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AllowUsers …` nebo `AllowGroups …`.\n4. `sshd -t` (syntaxe), pak `sshd -T` (efektivní hodnoty), pak `systemctl reload ssh`.\n5. `~/.ssh` 700, `authorized_keys` 600, vlastník uživatel — jinak sshd klíč odmítne (StrictModes).',
      '1. Keep one working session open until the new configuration is proven in a second one.\n2. Put your settings in `/etc/ssh/sshd_config.d/00-*.conf` — it is read before the other drop-ins.\n3. `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AllowUsers …` or `AllowGroups …`.\n4. `sshd -t` (syntax), then `sshd -T` (effective values), then `systemctl reload ssh`.\n5. `~/.ssh` 700, `authorized_keys` 600, owned by the user — otherwise sshd refuses the key (StrictModes).',
    ),
  },
];

export const RESOURCE_BY_ID = new Map(RESOURCES.map((resource) => [resource.id, resource]));
