FROM node:20.11.0-slim AS base

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl \
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

# Build the project
RUN pnpm build

# Production stage
FROM node:20.11.0-slim AS production
WORKDIR /app

# Install runtime dependencies and pnpm
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@latest --activate

# Create necessary directories
RUN mkdir -p dist/templates static/templates subtitles/dut langs data

# Copy built files and package files
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/src/templates ./dist/templates
COPY --from=build /app/src/templates ./static/templates

# Install production dependencies
RUN pnpm install --prod

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 7000
CMD ["node", "dist/index.js"]
