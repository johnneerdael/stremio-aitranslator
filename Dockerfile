# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Install system utilities
RUN apk add --no-cache \
    bash \
    curl \
    htop \
    nano \
    procps \
    tcpdump \
    vim

# Set working directory
WORKDIR /app

# Install pnpm and production dependencies only
RUN npm install -g pnpm

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static

# Expose port
EXPOSE 7000

# Start the application
CMD ["node", "dist/index.js"] 