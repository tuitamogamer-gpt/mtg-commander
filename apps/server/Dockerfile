# Build context must be the repo ROOT (pnpm workspace):
#   docker build -f apps/server/Dockerfile -t mtgc-server .
# syntax=docker/dockerfile:1

# ---- build stage: install workspace, build shared, generate Prisma client ----
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
# Build the shared package and generate the Postgres Prisma client.
RUN pnpm --filter @mtgc/shared build \
 && cd apps/server && pnpm exec prisma generate --schema prisma/postgres.prisma

# ---- runtime stage --------------------------------------------------------
FROM node:20-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# Copy the fully-installed workspace (incl. generated Prisma client + tsx).
COPY --from=build /app /app

WORKDIR /app/apps/server
EXPOSE 4000

# Sync the schema to Postgres (db push avoids cross-provider migration files),
# then start the server. The server is run with tsx so the workspace's
# source-level "@mtgc/shared" import resolves without a separate bundling step.
CMD ["sh", "-c", "pnpm exec prisma db push --schema prisma/postgres.prisma --skip-generate && pnpm exec tsx src/index.ts"]
