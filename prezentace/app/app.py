import os
import queue
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import time
from functools import wraps
from pathlib import Path

from flask import (Flask, abort, flash, g, redirect, render_template, request,
                   send_from_directory, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
FILES_DIR = DATA_DIR / "files"
DB_PATH = DATA_DIR / "app.db"
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "500"))
SLIDE_PX = int(os.environ.get("SLIDE_PX", "1920"))
CONVERT_TIMEOUT = int(os.environ.get("CONVERT_TIMEOUT", "600"))
ALLOWED_EXT = {".pptx", ".ppt", ".ppsx", ".pps", ".pptm", ".potx", ".odp", ".otp", ".fodp"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS presentations (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    error TEXT,
    slide_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def load_secret_key():
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    path = DATA_DIR / "secret_key"
    if not path.exists():
        path.write_text(secrets.token_hex(32))
        path.chmod(0o600)
    return path.read_text().strip()


def init_db():
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    if not conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        username = os.environ.get("ADMIN_USER", "admin")
        password = os.environ.get("ADMIN_PASSWORD")
        if not password:
            password = secrets.token_urlsafe(12)
            print(f"*** Vytvořen administrátor '{username}' s heslem: {password}", flush=True)
        conn.execute("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)",
                     (username, generate_password_hash(password)))
    conn.commit()
    conn.close()


# --- conversion worker -------------------------------------------------------

convert_queue = queue.Queue()


def convert(pid):
    conn = connect()
    try:
        row = conn.execute("SELECT stored_name FROM presentations WHERE id = ?", (pid,)).fetchone()
        if not row:
            return
        pdir = FILES_DIR / str(pid)
        src = pdir / row["stored_name"]
        try:
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(
                    ["soffice", f"-env:UserInstallation=file://{tmp}/profile", "--headless",
                     "--norestore", "--convert-to", "pdf", "--outdir", tmp, str(src)],
                    check=True, timeout=CONVERT_TIMEOUT, capture_output=True)
                pdf = Path(tmp) / (src.stem + ".pdf")
                if not pdf.exists():
                    raise RuntimeError("LibreOffice soubor nedokázal převést")
                subprocess.run(
                    ["pdftoppm", "-jpeg", "-jpegopt", "quality=90", "-scale-to", str(SLIDE_PX),
                     str(pdf), str(Path(tmp) / "s")],
                    check=True, timeout=CONVERT_TIMEOUT, capture_output=True)
                pages = sorted(Path(tmp).glob("s-*.jpg"), key=lambda p: int(p.stem.split("-")[-1]))
                if not pages:
                    raise RuntimeError("Prezentace neobsahuje žádné snímky")
                subprocess.run(
                    ["pdftoppm", "-jpeg", "-scale-to", "480", "-f", "1", "-l", "1", "-singlefile",
                     str(pdf), str(Path(tmp) / "thumb")],
                    check=True, timeout=CONVERT_TIMEOUT, capture_output=True)
                slides = pdir / "slides"
                shutil.rmtree(slides, ignore_errors=True)
                slides.mkdir()
                for i, page in enumerate(pages, 1):
                    shutil.move(page, slides / f"{i}.jpg")
                shutil.move(Path(tmp) / "thumb.jpg", slides / "thumb.jpg")
            conn.execute("UPDATE presentations SET status = 'ready', error = NULL, slide_count = ? WHERE id = ?",
                         (len(pages), pid))
        except subprocess.TimeoutExpired:
            conn.execute("UPDATE presentations SET status = 'failed', error = ? WHERE id = ?",
                         ("Převod trval příliš dlouho", pid))
        except Exception as exc:
            app.logger.exception("Převod prezentace %s selhal", pid)
            msg = str(exc) if isinstance(exc, RuntimeError) else "Soubor se nepodařilo převést"
            conn.execute("UPDATE presentations SET status = 'failed', error = ? WHERE id = ?", (msg, pid))
        conn.commit()
    finally:
        conn.close()


def worker():
    while True:
        pid = convert_queue.get()
        try:
            convert(pid)
        except Exception:
            app.logger.exception("Chyba při převodu %s", pid)


# --- app ---------------------------------------------------------------------

DATA_DIR.mkdir(parents=True, exist_ok=True)
app = Flask(__name__)
app.config.update(
    SECRET_KEY=load_secret_key(),
    MAX_CONTENT_LENGTH=MAX_UPLOAD_MB * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)
init_db()

# Presentations left unfinished by a restart go back into the queue.
_conn = connect()
for _row in _conn.execute("SELECT id FROM presentations WHERE status = 'processing' ORDER BY id"):
    convert_queue.put(_row["id"])
_conn.close()
threading.Thread(target=worker, daemon=True).start()


def db():
    if "db" not in g:
        g.db = connect()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


@app.before_request
def before_request():
    if "csrf" not in session:
        session["csrf"] = secrets.token_hex(16)
    if request.method == "POST":
        token = request.form.get("csrf") or request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(token, session["csrf"]):
            abort(400, "Neplatný formulář, načtěte stránku znovu.")
    g.user = None
    if session.get("uid"):
        g.user = db().execute("SELECT * FROM users WHERE id = ?", (session["uid"],)).fetchone()
        if g.user is None:
            session.clear()


@app.context_processor
def inject():
    return {"user": g.get("user"), "csrf": session.get("csrf", ""), "max_upload_mb": MAX_UPLOAD_MB,
            "allowed_ext": ",".join(sorted(ALLOWED_EXT))}


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user is None:
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not g.user["is_admin"]:
            abort(403)
        return view(*args, **kwargs)
    return wrapped


def back(folder_id=None):
    return redirect(url_for("browse", folder_id=folder_id) if folder_id else url_for("browse"))


def own_folder(folder_id):
    row = db().execute("SELECT * FROM folders WHERE id = ? AND owner_id = ?",
                       (folder_id, g.user["id"])).fetchone()
    if row is None:
        abort(404)
    return row


def own_presentation(pid):
    row = db().execute("SELECT * FROM presentations WHERE id = ? AND owner_id = ?",
                       (pid, g.user["id"])).fetchone()
    if row is None:
        abort(404)
    return row


def clean_name(value):
    name = " ".join((value or "").split())[:200]
    if not name:
        abort(400, "Název nesmí být prázdný.")
    return name


def remove_files(pids):
    for pid in pids:
        shutil.rmtree(FILES_DIR / str(pid), ignore_errors=True)


# --- auth --------------------------------------------------------------------

failed_logins = {}
MAX_FAILS, LOCK_SECONDS = 8, 300


@app.route("/login", methods=["GET", "POST"])
def login():
    if g.user:
        return back()
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        key = (request.remote_addr, username.lower())
        count, since = failed_logins.get(key, (0, 0))
        if time.time() - since > LOCK_SECONDS:
            count = 0
        if count >= MAX_FAILS:
            flash("Příliš mnoho neúspěšných pokusů, zkuste to za pár minut.", "error")
            return render_template("login.html"), 429
        row = db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if row and check_password_hash(row["password_hash"], request.form.get("password", "")):
            failed_logins.pop(key, None)
            session.clear()
            session["uid"] = row["id"]
            session.permanent = True
            return back()
        failed_logins[key] = (count + 1, since if count else time.time())
        flash("Nesprávné jméno nebo heslo.", "error")
    return render_template("login.html")


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/account", methods=["GET", "POST"])
@login_required
def account():
    if request.method == "POST":
        new = request.form.get("new_password", "")
        if not check_password_hash(g.user["password_hash"], request.form.get("old_password", "")):
            flash("Současné heslo nesouhlasí.", "error")
        elif len(new) < 8:
            flash("Nové heslo musí mít alespoň 8 znaků.", "error")
        else:
            db().execute("UPDATE users SET password_hash = ? WHERE id = ?",
                         (generate_password_hash(new), g.user["id"]))
            db().commit()
            flash("Heslo bylo změněno.", "ok")
        return redirect(url_for("account"))
    return render_template("account.html")


# --- folders & presentations -------------------------------------------------

@app.get("/")
@app.get("/f/<int:folder_id>")
@login_required
def browse(folder_id=None):
    conn = db()
    crumbs = []
    if folder_id is not None:
        node = own_folder(folder_id)
        while node:
            crumbs.insert(0, node)
            node = conn.execute("SELECT * FROM folders WHERE id = ?", (node["parent_id"],)).fetchone()
    folders = conn.execute(
        "SELECT * FROM folders WHERE owner_id = ? AND parent_id IS ? ORDER BY name COLLATE NOCASE",
        (g.user["id"], folder_id)).fetchall()
    presentations = conn.execute(
        "SELECT * FROM presentations WHERE owner_id = ? AND folder_id IS ? ORDER BY title COLLATE NOCASE",
        (g.user["id"], folder_id)).fetchall()
    return render_template("browse.html", folder_id=folder_id, crumbs=crumbs, folders=folders,
                           presentations=presentations)


@app.post("/folders")
@login_required
def folder_create():
    parent_id = request.form.get("parent_id", type=int)
    if parent_id is not None:
        own_folder(parent_id)
    db().execute("INSERT INTO folders (owner_id, parent_id, name) VALUES (?, ?, ?)",
                 (g.user["id"], parent_id, clean_name(request.form.get("name"))))
    db().commit()
    return back(parent_id)


@app.post("/folders/<int:folder_id>/rename")
@login_required
def folder_rename(folder_id):
    folder = own_folder(folder_id)
    db().execute("UPDATE folders SET name = ? WHERE id = ?", (clean_name(request.form.get("name")), folder_id))
    db().commit()
    return back(folder["parent_id"])


@app.post("/folders/<int:folder_id>/delete")
@login_required
def folder_delete(folder_id):
    folder = own_folder(folder_id)
    conn = db()
    pids = [r["id"] for r in conn.execute(
        """WITH RECURSIVE tree(id) AS (
               SELECT ? UNION ALL SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id)
           SELECT id FROM presentations WHERE folder_id IN (SELECT id FROM tree)""", (folder_id,))]
    conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    conn.commit()
    remove_files(pids)
    return back(folder["parent_id"])


@app.post("/upload")
@login_required
def upload():
    folder_id = request.form.get("folder_id", type=int)
    if folder_id is not None:
        own_folder(folder_id)
    conn = db()
    skipped = []
    for file in request.files.getlist("files"):
        original = Path((file.filename or "").replace("\\", "/")).name
        ext = Path(original).suffix.lower()
        if not original:
            continue
        if ext not in ALLOWED_EXT:
            skipped.append(original)
            continue
        cur = conn.execute(
            "INSERT INTO presentations (owner_id, folder_id, title, stored_name) VALUES (?, ?, ?, ?)",
            (g.user["id"], folder_id, Path(original).stem[:200] or "Prezentace", "source" + ext))
        conn.commit()
        pdir = FILES_DIR / str(cur.lastrowid)
        pdir.mkdir(parents=True, exist_ok=True)
        file.save(pdir / ("source" + ext))
        convert_queue.put(cur.lastrowid)
    if skipped:
        flash("Nepodporovaný formát, přeskočeno: " + ", ".join(skipped), "error")
    return back(folder_id)


@app.get("/status")
@login_required
def status():
    rows = db().execute("SELECT id, status FROM presentations WHERE owner_id = ?", (g.user["id"],))
    return {str(r["id"]): r["status"] for r in rows}


@app.post("/p/<int:pid>/rename")
@login_required
def presentation_rename(pid):
    pres = own_presentation(pid)
    db().execute("UPDATE presentations SET title = ? WHERE id = ?", (clean_name(request.form.get("name")), pid))
    db().commit()
    return back(pres["folder_id"])


@app.post("/p/<int:pid>/delete")
@login_required
def presentation_delete(pid):
    pres = own_presentation(pid)
    db().execute("DELETE FROM presentations WHERE id = ?", (pid,))
    db().commit()
    remove_files([pid])
    return back(pres["folder_id"])


@app.get("/p/<int:pid>")
@login_required
def viewer(pid):
    pres = own_presentation(pid)
    if pres["status"] != "ready":
        return back(pres["folder_id"])
    rows = db().execute(
        """SELECT id, title, slide_count FROM presentations
           WHERE owner_id = ? AND folder_id IS ? AND status = 'ready' ORDER BY title COLLATE NOCASE""",
        (g.user["id"], pres["folder_id"])).fetchall()
    playlist = [{"id": r["id"], "title": r["title"], "slides": r["slide_count"]} for r in rows]
    start = next(i for i, p in enumerate(playlist) if p["id"] == pid)
    back_url = url_for("browse", folder_id=pres["folder_id"]) if pres["folder_id"] else url_for("browse")
    return render_template("viewer.html", pres=pres, back_url=back_url,
                           data={"playlist": playlist, "start": start})


@app.get("/p/<int:pid>/slide/<name>.jpg")
@login_required
def slide(pid, name):
    own_presentation(pid)
    if name != "thumb" and not name.isdigit():
        abort(404)
    resp = send_from_directory(FILES_DIR / str(pid) / "slides", f"{name}.jpg", max_age=3600)
    resp.headers["Cache-Control"] = "private, max-age=3600"
    return resp


# --- admin -------------------------------------------------------------------

@app.get("/admin")
@admin_required
def admin():
    users = db().execute(
        """SELECT u.*, (SELECT COUNT(*) FROM presentations p WHERE p.owner_id = u.id) AS pres_count
           FROM users u ORDER BY u.username COLLATE NOCASE""").fetchall()
    return render_template("admin.html", users=users)


@app.post("/admin/users")
@admin_required
def admin_user_create():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    if not username or len(username) > 64:
        flash("Zadejte uživatelské jméno (max. 64 znaků).", "error")
    elif len(password) < 8:
        flash("Heslo musí mít alespoň 8 znaků.", "error")
    else:
        try:
            db().execute("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)",
                         (username, generate_password_hash(password), 1 if request.form.get("is_admin") else 0))
            db().commit()
            flash(f"Uživatel {username} byl vytvořen.", "ok")
        except sqlite3.IntegrityError:
            flash("Uživatel s tímto jménem už existuje.", "error")
    return redirect(url_for("admin"))


@app.post("/admin/users/<int:uid>/password")
@admin_required
def admin_user_password(uid):
    password = request.form.get("password", "")
    if len(password) < 8:
        flash("Heslo musí mít alespoň 8 znaků.", "error")
    else:
        db().execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(password), uid))
        db().commit()
        flash("Heslo bylo nastaveno.", "ok")
    return redirect(url_for("admin"))


@app.post("/admin/users/<int:uid>/delete")
@admin_required
def admin_user_delete(uid):
    if uid == g.user["id"]:
        flash("Nemůžete smazat sami sebe.", "error")
        return redirect(url_for("admin"))
    conn = db()
    pids = [r["id"] for r in conn.execute("SELECT id FROM presentations WHERE owner_id = ?", (uid,))]
    conn.execute("DELETE FROM users WHERE id = ?", (uid,))
    conn.commit()
    remove_files(pids)
    flash("Uživatel byl smazán včetně svých prezentací.", "ok")
    return redirect(url_for("admin"))


@app.errorhandler(413)
def too_large(_err):
    return f"Soubor je příliš velký (limit {MAX_UPLOAD_MB} MB).", 413
