# IT Toolkit – nejpoužívanější nástroje pro ajťáka

Live USB postavené na **Debianu 13 (trixie)** s desktopem XFCE. Bootuje BIOS i UEFI,
vejde se na 8GB flashku a ještě zbude místo na persistentní oddíl.
Přesný seznam balíčků je v `tools.list` – ten jediný se upravuje.

## Síť – diagnostika
| Nástroj | K čemu |
|---|---|
| `ping`, `traceroute`, `mtr` | dostupnost, trasa, ztrátovost po hopech |
| `dig`, `nslookup`, `whois` | DNS dotazy, kdo vlastní doménu/IP |
| `nmap`, `arp-scan` | kdo je v síti, otevřené porty |
| `tcpdump`, `wireshark`, `tshark` | odchyt a analýza provozu |
| `iperf3` | měření propustnosti mezi dvěma stroji |
| `ethtool` | rychlost/duplex linky, stav kabelu |
| `iftop`, `nethogs`, `bmon` | kdo a co žere pásmo |
| `ipcalc`, `sipcalc` | výpočty subnetů |
| `iw`, `wavemon` | Wi-Fi: síla signálu, kanály, okolní sítě |
| `nc`, `socat`, `curl`, `wget` | test portů, HTTP, ruční spojení |

## Síť – vzdálený přístup
| Nástroj | K čemu |
|---|---|
| `ssh`, `sshfs`, `rsync` | vzdálený shell, připojení disku přes SSH, kopírování |
| Remmina, TigerVNC | RDP / VNC na Windows a servery |
| FileZilla | FTP/SFTP |
| `smbclient`, `cifs-utils`, `nfs-common` | Windows sdílení a NFS |
| `minicom`, `picocom` | sériová konzole (switche, routery, UPS) |

## Disky a zálohy
| Nástroj | K čemu |
|---|---|
| GParted, `parted`, `gdisk`, `fdisk`, Disks | správa oddílů (MBR i GPT) |
| `ntfs-3g`, `exfatprogs`, `btrfs-progs`, `xfsprogs`, … | práce se všemi běžnými FS |
| `lvm2`, `mdadm`, `cryptsetup` | LVM, softwarový RAID, LUKS |
| Clonezilla, `partclone`, `fsarchiver` | klonování a zálohy celých disků/oddílů |
| `f3` | odhalí falešné (fake-capacity) flashky |

## Záchrana dat a zdraví disků
| Nástroj | K čemu |
|---|---|
| `testdisk`, `photorec` | obnova ztracených oddílů a smazaných souborů |
| `ddrescue` | kopie umírajícího disku (nejdřív zachránit, pak zkoumat) |
| `smartctl`, `nvme-cli`, `hdparm` | SMART stav, NVMe log, secure erase |
| `dislocker` | odemčení BitLockeru (s recovery klíčem) |

## Hardware
| Nástroj | K čemu |
|---|---|
| `inxi -Fxz`, `lshw`, `hwinfo`, `dmidecode` | kompletní přehled HW, sériová čísla, RAM sloty |
| `lspci`, `lsusb` | co je v PCI/USB |
| `sensors`, `s-tui` | teploty, takty |
| `stress-ng`, `memtester`, **Memtest86+** (v boot menu) | zátěžový test CPU/RAM |

## Windows záchrana
| Nástroj | K čemu |
|---|---|
| `chntpw` | reset/odemčení lokálního účtu ve Windows |
| `wimtools` | práce s .wim (instalačky Windows) |
| `efibootmgr`, `os-prober` | oprava UEFI boot záznamů |

## Bezpečnost
| Nástroj | K čemu |
|---|---|
| ClamAV | offline sken disku na malware |
| `chkrootkit`, `rkhunter` | hledání rootkitů na Linuxu |
| KeePassXC, `gnupg`, `pwgen` | hesla, šifrování, generování hesel |

## Každodenní CLI
`htop`, `btop`, `tmux`, `vim`, `nano`, `mc`, `ncdu`, `tree`, `lsof`, `strace`, `pv`, `git`, `jq`, `7z`, `zip`, `unrar`
