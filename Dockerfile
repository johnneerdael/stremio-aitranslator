FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directory for subtitles and ensure proper permissions
RUN mkdir -p subtitles/dut && \
    touch credentials.json && \
    echo '{}' > credentials.json && \
    chown -R node:node /app && \
    chmod -R 755 /app && \
    chmod 666 credentials.json

# Switch to non-root user
USER node

# Expose ports
EXPOSE 3000
EXPOSE 7000

CMD ["node", "index.js"] 