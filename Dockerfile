# syntax=docker/dockerfile:1
# Multi-stage build for the BookMyCab Next.js app (standalone output).
# pnpm 10.32.0 (matches package.json "packageManager", lockfileVersion 9.0), Node 20.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

# --- Dependencies ---------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ----------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined at build time, so they must be present here.
# Passed in as build args from docker-compose (read from .env.production).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CAL_LINK
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CAL_LINK=$NEXT_PUBLIC_CAL_LINK \
    NEXT_TELEMETRY_DISABLED=1

# `next build` collects page data, which imports server routes and runs env
# validation. SUPABASE_SERVICE_ROLE_KEY and VOICE_INGEST_SECRET are required but
# are runtime-only secrets (injected via env_file). Throwaway values let the
# build pass; they are NOT the real secrets and never reach the runtime stage,
# which gets the real ones from .env.production at run time.
ENV SUPABASE_SERVICE_ROLE_KEY=build-time-placeholder-not-a-real-key \
    VOICE_INGEST_SECRET=build-time-placeholder-not-a-real-secret

RUN pnpm build

# --- Runtime --------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone server bundles its own minimal node_modules.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
