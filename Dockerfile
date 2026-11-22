# ==============================================================================
# Multi-Stage Dockerfile for Platinum Gym API Backend
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl libc6-compat

# Install package dependencies
COPY package*.json ./
RUN npm ci

# Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Install runtime dependencies for Prisma engine
RUN apk add --no-cache openssl libc6-compat

# Create non-root system user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gymuser -G nodejs

# Copy built artifacts and production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Ensure runtime directories exist with correct permissions
RUN mkdir -p logs && chown -R gymuser:nodejs /app

USER gymuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
