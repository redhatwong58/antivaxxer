# ANTIVAXXER API — Production Dockerfile
#
# [AV-042] feat: containerized deployment for App Runner / ECS / EKS
#
# Multi-stage build:
#   Stage 1 (builder): installs all deps, generates Prisma client
#   Stage 2 (runtime): copies only what's needed for runtime
# This keeps the final image under 200MB.
#
# Build context is /api (set in App Runner config or docker build command).
#
# Usage:
#   docker build -t antivaxxer-api .
#   docker run -p 4000:4000 --env-file .env antivaxxer-api

# ============================================================
# Stage 1: Builder
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL (required by Prisma engine)
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first (better Docker layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps including dev (needed for prisma generate)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY scripts ./scripts/

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM node:20-slim AS runtime

WORKDIR /app

# OpenSSL for Prisma + curl for health checks
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user (security best practice)
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma client and engines from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy source code from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma

# Switch to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose API port
EXPOSE 4000

# Health check (App Runner does its own, but useful for local + ECS)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

# Start the API
CMD ["node", "src/index.js"]
