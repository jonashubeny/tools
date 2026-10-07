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

## Lokální spuštění bez Dockeru

Hodí se pro vývoj a rychlé vyzkoušení. Pro převod prezentací musí být nainstalované LibreOffice (`soffice`) a poppler (`pdftoppm`).

Poprvé vytvořte virtuální prostředí a nainstalujte závislosti (ve složce projektu):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Pak aplikaci spusťte:

```bash
cd app
DATA_DIR=/tmp/prezentace-data ADMIN_PASSWORD=demo ../.venv/bin/flask --app app run --debug --port 8080
```

Aplikace běží na `http://localhost:8080`, přihlášení `admin` / `demo`. Ukončíte ji klávesami Ctrl+C.

- `DATA_DIR` je nutné nastavit, výchozí `/data` existuje jen v kontejneru. Smazáním této složky začnete s čistou databází.
- `ADMIN_PASSWORD` se použije jen při prvním startu s prázdnou databází.
- `--debug` znovu načítá šablony a Python při změně; po úpravě CSS obnovte stránku přes Ctrl+Shift+R.

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
