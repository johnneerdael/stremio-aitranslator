FROM node:20.11.0-slim AS base

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-distutils \
    python3-pip \
    make \
    g++ \
    gcc \
    git \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

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

# Set build configuration
ENV CFLAGS="-O2"
ENV CXXFLAGS="-O2"
ENV npm_config_build_from_source=true
ENV npm_config_sqlite=/usr
ENV npm_config_sqlite_libname=sqlite3
RUN npm rebuild sqlite3 --build-from-source

RUN pnpm build

# Production stage
FROM node:20.11.0-slim AS production
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-distutils \
    python3-pip \
    make \
    g++ \
    gcc \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories
RUN mkdir -p dist/templates static/templates subtitles/dut langs

# Copy built files and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy templates
COPY --from=build /app/src/templates ./dist/templates
COPY --from=build /app/src/templates ./static/templates

# Install production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    CFLAGS="-O2" CXXFLAGS="-O2" \
    npm_config_build_from_source=true \
    npm_config_sqlite=/usr \
    npm_config_sqlite_libname=sqlite3 \
    pnpm install --prod --force && \
    npm rebuild sqlite3 --build-from-source

# Create data directory for credentials
RUN mkdir -p data

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 7000
CMD ["node", "dist/index.js"]
