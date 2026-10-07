# Prezentace

Webový prohlížeč prezentací (PowerPoint a LibreOffice Impress) s přihlašováním, správou uživatelů a složkami.

## Spuštění

```bash
echo "ADMIN_PASSWORD=zvolte-silne-heslo" > .env
docker compose up -d --build
```

Aplikace běží na `http://<server>:8080`, přihlášení `admin` + heslo z `.env`.
`ADMIN_USER` / `ADMIN_PASSWORD` se použijí jen při prvním startu, dokud v databázi není žádný uživatel.

Data (databáze, nahrané soubory, vykreslené snímky) jsou ve volume `data` (`/data` v kontejneru).

## Nastavení (proměnné prostředí)

| Proměnná | Výchozí | Význam |
| --- | --- | --- |
| `MAX_UPLOAD_MB` | 500 | limit velikosti jednoho nahrání |
| `SLIDE_PX` | 1920 | délka delší strany vykreslených snímků v pixelech |
| `COOKIE_SECURE` | 0 | nastavte na 1, pokud aplikace běží za HTTPS |
| `CONVERT_TIMEOUT` | 600 | maximální doba převodu jedné prezentace v sekundách |

## Ovládání prohlížeče

| Klávesa | Akce |
| --- | --- |
| → / mezerník / PageDown / klik | další snímek |
| ← / PageUp / klik do levé třetiny | předchozí snímek |
| ↑ / ↓ | předchozí / další prezentace ve složce |
| F | celá obrazovka |
| B | zatmít obrazovku |
| Home / End | první / poslední snímek |

Vibecoded
