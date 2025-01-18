FROM node:20.11.0-slim AS base

# Install build dependencies
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
    python3 -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    /opt/venv/bin/pip install --no-cache-dir setuptools wheel

# Add virtual environment to PATH
ENV PATH="/opt/venv/bin:$PATH"

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

# Build sqlite3 and the project
RUN npm rebuild sqlite3 --build-from-source && pnpm build

# Production stage
FROM node:20.11.0-slim AS production
WORKDIR /app

# Install runtime dependencies and setup Python virtual environment
RUN apt-get update && apt-get install -y \
    python3-full \
    python3-venv \
    make \
    g++ \
    gcc \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/* && \
    python3 -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    /opt/venv/bin/pip install --no-cache-dir setuptools wheel

# Add virtual environment to PATH
ENV PATH="/opt/venv/bin:$PATH"

# Create necessary directories
RUN mkdir -p dist/templates static/templates subtitles/dut langs data

# Copy the entire app directory to preserve node_modules structure
COPY --from=build /app .

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 7000
CMD ["node", "dist/index.js"]
