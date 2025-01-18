FROM node:20-alpine AS base

# Install build dependencies
RUN apk add --no-cache python3 make g++ gcc sqlite-dev

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Development stage
FROM base AS development
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .
CMD ["pnpm", "dev"]

# Build stage
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .
RUN pnpm build

# Rebuild sqlite3 for the specific Node.js version
RUN npm rebuild sqlite3 --build-from-source

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache python3 make g++ gcc sqlite-dev

# Create necessary directories
RUN mkdir -p dist/templates static/templates subtitles/dut langs

# Copy built files and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy templates
COPY --from=build /app/src/templates ./dist/templates
COPY --from=build /app/src/templates ./static/templates

# Install production dependencies with rebuild
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --prod --force

# Rebuild sqlite3 again in production stage
RUN npm rebuild sqlite3 --build-from-source

# Create data directory for credentials
RUN mkdir -p data

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 7000
CMD ["node", "dist/index.js"] 