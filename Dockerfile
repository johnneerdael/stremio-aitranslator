FROM node:20-alpine as base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Development stage
FROM base as development
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .
CMD ["pnpm", "dev"]

# Build stage
FROM base as build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine as production
WORKDIR /app

# Create necessary directories
RUN mkdir -p dist/templates static/templates subtitles/dut langs

# Copy built files and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy templates
COPY --from=build /app/src/templates ./dist/templates
COPY --from=build /app/src/templates ./static/templates

# Install production dependencies only
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --prod

# Create data directory for credentials
RUN mkdir -p data

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 7000
CMD ["node", "dist/index.js"] 