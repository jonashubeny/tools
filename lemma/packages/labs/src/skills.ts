import { L } from '@lemma/core';
import type { Category, PlannedTopic, SkillDef } from './types';

const skill = (id: string, category: Category, title: L, description: L, prerequisites: string[] = []): SkillDef => ({
  id,
  category,
  title,
  description,
  prerequisites,
});

/**
 * The skills of the Linux & Infrastructure mode, in roadmap order within each category.
 * Proficiency is tracked per skill; scenarios name the skills they exercise.
 */
export const SKILLS: SkillDef[] = [
  // ---- Linux fundamentals
  skill(
    'linux.filesystem',
    'linux',
    L('Souborový systém a navigace', 'Filesystem and navigation'),
    L('Adresářová struktura, cesty, hledání souborů (find, ls, less).', 'Directory layout, paths, finding files (find, ls, less).'),
  ),
  skill(
    'linux.permissions',
    'linux',
    L('Oprávnění', 'Permissions'),
    L('Vlastník, skupina, režimy rwx, SUID a jejich dopady.', 'Owner, group, rwx modes, SUID and what they allow.'),
    ['linux.filesystem'],
  ),
  skill(
    'linux.users',
    'linux',
    L('Uživatelé, skupiny, sudo, SSH', 'Users, groups, sudo, SSH'),
    L('Účty, skupiny, zamykání účtů, klíče SSH.', 'Accounts, groups, locking accounts, SSH keys.'),
    ['linux.permissions'],
  ),
  skill(
    'linux.processes',
    'linux',
    L('Procesy', 'Processes'),
    L('ps, top, signály, rodiče a potomci, co drží otevřené soubory.', 'ps, top, signals, parents and children, open files.'),
    ['linux.filesystem'],
  ),
  skill(
    'linux.systemd',
    'linux',
    L('Služby a systemd', 'Services and systemd'),
    L('Jednotky, stavy, povolení při startu, restart, daemon-reload.', 'Units, states, enabling at boot, restarts, daemon-reload.'),
    ['linux.processes'],
  ),
  skill(
    'linux.logs',
    'linux',
    L('Logy a journal', 'Logs and the journal'),
    L('journalctl, /var/log, čtení chybových hlášek.', 'journalctl, /var/log, reading error messages.'),
    ['linux.filesystem'],
  ),
  skill(
    'linux.storage',
    'linux',
    L('Úložiště a místo na disku', 'Storage and disk space'),
    L('df, du, připojené svazky, smazané ale otevřené soubory.', 'df, du, mounts, deleted-but-open files.'),
    ['linux.filesystem'],
  ),
  skill(
    'linux.scripting',
    'linux',
    L('Bash a základní automatizace', 'Bash and basic automation'),
    L('Skripty, návratové kódy, proměnné prostředí, PATH.', 'Scripts, exit codes, environment variables, PATH.'),
    ['linux.filesystem'],
  ),
  // ---- Networking
  skill(
    'net.tcpip',
    'networking',
    L('TCP/IP a podsítě', 'TCP/IP and subnetting'),
    L('Adresy, masky, brány, porty.', 'Addresses, masks, gateways, ports.'),
  ),
  skill(
    'net.routing',
    'networking',
    L('Rozhraní a směrování', 'Interfaces and routing'),
    L('ip addr, ip route, výchozí brána, dosažitelnost.', 'ip addr, ip route, default gateway, reachability.'),
    ['net.tcpip'],
  ),
  skill(
    'net.dns',
    'networking',
    L('Překlad jmen (DNS)', 'Name resolution (DNS)'),
    L('/etc/hosts, resolv.conf, nsswitch, getent, dig.', '/etc/hosts, resolv.conf, nsswitch, getent, dig.'),
    ['net.tcpip'],
  ),
  skill(
    'net.ports',
    'networking',
    L('Naslouchající porty a dosažitelnost služeb', 'Listening ports and service reachability'),
    L('ss, curl, na jaké adrese a portu služba poslouchá.', 'ss, curl, which address and port a service listens on.'),
    ['net.tcpip', 'linux.processes'],
  ),
  skill(
    'net.firewall',
    'networking',
    L('Firewall', 'Firewall'),
    L('nftables, výchozí politika, co je otevřené.', 'nftables, default policy, what is exposed.'),
    ['net.ports'],
  ),
  skill(
    'net.proxy',
    'networking',
    L('Reverzní proxy a TLS', 'Reverse proxies and TLS'),
    L('nginx před aplikací, upstreamy, chyby 502 a 504, certifikáty.', 'nginx in front of an app, upstreams, 502 and 504 errors, certificates.'),
    ['net.ports', 'linux.systemd'],
  ),
  // ---- Server operations
  skill(
    'ops.troubleshooting',
    'operations',
    L('Systematické hledání příčin', 'Systematic troubleshooting'),
    L('Od příznaku k příčině: hypotéza, ověření, změna, kontrola.', 'From symptom to cause: hypothesis, test, change, verify.'),
    ['linux.logs'],
  ),
  skill(
    'ops.cron',
    'operations',
    L('Plánované úlohy', 'Scheduled jobs'),
    L('cron, prostředí úloh, oprávnění skriptů.', 'cron, the environment jobs run in, script permissions.'),
    ['linux.scripting'],
  ),
  skill(
    'ops.backup',
    'operations',
    L('Zálohy a obnova', 'Backup and restore'),
    L('Záloha, která se dá obnovit, a ověření obnovy.', 'A backup that can be restored, and proving it.'),
    ['linux.storage'],
  ),
  // ---- Deployment and automation
  skill(
    'deploy.service',
    'deployment',
    L('Vlastní služba systemd', 'Writing a systemd service'),
    L('Unit soubor, restart při selhání, povolení, kontrola zdraví.', 'A unit file, restart on failure, enabling, health checks.'),
    ['linux.systemd'],
  ),
  skill(
    'deploy.webapp',
    'deployment',
    L('Nasazení webové aplikace', 'Deploying a web application'),
    L('Aplikace, služba, proxy a kontrola, že to celé funguje.', 'App, service, proxy, and checking that the whole works.'),
    ['deploy.service', 'net.proxy'],
  ),
  skill(
    'deploy.ansible',
    'deployment',
    L('Automatizace s Ansible', 'Automation with Ansible'),
    L('Idempotentní provisioning, inventář, playbooky.', 'Idempotent provisioning, inventory, playbooks.'),
    ['linux.scripting'],
  ),
  // ---- Defensive security
  skill(
    'sec.permissions',
    'security',
    L('Nebezpečná oprávnění', 'Insecure permissions'),
    L('SUID binárky, zapisovatelné skripty spouštěné rootem, čitelná tajemství.', 'SUID binaries, writable scripts run by root, readable secrets.'),
    ['linux.permissions'],
  ),
  skill(
    'sec.logs',
    'security',
    L('Vyšetřování z logů', 'Investigating from logs'),
    L('auth.log, pokusy o přihlášení, časová osa události.', 'auth.log, login attempts, the timeline of an incident.'),
    ['linux.logs'],
  ),
  skill(
    'sec.ssh',
    'security',
    L('Zabezpečení SSH', 'Hardening SSH'),
    L('sshd_config, klíče místo hesel, sshd -T.', 'sshd_config, keys instead of passwords, sshd -T.'),
    ['linux.users'],
  ),
  skill(
    'sec.incident',
    'security',
    L('Triáž incidentu a zpráva', 'Incident triage and reporting'),
    L('Rozsah, perzistence, náprava, srozumitelná zpráva.', 'Scope, persistence, remediation, a clear report.'),
    ['sec.logs'],
  ),
];

export const SKILL_BY_ID = new Map(SKILLS.map((entry) => [entry.id, entry]));

/** Topics the roadmap promises but that have no lab yet. Shown as planned, never as playable. */
export const PLANNED: PlannedTopic[] = [
  { category: 'networking', skill: 'net.tcpip', title: L('Podsítě a masky v praxi', 'Subnets and masks in practice') },
  { category: 'networking', skill: 'net.routing', title: L('DHCP a přidělování adres', 'DHCP and address configuration') },
  { category: 'networking', skill: 'net.firewall', title: L('Pravidla nftables, která blokují službu', 'nftables rules that block a service') },
  { category: 'networking', skill: 'net.proxy', title: L('TLS certifikát a HTTPS na proxy', 'A TLS certificate and HTTPS on the proxy') },
  { category: 'operations', skill: 'ops.backup', title: L('Ověření obnovy ze zálohy', 'Verifying a restore from backup') },
  { category: 'operations', skill: 'ops.troubleshooting', title: L('Monitoring a analýza logů', 'Monitoring and log analysis') },
  { category: 'deployment', skill: 'deploy.ansible', title: L('Provisioning s Ansible', 'Provisioning with Ansible') },
  { category: 'deployment', skill: 'deploy.webapp', title: L('Jednoduchá CI/CD pipeline', 'A basic CI/CD pipeline') },
  { category: 'deployment', skill: 'deploy.webapp', title: L('Služba v kontejneru (Podman)', 'A service in a container (Podman)') },
  { category: 'security', skill: 'sec.incident', title: L('Neočekávaná služba naslouchající na portu', 'An unexpected service listening on a port') },
  { category: 'security', skill: 'net.firewall', title: L('Revize vystavení firewallem', 'Reviewing firewall exposure') },
];
