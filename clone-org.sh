#!/usr/bin/env bash
# clone-org.sh — clones every repository of an organization / group,
# repositories that are already cloned get fetched and pulled
#
# Usage:
#   ./clone-org.sh                    # syncs everything from clone-org.list
#   ./clone-org.sh <link>             # e.g. https://github.com/my-org
#   ./clone-org.sh <link> <directory> # e.g. https://github.com/my-org ~/src/my-org
#
# Without clone-org.list next to the script it asks for the link and the directory.
#
# Supported hosts:
#   GitHub (+ Enterprise), GitLab (+ self-hosted, incl. subgroups),
#   Gitea / Forgejo / Gogs (e.g. Codeberg), Bitbucket Cloud
#
# The link can be an organization or a user account. A link with no path
# (e.g. https://git.modulbit.eu) means everything you can reach on that
# Gitea / Forgejo host, so new organizations are picked up automatically.
#
# The access token comes from GIT_TOKEN or, when that is not set, from what
# git has stored for the host (git credential). Existing clones are found by
# their origin wherever they are under SCAN_DIR, so nothing gets cloned twice,
# and origins of moved or renamed repositories get repointed.
#
# Pulling only ever fast-forwards: local work is never overwritten, stashed or
# merged. A repository that cannot be updated is listed at the end.
#
# Environment variables:
#   DEST_DIR   where to clone (same as the <directory> argument)
#   SCAN_DIR   where to look for existing clones (default ~/0_PROJEKTY)
#   GIT_TOKEN  access token for private repos and higher API limits
#   USE_SSH    1 = clone over SSH first, HTTPS is the fallback (default: reverse)
#   PROVIDER   github | gitlab | gitea | bitbucket (skips auto-detection)
#   DRY_RUN    1 = only print what would be cloned and repointed
#
# Exit code is 1 when a repository failed or the repository list is incomplete.

set -euo pipefail

info()  { printf '\e[1;34m==>\e[0m %s\n' "$*"; }
warn()  { printf '\e[1;33m!!\e[0m %s\n' "$*" >&2; }
die()   { printf '\e[1;31mERROR:\e[0m %s\n' "$*" >&2; exit 1; }

# Never wait for a password or on a dead connection
export GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=true SSH_ASKPASS=true
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15"
export GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=60

# --- All sources from clone-org.list ---------------------------------------

sync_all() {
    local list="$1" link dir rest code=0
    REPORT_FILE="$(mktemp)"
    trap 'rm -f "$REPORT_FILE"' EXIT

    while read -r link dir rest <&3; do
        [[ -z "$link" || "$link" == \#* ]] && continue
        echo
        info "=== $link -> $dir"
        CLONE_ORG_REPORT="$REPORT_FILE" "$0" "$link" "$dir" </dev/null || code=1
    done 3< "$list"

    echo
    if [[ -s "$REPORT_FILE" ]]; then
        warn "Summary of all sources:"
        cat "$REPORT_FILE" >&2
    fi
    (( code == 0 )) && info "Everything is in sync." || warn "Not everything is in sync, see above."
    return "$code"
}

# --- API helpers ------------------------------------------------------------

# Prints the HTTP status code, stores the response body in $TMP
api() {
    local args=(-sSL --connect-timeout 10 -m 60 --retry 3 --retry-delay 2 -o "$TMP" -w '%{http_code}')
    (( HAS_AUTH )) && args+=(-K "$AUTH_FILE")
    curl "${args[@]}" "$1" || true
}

api_message() { jq -r '(.message // .error // empty) | tostring' "$TMP" 2>/dev/null || true; }

api_error() { die "API returned $1: $(api_message)"; }

set_auth() {
    local header
    case "$PROVIDER" in
        gitea) header="Authorization: token $1" ;;
        *)     header="Authorization: Bearer $1" ;;
    esac
    printf 'header = "%s"\n' "$header" > "$AUTH_FILE"
    HAS_AUTH=1
}

# What git has stored for this host, without ever prompting
stored_token() {
    printf 'protocol=%s\nhost=%s\n\n' "$SCHEME" "$HOST" \
        | git credential fill 2>/dev/null | sed -n 's/^password=//p' || true
}

# fetch_pages <url ending with "page="> <jq filter printing one REPOS line>
# Appends to REPOS, returns 1 when the first page is a 404. When the token is
# refused it carries on without it, so at least the public repos get synced.
fetch_pages() {
    local page=1 code batch
    while :; do
        code="$(api "$1$page")"
        if [[ "$code" =~ ^40[13]$ && "$page" == 1 ]] && (( HAS_AUTH )); then
            incomplete "the token was refused ($code), private repos are missing: $(api_message)"
            HAS_AUTH=0
            continue
        fi
        [[ "$code" == 404 && "$page" == 1 ]] && return 1
        [[ "$code" == 200 ]] || api_error "$code"
        mapfile -t batch < <(jq -r --arg org "$ORG" "$2" "$TMP")
        (( ${#batch[@]} )) || break
        REPOS+=("${batch[@]}")
        page=$((page + 1))
    done
}

not_found() { die "'$ORG' not found on $HOST (private ones need a token)."; }

is_own_account() {
    [[ "$(api "$API/user")" == 200 ]] || return 1
    local login
    login="$(jq -r '.login // empty' "$TMP")"
    [[ "${login,,}" == "${ORG,,}" ]]
}

# REPOS lines: "<owner/name><TAB><path under DEST_DIR><TAB><https url><TAB><ssh url>"
list_repos() {
    local filter own='select((.owner.login | ascii_downcase) == ($org | ascii_downcase)) | '
    case "$PROVIDER" in
        github)
            filter='.[] | "\(.full_name)\t\(.name)\t\(.clone_url)\t\(.ssh_url)"'
            if (( HAS_AUTH )) && is_own_account; then
                fetch_pages "$API/user/repos?affiliation=owner&per_page=100&page=" "$filter"
                return
            fi
            fetch_pages "$API/orgs/$ORG/repos?per_page=100&page=" "$filter" \
                || fetch_pages "$API/users/$ORG/repos?per_page=100&page=" "$filter" \
                || not_found
            ;;
        gitea)
            filter='.[] | "\(.full_name)\t\(.name)\t\(.clone_url)\t\(.ssh_url)"'
            if [[ -z "$ORG" ]]; then
                (( HAS_AUTH )) || die "A link with no organization needs a token."
                fetch_pages "$API/user/repos?limit=50&page=" "$filter"
            elif (( HAS_AUTH )) && is_own_account; then
                # This endpoint also returns the repos of organizations
                fetch_pages "$API/user/repos?limit=50&page=" ".[] | $own\"\(.full_name)\t\(.name)\t\(.clone_url)\t\(.ssh_url)\""
            else
                fetch_pages "$API/orgs/$ORG/repos?limit=50&page=" "$filter" \
                    || fetch_pages "$API/users/$ORG/repos?limit=50&page=" "$filter" \
                    || not_found
            fi
            ;;
        gitlab)
            # Path relative to the group, so subgroups become subdirectories
            filter='.[] | "\(.path_with_namespace)\t\(.path_with_namespace[($org | length) + 1:])\t\(.http_url_to_repo)\t\(.ssh_url_to_repo)"'
            fetch_pages "$API/groups/${ORG//\//%2F}/projects?include_subgroups=true&with_shared=false&per_page=100&page=" "$filter" \
                || fetch_pages "$API/users/$ORG/projects?per_page=100&page=" "$filter" \
                || not_found
            ;;
        bitbucket)
            local next="https://api.bitbucket.org/2.0/repositories/$ORG?pagelen=100" code batch
            while [[ -n "$next" ]]; do
                code="$(api "$next")"
                [[ "$code" == 404 ]] && not_found
                [[ "$code" == 200 ]] || api_error "$code"
                mapfile -t batch < <(jq -r '.values[] | [.full_name, .slug,
                    (.links.clone[] | select(.name == "https") | .href),
                    (.links.clone[] | select(.name == "ssh") | .href)] | @tsv' "$TMP")
                (( ${#batch[@]} )) && REPOS+=("${batch[@]}")
                next="$(jq -r '.next // empty' "$TMP")"
            done
            ;;
        *)
            die "Unknown PROVIDER '$PROVIDER'. Supported: github, gitlab, gitea, bitbucket."
            ;;
    esac
}

# --- Local clones -----------------------------------------------------------

# host/owner/name in lowercase, for https://, ssh:// and git@host:path URLs
repo_key() {
    local url="${1%/}" host path
    url="${url%.git}"
    if [[ "$url" == *://* ]]; then
        url="${url#*://}"
        url="${url#*@}"
        host="${url%%/*}"
        host="${host%%:*}"
        path="${url#*/}"
    else
        url="${url#*@}"
        host="${url%%:*}"
        path="${url#*:}"
    fi
    printf '%s/%s' "${host,,}" "${path,,}"
}

index_local_clones() {
    local gitdir dir url key
    while IFS= read -r -d '' gitdir; do
        dir="${gitdir%/.git}"
        url="$(git -C "$dir" config --get remote.origin.url)" || continue
        key="$(repo_key "$url")"
        [[ -n "${LOCAL[$key]:-}" ]] || LOCAL[$key]="$dir"
    done < <(find "$SCAN_DIR" "$DEST_DIR" -maxdepth 5 \
                \( -name node_modules -o -name .venv -o -name .cache \) -prune \
                -o -type d -name .git -print0 -prune 2>/dev/null | sort -z)
}

# A clone whose repo is not in the list may have been moved or renamed. The
# host still knows the new place and git cannot follow it (it gets a 301).
repoint_moved() {
    [[ "$PROVIDER" == github || "$PROVIDER" == gitea ]] || return 0
    local key dir old new_key new_url
    for key in "${!LOCAL[@]}"; do
        [[ "$key" == "$SCOPE"/* && -z "${LISTED[$key]:-}" ]] || continue
        [[ "$(api "$API/repos/${key#*/}")" == 200 ]] || continue
        new_key="$KEY_HOST/$(jq -r '.full_name' "$TMP")"
        new_key="${new_key,,}"
        [[ "$new_key" != "$key" ]] || continue

        dir="${LOCAL[$key]}"
        if [[ -n "${LOCAL[$new_key]:-}" ]]; then
            note "$dir: renamed on the host to what ${LOCAL[$new_key]} already tracks, left as it is"
            unset "LOCAL[$key]"
            continue
        fi
        old="$(git -C "$dir" config --get remote.origin.url)"
        [[ "$old" == http* ]] && new_url="$(jq -r '.clone_url' "$TMP")" || new_url="$(jq -r '.ssh_url' "$TMP")"
        info "$dir: repository moved, origin -> $new_url"
        (( DRY_RUN )) || git -C "$dir" remote set-url origin "$new_url"
        unset "LOCAL[$key]"
        LOCAL[$new_key]="$dir"
    done
}

# --- Clone / update ---------------------------------------------------------

retry() { "$@" || { sleep 3; "$@"; }; }

note()   { NOTES+=("$1"); }
failed() { warn "$1"; FAILED+=("$1"); }
incomplete() { warn "$1"; INCOMPLETE+=("$1"); }

check_lfs() {
    if grep -qs 'filter=lfs' "$1/.gitattributes" && ! command -v git-lfs >/dev/null; then
        note "$1: uses Git LFS, but git-lfs is not installed (large files are only pointers)"
    fi
}

clone_repo() {
    local dir="$1" url="$2" fallback="$3"
    info "$dir: cloning"
    if retry git clone --recurse-submodules "$url" "$dir" || {
        [[ ! -e "$dir" ]] && warn "$dir: trying $fallback" && git clone --recurse-submodules "$fallback" "$dir"
    }; then
        CLONED=$((CLONED + 1))
        check_lfs "$dir"
    else
        failed "$dir: clone failed."
    fi
}

# Fast-forwards local branches other than the checked out one
update_other_branches() {
    local dir="$1" current="$2" line branch upstream behind ahead lines
    mapfile -t lines < <(git -C "$dir" for-each-ref --format='%(refname:short) %(upstream:short)' refs/heads)
    for line in "${lines[@]}"; do
        branch="${line%% *}"
        upstream="${line#* }"
        [[ -n "$upstream" && "$branch" != "$current" ]] || continue
        git -C "$dir" rev-parse -q --verify "refs/remotes/$upstream" >/dev/null || continue
        read -r behind ahead < <(git -C "$dir" rev-list --left-right --count "$upstream...refs/heads/$branch")
        (( behind )) || continue
        if (( ahead )); then
            note "$dir: branch '$branch' has diverged from $upstream, left as it is"
        elif ! git -C "$dir" branch -qf "$branch" "$upstream" 2>/dev/null; then
            note "$dir: branch '$branch' is checked out elsewhere, left as it is"
        fi
    done
}

update_repo() {
    local dir="$1" branch upstream before after behind ahead output

    if ! retry git -C "$dir" fetch -q --all --prune --tags --force; then
        failed "$dir: fetch failed ($(git -C "$dir" config --get remote.origin.url))."
        return
    fi

    branch="$(git -C "$dir" symbolic-ref -q --short HEAD)" || branch=""
    update_other_branches "$dir" "$branch"

    if [[ -z "$branch" ]]; then
        note "$dir: detached HEAD, working tree left as it is"
        CURRENT=$((CURRENT + 1))
        return
    fi

    upstream="$(git -C "$dir" rev-parse -q --verify --abbrev-ref '@{u}' 2>/dev/null)" || upstream=""
    if [[ -z "$upstream" ]] && git -C "$dir" rev-parse -q --verify "refs/remotes/origin/$branch" >/dev/null; then
        upstream="origin/$branch"
    fi
    if [[ -z "$upstream" ]]; then
        if [[ -n "$(git -C "$dir" for-each-ref --count=1 refs/remotes)" ]]; then
            note "$dir: branch '$branch' is not on the remote, left as it is"
        fi
        CURRENT=$((CURRENT + 1))
        return
    fi

    # An empty clone has no HEAD yet, everything on the remote counts as new
    before="$(git -C "$dir" rev-parse -q --verify HEAD)" || before=""
    behind=1
    ahead=0
    if [[ -n "$before" ]]; then
        read -r behind ahead < <(git -C "$dir" rev-list --left-right --count "$upstream...HEAD")
    fi

    if (( behind && ahead )); then
        failed "$dir: '$branch' has diverged from $upstream ($ahead local, $behind remote commits)."
        return
    fi
    (( ahead )) && note "$dir: '$branch' has $ahead unpushed commit(s)"

    if (( behind )); then
        if ! output="$(git -C "$dir" merge -q --ff-only "$upstream" 2>&1)"; then
            failed "$dir: pull failed, uncommitted changes are in the way ($behind commits behind $upstream): ${output%%$'\n'*}"
            return
        fi
        after="$(git -C "$dir" rev-parse HEAD)"
        info "$dir: ${before:0:7} -> ${after:0:7}"
        UPDATED=$((UPDATED + 1))
        if [[ -f "$dir/.gitmodules" ]] && ! git -C "$dir" submodule update --init --recursive; then
            note "$dir: submodule update failed"
        fi
        check_lfs "$dir"
    else
        CURRENT=$((CURRENT + 1))
    fi
}

sync_listed() {
    local line key name url ssh_url primary fallback dir known
    for line in "${REPOS[@]}"; do
        IFS=$'\t' read -r key name url ssh_url <<< "$line"
        key="$KEY_HOST/${key,,}"
        (( USE_SSH )) && { primary="$ssh_url"; fallback="$url"; } || { primary="$url"; fallback="$ssh_url"; }
        dir="${LOCAL[$key]:-$DEST_DIR/$name}"

        if [[ -n "${LOCAL[$key]:-}" ]]; then
            (( DRY_RUN )) && { info "$dir: would update"; continue; }
            update_repo "$dir"
        elif [[ -d "$dir/.git" ]]; then
            known="$(git -C "$dir" config --get remote.origin.url)" || known="no origin"
            failed "$dir: already holds another repository ($known), wanted $key."
        elif [[ -e "$dir" ]]; then
            failed "$dir: exists but is not a git repository."
        elif (( DRY_RUN )); then
            info "$dir: would clone $primary"
        else
            clone_repo "$dir" "$primary" "$fallback"
        fi
    done
}

# Clones of this organization the list does not show: private repos the token
# cannot see, for example
sync_unlisted() {
    local key
    for key in "${!LOCAL[@]}"; do
        [[ "$key" == "$SCOPE"/* && -z "${LISTED[$key]:-}" ]] || continue
        if (( DRY_RUN )); then
            info "${LOCAL[$key]}: would update (not in the list)"
        else
            update_repo "${LOCAL[$key]}"
        fi
    done
}

# With clone-org.list the summary is printed once, after the last source
report() {
    local line lines=()
    for line in "${INCOMPLETE[@]}"; do lines+=("incomplete: $line"); done
    for line in "${FAILED[@]}"; do lines+=("failed: $line"); done
    for line in "${NOTES[@]}"; do lines+=("note: $line"); done
    (( ${#lines[@]} )) || return 0
    if [[ -n "${CLONE_ORG_REPORT:-}" ]]; then
        printf '  %s\n' "${lines[@]}" >> "$CLONE_ORG_REPORT"
    else
        printf '  %s\n' "${lines[@]}" >&2
    fi
}

# --- Main -------------------------------------------------------------------

main() {
    local cmd
    for cmd in git curl jq; do
        command -v "$cmd" >/dev/null || die "Missing command '$cmd', please install it."
    done

    LINK="${1:-}"
    if [[ -z "$LINK" ]]; then
        local list
        list="$(dirname "$(readlink -f "$0")")/clone-org.list"
        if [[ -f "$list" ]]; then
            sync_all "$list"
            return
        fi
        read -rp "Link to the organization (e.g. https://github.com/my-org): " LINK
    fi

    # Split the link into host and path; accepts https://host/org, host/org
    # and git@host:org
    SCHEME="https"
    if [[ "$LINK" == *://* ]]; then
        [[ "$LINK" == http://* ]] && SCHEME="http"
        REST="${LINK#*://}"
        REST="${REST#*@}"
        HOST="${REST%%/*}"
        ORG="${REST#"$HOST"}"
        [[ "$LINK" == ssh://* ]] && HOST="${HOST%%:*}"
    elif [[ "$LINK" =~ ^[^/@]+@([^:/]+):(.*)$ ]]; then
        HOST="${BASH_REMATCH[1]}"
        ORG="${BASH_REMATCH[2]}"
    else
        HOST="${LINK%%/*}"
        ORG="${LINK#"$HOST"}"
    fi

    ORG="${ORG%%[?#]*}"
    ORG="${ORG%%/-/*}"
    ORG="${ORG#/}"
    ORG="${ORG#orgs/}"
    ORG="${ORG#groups/}"
    ORG="${ORG%/}"
    ORG="${ORG%.git}"

    [[ "$HOST" == *.* || "$HOST" == localhost* ]] || die "Cannot read the host from '$LINK'."
    [[ -z "$ORG" || "$ORG" =~ ^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$ ]] || die "Cannot read the organization name from '$LINK'."

    BASE="$SCHEME://$HOST"

    TMP="$(mktemp)"
    AUTH_FILE="$(mktemp)"
    trap 'rm -f "$TMP" "$AUTH_FILE"' EXIT
    HAS_AUTH=0

    PROVIDER="${PROVIDER:-}"
    if [[ -z "$PROVIDER" ]]; then
        case "$HOST" in
            github.com)    PROVIDER="github" ;;
            gitlab.com)    PROVIDER="gitlab" ;;
            bitbucket.org) PROVIDER="bitbucket" ;;
            codeberg.org)  PROVIDER="gitea" ;;
            *)
                info "Detecting what runs on $HOST..."
                if [[ "$(api "$BASE/api/v1/version")" == 200 ]]; then
                    PROVIDER="gitea"
                elif [[ "$(api "$BASE/api/v4/version")" =~ ^(200|401)$ ]]; then
                    PROVIDER="gitlab"
                elif [[ "$(api "$BASE/api/v3/meta")" =~ ^(200|401)$ ]]; then
                    PROVIDER="github"
                else
                    die "Cannot detect the git hosting on $HOST, set PROVIDER=github|gitlab|gitea|bitbucket."
                fi
                ;;
        esac
    fi

    [[ -n "$ORG" || "$PROVIDER" == gitea ]] || die "'$LINK' has no organization in it."

    case "$PROVIDER" in
        github) [[ "$HOST" == github.com ]] && API="https://api.github.com" || API="$BASE/api/v3" ;;
        gitea)  API="$BASE/api/v1" ;;
        gitlab) API="$BASE/api/v4" ;;
        *)      API="" ;;
    esac

    INCOMPLETE=(); FAILED=(); NOTES=()

    TOKEN="${GIT_TOKEN:-$(stored_token)}"
    if [[ -n "$TOKEN" ]]; then
        set_auth "$TOKEN"
    else
        incomplete "$HOST: no token (GIT_TOKEN or git credential), private repos are missing"
    fi

    [[ "${USE_SSH:-0}" == 1 ]] && USE_SSH=1 || USE_SSH=0
    [[ "${DRY_RUN:-0}" == 1 ]] && DRY_RUN=1 || DRY_RUN=0

    # Only GitLab has nested groups, elsewhere the organization is the first part
    [[ "$PROVIDER" == gitlab ]] || ORG="${ORG%%/*}"

    DEST_DIR="${2:-${DEST_DIR:-}}"
    if [[ -z "$DEST_DIR" ]]; then
        local default_dir="$PWD/${ORG##*/}"
        read -rp "Directory to clone '${ORG:-$HOST}' into [$default_dir]: " DEST_DIR || true
        DEST_DIR="${DEST_DIR:-$default_dir}"
    fi
    DEST_DIR="${DEST_DIR/#\~/$HOME}"
    SCAN_DIR="${SCAN_DIR:-$HOME/0_PROJEKTY}"
    SCAN_DIR="${SCAN_DIR/#\~/$HOME}"

    # Same form as repo_key
    KEY_HOST="${HOST%%:*}"
    KEY_HOST="${KEY_HOST,,}"
    SCOPE="$KEY_HOST${ORG:+/${ORG,,}}"

    info "Loading the repository list of '${ORG:-everything}' from $HOST ($PROVIDER)..."

    REPOS=()
    list_repos

    declare -gA LOCAL=() LISTED=()
    local line
    for line in "${REPOS[@]}"; do
        line="$KEY_HOST/${line%%$'\t'*}"
        LISTED[${line,,}]=1
    done

    index_local_clones
    repoint_moved

    (( ${#REPOS[@]} )) || warn "No (visible) repositories in '${ORG:-$HOST}'."
    info "Repositories found: ${#REPOS[@]}, destination: $DEST_DIR"

    (( DRY_RUN )) || mkdir -p "$DEST_DIR"

    CLONED=0; UPDATED=0; CURRENT=0

    sync_listed
    sync_unlisted

    info "Done: $CLONED cloned, $UPDATED updated, $CURRENT up to date, ${#FAILED[@]} failed."
    report
    (( ${#FAILED[@]} + ${#INCOMPLETE[@]} == 0 ))
}

# Everything is parsed before the first line runs, so pulling a new version of
# this very script in the middle of a run cannot break it
main "$@"
exit
