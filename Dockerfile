
# syntax=docker/dockerfile:1

# ── deps: install all dependencies (incl. dev) for the build ────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build: generate prisma client + compile the standalone next server ──────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── runner: slim image serving the standalone bundle ────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/recall.db

# The standalone server plus its static assets and public files.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Prisma schema + migrations + seed data
COPY --from=build /app/prisma ./prisma

# Maintenance scripts run by the entrypoint (guest pruning)
COPY --from=build /app/scripts ./scripts

# ALL node_modules die Prisma zur Laufzeit braucht (effect, etc.)
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --production --no-optional
RUN npm install --no-save tsx

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
