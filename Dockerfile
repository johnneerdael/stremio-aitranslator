FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create cache and logs directories
RUN mkdir -p /app/static && \
    chown -R node:node /app

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --spider http://localhost:7000/health || exit 1

# Expose port
EXPOSE 7000

# Start the application
CMD ["npm", "start"]
