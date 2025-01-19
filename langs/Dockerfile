# Base image: Debian-based slim variant for better node-gyp compatibility
# Refs:
# - https://github.com/nodejs/docker-node#nodeversion-slim
# - https://github.com/nodejs/node-gyp/issues/1873
FROM node:20.11.0-slim AS base

# Install build dependencies
# python3-distutils: Required for node-gyp Python functionality
# Refs: 
# - https://github.com/nodejs/node-gyp#installation
# - https://github.com/nodejs/node-gyp/issues/2869
RUN apt-get update && apt-get install -y \
    python3-full \
    python3-venv \
    make \
    g++ \
    gcc \
    git \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/* && \
    python3 -m venv /opt/venv
    
# Activate virtual environment and install Python packages
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir setuptools wheel

# Install pnpm using corepack (Node.js built-in package manager manager)
# Refs:
# - https://pnpm.io/installation#using-corepack
# - https://nodejs.org/api/corepack.html
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Development stage
# Using multi-stage builds for optimized development environment
# Refs:
# - https://docs.docker.com/build/building/multi-stage/
# - https://docs.docker.com/develop/develop-images/multistage-build/
FROM base AS development
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .
CMD ["pnpm", "dev"]

# Build stage
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .

# Set build configuration
# CFLAGS/CXXFLAGS: Optimize native module compilation
# npm_config_*: Configure sqlite3 build settings
# Refs:
# - https://github.com/mapbox/node-sqlite3/wiki/Building-on-Linux
# - https://github.com/npm/node-gyp#command-line-options
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
    python3-full \
    python3-venv \
    make \
    g++ \
    gcc \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/* && \
    python3 -m venv /opt/venv

# Activate virtual environment and install Python packages
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir setuptools wheel

# Create necessary directories for application data
# Refs:
# - https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#create-ephemeral-containers
# - https://docs.docker.com/storage/volumes/
RUN mkdir -p dist/templates static/templates subtitles/dut langs

# Copy built files, dependencies, and native modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

# Copy templates
COPY --from=build /app/src/templates ./dist/templates
COPY --from=build /app/src/templates ./static/templates

# Install pnpm (no need to rebuild native modules since we copied them from build stage)
# Refs:
# - https://pnpm.io/cli/install#--force
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create data directory for credentials
RUN mkdir -p data

# Set permissions and switch to non-root user for security
# Refs:
# - https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
# - https://github.com/nodejs/docker-node#non-root-user
RUN chown -R node:node /app

USER node

EXPOSE 7000
CMD ["node", "dist/index.js"]
