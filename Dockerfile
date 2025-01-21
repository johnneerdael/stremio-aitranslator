FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create cache and logs directories
RUN mkdir -p cache logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 7000

# Start the application
CMD ["npm", "start"]
