#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  build-iso.sh – postaví bootovatelné live ISO (Debian + XFCE) z tools.list
#
#  Použití:   ./build-iso.sh            (auto: nativně na Debianu, jinak kontejner)
#             ./build-iso.sh --container (vždy přes podman/docker – doporučeno)
#             ./build-iso.sh --native    (jen na Debianu s nainstalovaným live-build)
#
#  Proměnné:  DIST=trixie  NAME=it-toolkit  KEYMAP=cz,us  TZ_LIVE=Europe/Prague
#  Výstup:    ./out/<NAME>-<DIST>-<datum>.iso  (hybrid ISO: BIOS + UEFI, jde na USB přes dd)
#  Live uživatel: it / heslo: live
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
DIST="${DIST:-trixie}"
NAME="${NAME:-it-toolkit}"
KEYMAP="${KEYMAP:-cz,us}"
TZ_LIVE="${TZ_LIVE:-Europe/Prague}"
LIVE_USER="${LIVE_USER:-it}"
MAX_BYTES=$((7200 * 1024 * 1024))   # 8GB flashka má reálně ~7.45 GiB, necháme rezervu

log()  { printf '\e[1;34m==>\e[0m %s\n' "$*"; }
warn() { printf '\e[1;33m[!]\e[0m %s\n' "$*" >&2; }
die()  { printf '\e[1;31m[x]\e[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$HERE/tools.list" ]] || die "Chybí $HERE/tools.list"

# ===========================================================================
#  1) VNĚJŠÍ ČÁST – rozhodne, jestli buildit nativně, nebo v kontejneru
# ===========================================================================
if [[ "${INSIDE_BUILD:-0}" != "1" ]]; then
  MODE="${1:---auto}"
  SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"

  if [[ "$MODE" == "--auto" ]]; then
    if [[ -f /etc/debian_version ]] && grep -qi '^ID=debian' /etc/os-release && command -v lb >/dev/null; then
      MODE="--native"; else MODE="--container"; fi
  fi

  case "$MODE" in
    --native)
      log "Build nativně na tomhle Debianu"
      exec $SUDO env INSIDE_BUILD=1 HOST_UID="$(id -u)" HOST_GID="$(id -g)" \
        DIST="$DIST" NAME="$NAME" KEYMAP="$KEYMAP" TZ_LIVE="$TZ_LIVE" LIVE_USER="$LIVE_USER" \
        NATIVE=1 bash "$HERE/build-iso.sh"
      ;;
    --container)
      ENGINE=""
      for e in podman docker; do command -v "$e" >/dev/null && { ENGINE="$e"; break; }; done
      [[ -n "$ENGINE" ]] || die "Nemám podman ani docker. Nainstaluj jeden z nich (Fedora: sudo dnf install podman, Ubuntu: sudo apt install podman)."
      log "Build v kontejneru ($ENGINE, debian:$DIST) – první běh stáhne ~1-2 GB balíčků"
      exec $SUDO "$ENGINE" run --rm --privileged \
        -v "$HERE":/work:Z -w /work \
        -e INSIDE_BUILD=1 -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
        -e DIST="$DIST" -e NAME="$NAME" -e KEYMAP="$KEYMAP" -e TZ_LIVE="$TZ_LIVE" -e LIVE_USER="$LIVE_USER" \
        "docker.io/library/debian:$DIST" bash /work/build-iso.sh
      ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) die "Neznámý přepínač: $MODE (použij --auto, --container nebo --native)" ;;
  esac
fi

# ===========================================================================
#  2) VNITŘNÍ ČÁST – běží jako root (v kontejneru nebo nativně)
# ===========================================================================
[[ $EUID -eq 0 ]] || die "Vnitřní build musí běžet jako root"
export DEBIAN_FRONTEND=noninteractive

if [[ "${NATIVE:-0}" != "1" ]]; then
  log "Připravuji build kontejner"
  # povolit contrib/non-free, ať jde ověřit firmware a spol.
  if [[ -f /etc/apt/sources.list.d/debian.sources ]]; then
    sed -i 's/^Components:.*/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources
  fi
  apt-get update -qq
  apt-get install -y -qq live-build ca-certificates xz-utils >/dev/null
fi
command -v lb >/dev/null || die "live-build (lb) není nainstalovaný"

# --- ověření balíčků z tools.list proti repozitáři ---
log "Kontroluji balíčky z tools.list"
mapfile -t ALL < <(sed 's/#.*//' "$HERE/tools.list" | tr -s ' \t' '\n' | sed '/^$/d' | sort -u)
OK=(); MISSING=()
for p in "${ALL[@]}"; do
  if apt-cache show "$p" >/dev/null 2>&1; then OK+=("$p"); else MISSING+=("$p"); fi
done
if (( ${#MISSING[@]} )); then
  if [[ "${NATIVE:-0}" == "1" ]]; then
    warn "Nenalezeno v repu hostitele (může jít jen o jiný release, nechávám je tam): ${MISSING[*]}"
    OK+=("${MISSING[@]}")
  else
    warn "Tyhle balíčky v Debianu $DIST nejsou a přeskakuju je: ${MISSING[*]}"
  fi
fi
log "${#OK[@]} balíčků půjde do ISO"

# --- pracovní adresář ---
B="$HERE/build"
# zachránit cache i po neúspěšném buildu
[[ -d "$B/cache" && ! -d "$HERE/.cache" ]] && mv "$B/cache" "$HERE/.cache"
rm -rf "$B"; mkdir -p "$B" "$HERE/out"
cd "$B"

log "Konfiguruji live-build"
lb config \
  --mode debian \
  --distribution "$DIST" \
  --architectures amd64 \
  --archive-areas "main contrib non-free non-free-firmware" \
  --binary-images iso-hybrid \
  --debian-installer none \
  --firmware-binary true \
  --firmware-chroot true \
  --memtest memtest86+ \
  --iso-volume "IT-TOOLKIT" \
  --iso-application "IT Toolkit" \
  --iso-publisher "jonas" \
  --image-name "$NAME" \
  --bootappend-live "boot=live components persistence quiet splash username=$LIVE_USER hostname=$NAME locales=en_US.UTF-8 keyboard-layouts=$KEYMAP keyboard-options=grp:alt_shift_toggle timezone=$TZ_LIVE" \
  >/dev/null

# seznam balíčků
printf '%s\n' "${OK[@]}" > config/package-lists/tools.list.chroot

# wireshark: povolit odchyt i bez roota (uživatel je ve skupině wireshark)
mkdir -p config/preseed
echo "wireshark-common wireshark-common/install-setuid boolean true" > config/preseed/wireshark.cfg.chroot

# skupiny live uživatele (+ wireshark, dialout pro sériovou konzoli, sudo)
mkdir -p config/includes.chroot_after_packages/etc/live/config.conf.d
cat > config/includes.chroot_after_packages/etc/live/config.conf.d/it-toolkit.conf <<CONF
LIVE_USER_DEFAULT_GROUPS="audio cdrom dip floppy video plugdev netdev powerdev scanner bluetooth sudo wireshark dialout disk"
CONF

# hook: bezpečnější výchozí stav + drobnosti
mkdir -p config/hooks/normal
cat > config/hooks/normal/9000-it-toolkit.hook.chroot <<'HOOK'
#!/bin/sh
set -e
# SSH server je nainstalovaný, ale NEstartuje sám (live heslo je veřejně známé).
# Zapnutí: sudo passwd it && sudo systemctl start ssh
systemctl disable ssh.service 2>/dev/null || true
systemctl disable ssh.socket  2>/dev/null || true
# ClamAV se nebude snažit aktualizovat hned při bootu bez sítě
systemctl disable clamav-freshclam.service 2>/dev/null || true
# en_US + cs_CZ locale
sed -i -e 's/^# *\(en_US.UTF-8\)/\1/' -e 's/^# *\(cs_CZ.UTF-8\)/\1/' /etc/locale.gen 2>/dev/null || true
locale-gen >/dev/null 2>&1 || true
HOOK
chmod +x config/hooks/normal/9000-it-toolkit.hook.chroot

# uvítací text v terminálu
mkdir -p config/includes.chroot_after_packages/etc
cat > config/includes.chroot_after_packages/etc/motd <<'MOTD'

  IT Toolkit live  ·  uživatel: it / heslo: live  ·  klávesnice: Alt+Shift = cz/us
  Rychlé tipy:  inxi -Fxz | sudo smartctl -a /dev/sda | sudo nmap -sn 192.168.1.0/24
                sudo testdisk | sudo photorec | sudo ddrescue | clonezilla | gparted
  SSH server:   sudo passwd it && sudo systemctl start ssh

MOTD

# znovupoužití stažených balíčků z minulého buildu
[[ -d "$HERE/.cache" ]] && mv "$HERE/.cache" "$B/cache"

log "Spouštím lb build (podle linky 10–40 min)…"
lb build 2>&1 | tee "$HERE/out/build.log" | grep -E '^(P:|E:|W:)' || true

ISO_SRC="$(ls -1 "$B"/*.iso 2>/dev/null | head -n1 || true)"
[[ -n "$ISO_SRC" ]] || die "ISO nevzniklo – koukni do out/build.log"

ISO_DST="$HERE/out/${NAME}-${DIST}-$(date +%Y%m%d).iso"
mv -f "$ISO_SRC" "$ISO_DST"
( cd "$HERE/out" && sha256sum "$(basename "$ISO_DST")" > "$(basename "$ISO_DST").sha256" )

# úklid: cache balíčků si necháme (.cache), zbytek build adresáře smažeme
[[ -d "$B/cache" ]] && mv "$B/cache" "$HERE/.cache"
cd "$HERE"; rm -rf "$B"
[[ -n "${HOST_UID:-}" ]] && chown -R "$HOST_UID:${HOST_GID:-$HOST_UID}" "$HERE/out"

SIZE=$(stat -c %s "$ISO_DST")
log "Hotovo: $ISO_DST ($((SIZE / 1024 / 1024)) MiB)"
if (( SIZE > MAX_BYTES )); then
  warn "ISO je větší než ~7 GiB – na 8GB flashku se nevejde! Uber něco z tools.list."
  exit 2
fi
log "Na flashku:  sudo ./flash-usb.sh /dev/sdX $ISO_DST   (volitelně --persistence)"
