FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Create required directories first
RUN mkdir -p /app/static /app/subtitles

# Copy static files specifically
COPY static/* /app/static/

# Copy remaining app source
COPY . .

# Set permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --spider http://localhost:7000/health || exit 1

# Expose port
EXPOSE 7000

# Start the application
CMD ["npm", "start"]
