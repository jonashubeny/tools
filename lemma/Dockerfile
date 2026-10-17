# syntax=docker/dockerfile:1
#
# Lemma — one image, one process, one volume.
#
#   build stage    installs everything and builds the web app and the server bundle
#   runtime stage  carries only Node, the bundle, the static files and SQLite's native module
#
# The server bundle contains all JavaScript dependencies. The one thing that cannot be
# bundled is better-sqlite3's native binary, which ships prebuilt inside its package.

ARG NODE_IMAGE=docker.io/library/node:22-bookworm-slim

# ----------------------------------------------------------------------------- build
FROM ${NODE_IMAGE} AS build
WORKDIR /src

# Manifests first, so that the dependency layer is reused until they change.
# .npmrc switches dependency install scripts off (see the file for why).
COPY package.json package-lock.json .npmrc ./
COPY packages/core/package.json packages/core/
COPY packages/content/package.json packages/content/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

# The one step that needs the network to behave: about 80 MB from the npm registry.
# npm retries a request that fails, but a download that stalls half-way makes it give up
# at once. So the download cache lives in a cache mount, where it survives a failed build,
# and the install gets three attempts — each one only fetches what is still missing.
RUN --mount=type=cache,target=/root/.npm \
    for attempt in 1 2 3; do \
      npm ci --no-audit --no-fund && exit 0; \
      echo "npm ci failed (attempt $attempt of 3)" >&2; \
      sleep 5; \
    done; \
    exit 1

COPY tsconfig.base.json vitest.config.ts ./
COPY scripts scripts
COPY packages packages
RUN npm run build

# --------------------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    DATA_DIR=/data \
    WEB_DIR=/app/web

WORKDIR /app
COPY --from=build /src/packages/server/dist/server.mjs /src/packages/server/dist/server.mjs.map ./
COPY --from=build /src/packages/web/dist ./web
COPY --from=build /src/node_modules/better-sqlite3/package.json ./node_modules/better-sqlite3/package.json
COPY --from=build /src/node_modules/better-sqlite3/lib ./node_modules/better-sqlite3/lib
COPY --from=build /src/node_modules/better-sqlite3/prebuilds/linux-x64.node \
                  /src/node_modules/better-sqlite3/prebuilds/linux-arm64.node \
                  ./node_modules/better-sqlite3/prebuilds/

# The data directory belongs to the unprivileged user the image runs as. A builder that
# has a single-ID user namespace (rootless Podman without subuid ranges) cannot chown to
# another user; there the directory is made writable instead, and the container is run
# as the namespace's own user (see compose.yaml: LEMMA_UID).
# The second command proves at build time that the native module loads in this image.
RUN mkdir -p /data \
 && (chown node:node /data 2>/dev/null || chmod 0777 /data) \
 && node -e "const D = require('better-sqlite3'); const d = new D(':memory:'); d.exec('select 1'); d.close()"

USER node
VOLUME ["/data"]
EXPOSE 8000

# Kept here for plain `docker run`; compose.yaml repeats it because images built in the
# OCI format (Podman's default) do not carry a HEALTHCHECK.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8000) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "--enable-source-maps", "server.mjs"]
