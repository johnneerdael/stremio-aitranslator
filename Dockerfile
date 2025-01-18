FROM node:20-alpine

# Install debugging tools
RUN apk add --no-cache \
    bash \
    curl \
    htop \
    nano \
    procps \
    tcpdump \
    vim

# Create app directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Environment variables
ENV NODE_ENV=production
ENV DEBUG=stremio:*
ENV DEBUG_COLORS=true
ENV DEBUG_DEPTH=10

# Expose ports
EXPOSE 11470
EXPOSE 9229

# Start with debugging enabled
CMD ["node", "--inspect=0.0.0.0:9229", "dist/index.js"] 