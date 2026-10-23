/**
 * The one place that says how a lab container is confined. Every lab machine and every
 * capability probe is created from this spec, so a hardening change applies to all.
 *
 *   - no network at all, or only the lab's own internal network (no route out)
 *   - every capability dropped, then only what an ordinary Linux userland needs added back
 *     (no NET_RAW/NET_ADMIN unless a scenario names them, never SYS_ADMIN)
 *   - no-new-privileges, not privileged, no host mounts, no devices
 *   - memory without swap, CPU share and a process limit
 *   - /run, /run/lock and /tmp as size-limited tmpfs; container logs off (systemd's
 *     console chatter must not fill the host's disk)
 */

export const BASE_CAPABILITIES = [
  'CHOWN',
  'DAC_OVERRIDE',
  'FOWNER',
  'FSETID',
  'KILL',
  'SETGID',
  'SETUID',
  'SETPCAP',
  'NET_BIND_SERVICE',
  'SYS_CHROOT',
  'AUDIT_WRITE',
];

export interface MachineSpec {
  image: string;
  hostname: string;
  labels: Record<string, string>;
  /** systemd as PID 1; otherwise a sleeping init (tini) keeps the container up. */
  systemd: boolean;
  memoryMb: number;
  cpus: number;
  pids?: number;
  /** A network name, or null for none at all. */
  network: { name: string; address: string; aliases: string[] } | null;
  tmpfs?: { path: string; sizeMb: number }[];
  capAdd?: string[];
}

export function containerSpec(m: MachineSpec): Record<string, unknown> {
  const tmpfs: Record<string, string> = {
    '/run': 'rw,nosuid,nodev,size=64m',
    '/run/lock': 'rw,nosuid,nodev,noexec,size=8m',
    '/tmp': 'rw,nosuid,nodev,size=128m',
  };
  for (const mount of m.tmpfs ?? []) tmpfs[mount.path] = `rw,nosuid,nodev,size=${mount.sizeMb}m`;
  const memory = m.memoryMb * 1024 * 1024;
  return {
    Image: m.image,
    Hostname: m.hostname,
    Labels: m.labels,
    Cmd: m.systemd ? ['/sbin/init'] : ['sleep', 'infinity'],
    Env: ['container=docker', 'LANG=C.UTF-8'],
    StopSignal: m.systemd ? 'SIGRTMIN+3' : 'SIGTERM',
    Tty: false,
    OpenStdin: false,
    NetworkDisabled: m.network === null,
    HostConfig: {
      NetworkMode: m.network ? m.network.name : 'none',
      Memory: memory,
      MemorySwap: memory,
      NanoCpus: Math.round(m.cpus * 1e9),
      PidsLimit: m.pids ?? 512,
      CapDrop: ['ALL'],
      CapAdd: [...BASE_CAPABILITIES, ...(m.capAdd ?? [])],
      SecurityOpt: ['no-new-privileges'],
      Privileged: false,
      ReadonlyRootfs: false,
      Init: !m.systemd,
      CgroupnsMode: 'private',
      Tmpfs: tmpfs,
      LogConfig: { Type: 'none', Config: {} },
      RestartPolicy: { Name: 'no' },
      Dns: [],
      DnsSearch: [],
    },
    NetworkingConfig: m.network
      ? {
          EndpointsConfig: {
            [m.network.name]: { IPAMConfig: { IPv4Address: m.network.address }, Aliases: m.network.aliases },
          },
        }
      : undefined,
  };
}
