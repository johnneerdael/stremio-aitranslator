FROM node:18-alpine

# Add tini for proper process management
RUN apk add --no-cache tini wget

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Create required directories
RUN mkdir -p /app/static /app/subtitles /app/logs && \
    chown -R node:node /app

# Copy static files first
COPY --chown=node:node static/ /app/static/

# Verify static files exist
RUN [ -f /app/static/loading.srt ] && \
    [ -f /app/static/logo.png ] && \
    [ -f /app/static/wallpaper.png ] || \
    (echo "Missing required static files" && exit 1)

# Copy remaining app source
COPY --chown=node:node . .

# Switch to non-root user
USER node

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7000/health || exit 1

EXPOSE 7000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
