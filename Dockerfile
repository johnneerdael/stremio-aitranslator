FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directory for subtitles
RUN mkdir -p subtitles/dut

# Expose ports
EXPOSE 3000
EXPOSE 7000

CMD ["node", "index.js"] 