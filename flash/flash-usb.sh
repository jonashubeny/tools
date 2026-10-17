#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  flash-usb.sh – zapíše ISO na flashku, volitelně přidá persistentní oddíl
#
#  Použití:  sudo ./flash-usb.sh /dev/sdX [cesta.iso] [--persistence]
#            bez cesty k ISO vezme nejnovější z ./out/
#  --persistence  zbytek flashky = ext4 oddíl "persistence" → změny, uložené
#                 soubory a doinstalované balíčky přežijí restart
#  POZOR: celý obsah zadaného zařízení bude SMAZÁN.
# ---------------------------------------------------------------------------
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
die() { printf '\e[1;31m[x]\e[0m %s\n' "$*" >&2; exit 1; }
log() { printf '\e[1;34m==>\e[0m %s\n' "$*"; }

[[ $EUID -eq 0 ]] || die "Spusť přes sudo"

DEV=""; ISO=""; PERSIST=0
for a in "$@"; do
  case "$a" in
    --persistence) PERSIST=1 ;;
    /dev/*) DEV="$a" ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) ISO="$a" ;;
  esac
done

if [[ -z "$DEV" ]]; then
  echo "Dostupné USB disky:"; lsblk -dpo NAME,SIZE,MODEL,TRAN,RM | awk 'NR==1 || /usb/'
  die "Zadej zařízení, např.: sudo $0 /dev/sdb"
fi
[[ -z "$ISO" ]] && ISO="$(ls -1t "$HERE"/out/*.iso 2>/dev/null | head -n1 || true)"
[[ -f "$ISO" ]] || die "ISO nenalezeno (nejdřív ./build-iso.sh)"
[[ -b "$DEV" ]] || die "$DEV není blokové zařízení"
[[ "$(lsblk -dno TYPE "$DEV")" == "disk" ]] || die "$DEV musí být celý disk (/dev/sdb), ne oddíl (/dev/sdb1)"

# --- pojistky, ať nepřepíšeš systémový disk ---
ROOT_DISK="$(lsblk -no PKNAME "$(findmnt -no SOURCE /)" 2>/dev/null | head -n1 || true)"
[[ -n "$ROOT_DISK" && "/dev/$ROOT_DISK" == "$DEV" ]] && die "$DEV je disk, ze kterého běží systém!"
TRAN="$(lsblk -dno TRAN "$DEV")"; RM="$(lsblk -dno RM "$DEV")"
if [[ "$TRAN" != "usb" && "$RM" != "1" ]]; then
  die "$DEV nevypadá jako USB/vyměnitelný disk (TRAN=$TRAN RM=$RM). Pro jistotu končím."
fi
DEV_BYTES=$(blockdev --getsize64 "$DEV"); ISO_BYTES=$(stat -c %s "$ISO")
(( ISO_BYTES < DEV_BYTES )) || die "ISO ($((ISO_BYTES/1024/1024)) MiB) je větší než flashka ($((DEV_BYTES/1024/1024)) MiB)"

echo; lsblk -po NAME,SIZE,MODEL,FSTYPE,LABEL,MOUNTPOINTS "$DEV"; echo
echo "ISO:  $ISO  ($((ISO_BYTES/1024/1024)) MiB)"
echo "Cíl:  $DEV  ($((DEV_BYTES/1000/1000/1000)) GB)   persistence: $([[ $PERSIST == 1 ]] && echo ano || echo ne)"
read -rp $'\e[1;31mVšechna data na '"$DEV"$' budou smazána. Napiš ANO pro pokračování: \e[0m' ans
[[ "$ans" == "ANO" ]] || die "Zrušeno"

# ověřit checksum, pokud existuje
if [[ -f "$ISO.sha256" ]]; then
  log "Ověřuji SHA256 ISO"; (cd "$(dirname "$ISO")" && sha256sum -c --quiet "$(basename "$ISO").sha256") || die "Checksum nesedí!"
fi

log "Odpojuji oddíly na $DEV"
for p in $(lsblk -lnpo NAME "$DEV" | tail -n +2); do umount "$p" 2>/dev/null || true; done

log "Zapisuji ISO (dd)…"
dd if="$ISO" of="$DEV" bs=4M status=progress conv=fsync oflag=direct
sync

if [[ $PERSIST == 1 ]]; then
  log "Přidávám persistentní oddíl do zbytku místa"
  partprobe "$DEV" 2>/dev/null || true; sleep 2
  echo ',,L' | sfdisk --append --no-reread --force "$DEV" >/dev/null
  partprobe "$DEV" 2>/dev/null || blockdev --rereadpt "$DEV" 2>/dev/null || true
  udevadm settle; sleep 2
  PART="$(lsblk -lnpo NAME,TYPE "$DEV" | awk '$2=="part"{p=$1} END{print p}')"
  [[ -b "$PART" ]] || die "Nový oddíl se neobjevil – vytáhni a zasuň flashku a zkus to znovu"
  mkfs.ext4 -q -F -L persistence "$PART"
  MNT="$(mktemp -d)"; mount "$PART" "$MNT"
  echo "/ union" > "$MNT/persistence.conf"
  umount "$MNT"; rmdir "$MNT"
  log "Persistence: $PART ($(lsblk -dno SIZE "$PART"))"
fi

sync
log "Hotovo. Flashku můžeš vytáhnout a nabootovat (F12/F8/Esc pro boot menu)."
