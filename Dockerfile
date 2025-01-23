FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Create required directories with proper permissions
RUN mkdir -p /app/static /app/subtitles && \
    chown -R node:node /app

# Copy static files first
COPY --chown=node:node static/* /app/static/

# Copy remaining app source
COPY --chown=node:node . .

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --spider http://localhost:7000/health || exit 1

# Expose port
EXPOSE 7000

# Start the application
CMD ["npm", "start"]
